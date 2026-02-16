import hashlib
import hmac
import json
import os
import uuid
import datetime
from typing import Any, Dict, Optional

import httpx


class AttestationService:
    """
    Pluggable attestation service.

    Modes:
    - local_hmac (default): deterministic dev attestation with HMAC signature
    - eigencompute: forwards attestation request to an external attestor endpoint

    Hardening:
    - strict mode can disable local fallback in production
    - retries/backoff for remote attestation calls
    - baseline health checks for readiness gating
    """

    def __init__(self):
        self.provider = os.getenv("ATTESTATION_PROVIDER", "local_hmac").lower().strip()
        self.dev_secret = os.getenv("ATTESTATION_DEV_SECRET", "trende-dev-secret")
        self.key_id = os.getenv("ATTESTATION_KEY_ID", "local-dev-key")

        self.eigen_url = os.getenv("EIGEN_ATTEST_URL", "").strip()
        self.eigen_token = os.getenv("EIGEN_ATTEST_TOKEN", "").strip()
        self.eigen_health_url = os.getenv("EIGEN_HEALTH_URL", "").strip()

        self.strict_mode = os.getenv("ATTESTATION_STRICT_MODE", "false").lower() == "true"
        self.timeout_secs = float(os.getenv("EIGEN_ATTEST_TIMEOUT_SECS", "20"))
        self.retries = max(0, int(os.getenv("EIGEN_ATTEST_RETRIES", "2")))
        self.backoff_ms = max(0, int(os.getenv("EIGEN_ATTEST_BACKOFF_MS", "300")))

    async def attest(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        provider = self.provider
        if provider == "eigencompute":
            remote = await self._attest_with_eigencompute(payload)
            if remote:
                return remote

            if self.strict_mode:
                return self._eigen_unavailable_payload(payload)

            local = self._attest_locally(payload)
            local["fallback_from"] = "eigencompute"
            local["fallback_reason"] = "eigencompute_unreachable_or_invalid_response"
            return local

        return self._attest_locally(payload)

    def verify(self, payload: Dict[str, Any], attestation: Dict[str, Any]) -> bool:
        provider = str(attestation.get("provider", "")).lower()
        digest = self._canonical_hash(payload)

        if provider == "local_hmac":
            signature = attestation.get("signature", "")
            expected = hmac.new(
                self.dev_secret.encode("utf-8"),
                digest.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(signature, expected) and attestation.get("input_hash") == digest

        if provider == "eigencompute":
            # Minimal integrity check for Eigen attestation payload.
            # Full quote verification should happen via provider-specific verification pipeline.
            return (
                attestation.get("status") == "signed"
                and attestation.get("input_hash") == digest
                and bool(attestation.get("attestation_id"))
            )

        return False

    async def health_check(self, probe: bool = False) -> Dict[str, Any]:
        configured = {
            "provider": self.provider,
            "strict_mode": self.strict_mode,
            "eigen_url_configured": bool(self.eigen_url),
            "eigen_health_url_configured": bool(self.eigen_health_url),
            "timeout_secs": self.timeout_secs,
            "retries": self.retries,
            "backoff_ms": self.backoff_ms,
        }

        if self.provider != "eigencompute":
            return {
                "ok": True,
                "status": "ready",
                "message": "Using local_hmac attestation provider.",
                "configured": configured,
                "probe_enabled": probe,
            }

        if not self.eigen_url:
            return {
                "ok": False,
                "status": "degraded",
                "message": "ATTESTATION_PROVIDER=eigencompute but EIGEN_ATTEST_URL is missing.",
                "configured": configured,
                "probe_enabled": probe,
            }

        if not probe:
            return {
                "ok": True,
                "status": "ready",
                "message": "Eigen attestation provider configured. Use probe=true to test live reachability.",
                "configured": configured,
                "probe_enabled": probe,
            }

        probe_result = await self._probe_eigen_endpoint()
        return {
            "ok": probe_result.get("ok", False),
            "status": "ready" if probe_result.get("ok") else "degraded",
            "message": probe_result.get("message"),
            "configured": configured,
            "probe_enabled": probe,
            "probe": probe_result,
        }

    def _attest_locally(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        digest = self._canonical_hash(payload)
        signature = hmac.new(
            self.dev_secret.encode("utf-8"),
            digest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return {
            "provider": "local_hmac",
            "status": "signed",
            "method": "hmac-sha256",
            "attestation_id": f"ATTEST-{digest[:16]}",
            "input_hash": digest,
            "signature": signature,
            "key_id": self.key_id,
            "generated_at": now,
            "payload": payload,
            "verify_endpoint": "/api/attest/verify",
            "verification_note": "Recompute canonical payload hash and verify HMAC with attestation key.",
        }

    async def _attest_with_eigencompute(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.eigen_url:
            return None

        req_body = {
            "request_id": str(uuid.uuid4()),
            "payload": payload,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        headers = {"Content-Type": "application/json"}
        if self.eigen_token:
            headers["Authorization"] = f"Bearer {self.eigen_token}"

        attempts = self.retries + 1
        last_error = ""

        for attempt in range(1, attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_secs) as client:
                    response = await client.post(self.eigen_url, json=req_body, headers=headers)

                if response.status_code >= 400:
                    last_error = f"HTTP {response.status_code}"
                else:
                    body = response.json()
                    attestation_id = body.get("attestation_id", "")
                    if not attestation_id:
                        last_error = "Missing attestation_id in response"
                    else:
                        return {
                            "provider": "eigencompute",
                            "status": body.get("status", "signed"),
                            "method": body.get("method", "tee-attestation"),
                            "attestation_id": attestation_id,
                            "input_hash": body.get("input_hash", self._canonical_hash(payload)),
                            "signature": body.get("signature", ""),
                            "key_id": body.get("key_id", "eigencompute"),
                            "quote": body.get("quote"),
                            "receipt": body.get("receipt"),
                            "payload": body.get("payload", payload),
                            "generated_at": body.get("generated_at", datetime.datetime.now(datetime.timezone.utc).isoformat()),
                            "verify_endpoint": body.get("verify_endpoint", "/api/attest/verify"),
                        }
            except Exception as exc:
                last_error = str(exc)

            if attempt < attempts and self.backoff_ms > 0:
                # simple linear backoff
                await self._sleep_ms(self.backoff_ms * attempt)

        if last_error:
            print(f"Eigen attestation failed after {attempts} attempts: {last_error}")
        return None

    async def _probe_eigen_endpoint(self) -> Dict[str, Any]:
        url = self.eigen_health_url or self.eigen_url
        headers: Dict[str, str] = {}
        if self.eigen_token:
            headers["Authorization"] = f"Bearer {self.eigen_token}"

        try:
            async with httpx.AsyncClient(timeout=min(8.0, self.timeout_secs)) as client:
                if self.eigen_health_url:
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.post(
                        url,
                        headers={**headers, "Content-Type": "application/json"},
                        json={
                            "request_id": str(uuid.uuid4()),
                            "payload": {"kind": "health_probe", "ts": datetime.datetime.now(datetime.timezone.utc).isoformat()},
                            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        },
                    )

            if response.status_code >= 400:
                return {
                    "ok": False,
                    "endpoint": url,
                    "status_code": response.status_code,
                    "message": f"Eigen endpoint returned HTTP {response.status_code}",
                }

            return {
                "ok": True,
                "endpoint": url,
                "status_code": response.status_code,
                "message": "Eigen endpoint reachable.",
            }
        except Exception as exc:
            return {
                "ok": False,
                "endpoint": url,
                "status_code": None,
                "message": f"Eigen endpoint probe failed: {exc}",
            }

    def _eigen_unavailable_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "provider": "eigencompute",
            "status": "unavailable",
            "method": "tee-attestation",
            "attestation_id": "",
            "input_hash": self._canonical_hash(payload),
            "signature": "",
            "key_id": "eigencompute",
            "payload": payload,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "verify_endpoint": "/api/attest/verify",
            "error": "Eigen attestation endpoint unreachable and strict mode is enabled.",
        }

    def _canonical_hash(self, payload: Dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    async def _sleep_ms(self, millis: int) -> None:
        import asyncio

        await asyncio.sleep(millis / 1000.0)


attestation_service = AttestationService()
