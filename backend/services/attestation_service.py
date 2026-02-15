import os
import json
import hmac
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any

import httpx


class AttestationService:
    """
    Pluggable attestation service.

    Modes:
    - local_hmac (default): deterministic dev attestation with HMAC signature
    - eigencompute: forwards attestation request to an external attestor endpoint
    """

    def __init__(self):
        self.provider = os.getenv("ATTESTATION_PROVIDER", "local_hmac").lower()
        self.dev_secret = os.getenv("ATTESTATION_DEV_SECRET", "trende-dev-secret")
        self.key_id = os.getenv("ATTESTATION_KEY_ID", "local-dev-key")
        self.eigen_url = os.getenv("EIGEN_ATTEST_URL", "")
        self.eigen_token = os.getenv("EIGEN_ATTEST_TOKEN", "")

    async def attest(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        provider = self.provider
        if provider == "eigencompute":
            remote = await self._attest_with_eigencompute(payload)
            if remote:
                return remote
            provider = "local_hmac"

        if provider == "local_hmac":
            return self._attest_locally(payload)

        return self._attest_locally(payload)

    def verify(self, payload: Dict[str, Any], attestation: Dict[str, Any]) -> bool:
        if attestation.get("provider") != "local_hmac":
            return False

        digest = self._canonical_hash(payload)
        signature = attestation.get("signature", "")
        expected = hmac.new(
            self.dev_secret.encode("utf-8"),
            digest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(signature, expected) and attestation.get("input_hash") == digest

    def _attest_locally(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
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

    async def _attest_with_eigencompute(self, payload: Dict[str, Any]) -> Dict[str, Any] | None:
        if not self.eigen_url:
            return None

        req_body = {
            "request_id": str(uuid.uuid4()),
            "payload": payload,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        headers = {"Content-Type": "application/json"}
        if self.eigen_token:
            headers["Authorization"] = f"Bearer {self.eigen_token}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(self.eigen_url, json=req_body, headers=headers)
            if response.status_code >= 400:
                return None

            body = response.json()
            return {
                "provider": "eigencompute",
                "status": body.get("status", "signed"),
                "method": body.get("method", "tee-attestation"),
                "attestation_id": body.get("attestation_id", ""),
                "input_hash": body.get("input_hash", self._canonical_hash(payload)),
                "signature": body.get("signature", ""),
                "key_id": body.get("key_id", "eigencompute"),
                "quote": body.get("quote"),
                "receipt": body.get("receipt"),
                "payload": body.get("payload", payload),
                "generated_at": body.get("generated_at", datetime.now(timezone.utc).isoformat()),
                "verify_endpoint": body.get("verify_endpoint"),
            }
        except Exception:
            return None

    def _canonical_hash(self, payload: Dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


attestation_service = AttestationService()
