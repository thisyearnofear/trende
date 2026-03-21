import datetime
import hashlib
import hmac
import json
import os
from typing import Any, Dict


class AttestationService:
    """
    Server-side proof service for Trende.

    Proofs are generated inside the backend runtime and signed with an HMAC key.
    The ATTESTATION_PROVIDER env var is retained for compatibility, but legacy
    values are normalized to the current Hetzner-backed proof lane.
    """

    def __init__(self) -> None:
        requested_provider = os.getenv("ATTESTATION_PROVIDER", "hetzner").lower().strip()
        self.provider = self._normalize_provider(requested_provider)
        self.requested_provider = requested_provider or "hetzner"
        self.dev_secret = os.getenv("ATTESTATION_DEV_SECRET", "trende-dev-secret")
        self.key_id = os.getenv("ATTESTATION_KEY_ID", "hetzner-runtime-key")
        self.host = os.getenv("ATTESTATION_HOST", "hetzner").strip().lower() or "hetzner"

    def _normalize_provider(self, provider: str) -> str:
        if provider in {"hetzner", "server", "server_hmac", "local_hmac"}:
            return "hetzner"
        return "hetzner"

    async def attest(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._attest_server_side(payload)

    def verify(self, payload: Dict[str, Any], attestation: Dict[str, Any]) -> bool:
        provider = str(attestation.get("provider", "")).lower()
        if provider not in {"hetzner", "local_hmac", "server", "server_hmac"}:
            return False

        digest = self._canonical_hash(payload)
        signature = str(attestation.get("signature", ""))
        expected = hmac.new(
            self.dev_secret.encode("utf-8"),
            digest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(signature, expected) and attestation.get("input_hash") == digest

    async def health_check(self, probe: bool = False) -> Dict[str, Any]:
        secret_configured = bool(self.dev_secret)
        configured = {
            "provider": self.provider,
            "requested_provider": self.requested_provider,
            "host": self.host,
            "key_id": self.key_id,
            "secret_configured": secret_configured,
        }
        response: Dict[str, Any] = {
            "ok": secret_configured,
            "status": "ready" if secret_configured else "degraded",
            "message": (
                "Server-side proof service is ready on Hetzner."
                if secret_configured
                else "ATTESTATION_DEV_SECRET is missing. Server-side proof generation is degraded."
            ),
            "configured": configured,
            "probe_enabled": probe,
        }
        if probe:
            response["probe"] = {
                "ok": secret_configured,
                "mode": "server-signature",
                "host": self.host,
                "message": "Proof generation is local to the backend runtime.",
            }
        return response

    def _attest_server_side(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        digest = self._canonical_hash(payload)
        signature = hmac.new(
            self.dev_secret.encode("utf-8"),
            digest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return {
            "provider": "hetzner",
            "status": "signed",
            "method": "server-signature",
            "attestation_id": f"PROOF-{digest[:16]}",
            "input_hash": digest,
            "signature": signature,
            "key_id": self.key_id,
            "generated_at": now,
            "payload": payload,
            "verify_endpoint": "/api/health/attestation/verify",
            "verification_note": "Recompute the canonical payload hash and verify the server signature with the configured proof key.",
        }

    def _canonical_hash(self, payload: Dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


attestation_service = AttestationService()
