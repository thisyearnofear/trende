import datetime
import os
from typing import List, Optional

from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from backend.services.chainlink_service import chainlink_service


class ChainlinkConnector(AbstractPlatformConnector):
    """Chainlink Functions connector that submits on-chain verification requests."""

    def __init__(self):
        self.subscription_id = os.getenv("CHAINLINK_SUBSCRIPTION_ID")
        self.don_id = os.getenv(
            "CHAINLINK_DON_ID",
            "0x66756e2d626173652d7365706f6c69612d310000000000000000000000000000",
        )
        self.default_source = os.getenv(
            "CHAINLINK_FUNCTION_SOURCE",
            """
const query = args[0] || "unknown";
const timestamp = new Date().toISOString();
return Functions.encodeString(JSON.stringify({
  query,
  timestamp,
  note: "Trende verification request submitted"
}));
""".strip(),
        )

    @property
    def platform(self) -> str:
        return PlatformType.CHAINLINK.value

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        request = await self.fetch_verifiable_data(query, self.default_source)
        timestamp = datetime.datetime.now(datetime.timezone.utc)

        tx_hash = request.get("tx_hash")
        details = (
            f"On-chain Chainlink Functions request submitted: {tx_hash}"
            if tx_hash
            else request.get("status", "Chainlink request not submitted.")
        )

        return [
            TrendItem(
                id=request.get("request_id") or f"chainlink-{int(timestamp.timestamp())}",
                platform=self.platform,
                title=f"Chainlink Verification: {query[:120]}",
                content=details,
                author="Trende Chainlink Connector",
                author_handle="chainlink",
                url=f"https://sepolia.basescan.org/tx/{tx_hash}" if tx_hash else "https://functions.chain.link/base-sepolia",
                timestamp=timestamp,
                metrics={},
                raw_data=request,
            )
        ]

    async def fetch_verifiable_data(self, source_url: str, extraction_script: str) -> dict:
        """
        Submit a Chainlink Functions request and return request metadata.
        """
        print(f"🔗 Chainlink Functions: preparing request for '{source_url}'...")

        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if chainlink_service.is_configured() and self.subscription_id:
            try:
                tx_hash = await chainlink_service.send_functions_request(
                    source=extraction_script,
                    args=[source_url],
                    subscription_id=int(self.subscription_id),
                    don_id_hex=self.don_id,
                )
                if tx_hash:
                    print(f"✅ Chainlink request submitted on-chain: {tx_hash}")
                    return {
                        "status": "submitted",
                        "source_query": source_url,
                        "timestamp": timestamp,
                        "tx_hash": tx_hash,
                        "request_id": tx_hash,  # Async fulfillment makes tx hash the stable trace key here.
                        "network": "base-sepolia",
                    }
            except Exception as e:
                print(f"⚠️ Failed to submit Chainlink request: {e}")

        return {
            "status": "not_submitted",
            "source_query": source_url,
            "timestamp": timestamp,
            "tx_hash": None,
            "request_id": None,
            "reason": "missing_chainlink_configuration_or_submission_failed",
            "required_env": [
                "CHAINLINK_RPC_URL",
                "CHAINLINK_WALLET_PRIVATE_KEY",
                "CHAINLINK_CONSUMER_ADDRESS",
                "CHAINLINK_SUBSCRIPTION_ID",
            ],
        }

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
