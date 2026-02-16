import hashlib
import json
import os
from typing import Any

import httpx


class ArchiveService:
    """
    Optional immutable archival service.
    - pinata: pins JSON to IPFS via Pinata JWT
    - hash: deterministic content hash URI fallback (no external dependency)
    """

    def __init__(self) -> None:
        self.provider = os.getenv("ARCHIVE_PROVIDER", "hash").strip().lower()
        self.pinata_jwt = os.getenv("PINATA_JWT", "").strip()
        self.timeout_secs = float(os.getenv("ARCHIVE_TIMEOUT_SECS", "20"))

    async def archive_payload(
        self,
        payload: dict[str, Any],
        prefer_ipfs: bool = True,
    ) -> dict[str, Any]:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        hash_uri = f"hash://sha256/{digest}"

        if prefer_ipfs and self.provider == "pinata" and self.pinata_jwt:
            cid = await self._pin_with_pinata(payload)
            if cid:
                return {
                    "provider": "pinata",
                    "pinned": True,
                    "cid": cid,
                    "uri": f"ipfs://{cid}",
                    "content_hash": digest,
                }

        return {
            "provider": "hash",
            "pinned": False,
            "cid": None,
            "uri": hash_uri,
            "content_hash": digest,
            "note": "Pinned IPFS provider unavailable. Stored deterministic content hash URI.",
        }

    async def _pin_with_pinata(self, payload: dict[str, Any]) -> str | None:
        headers = {
            "Authorization": f"Bearer {self.pinata_jwt}",
            "Content-Type": "application/json",
        }
        body = {
            "pinataContent": payload,
            "pinataMetadata": {"name": "trende-research-archive"},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_secs) as client:
                response = await client.post(
                    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                    headers=headers,
                    json=body,
                )
            if response.status_code >= 400:
                print(f"Pinata pin failed: HTTP {response.status_code} {response.text}")
                return None
            data = response.json()
            return data.get("IpfsHash")
        except Exception as exc:
            print(f"Pinata pin failed: {exc}")
            return None


archive_service = ArchiveService()
