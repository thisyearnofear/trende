import os
from typing import Optional

from web3 import Web3
from eth_account import Account


CHAIN_CONFIG = {
    "base-sepolia": {
        "don_id": "0x66756e2d626173652d7365706f6c69612d310000000000000000000000000000",
        "chain_id": 84532,
        "explorer": "https://sepolia.basescan.org",
    },
    "arbitrum-sepolia": {
        "don_id": "0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000",
        "chain_id": 421614,
        "explorer": "https://sepolia.arbiscan.io",
    },
}


class ChainlinkService:
    def __init__(self):
        self.private_key = os.getenv("CHAINLINK_WALLET_PRIVATE_KEY")
        self.active_chain = os.getenv("CHAINLINK_ACTIVE_CHAIN", "base-sepolia")

        # Primary chain config
        self.rpc_url = os.getenv("CHAINLINK_RPC_URL")
        self.consumer_address = (
            os.getenv("CHAINLINK_CONSUMER_ADDRESS")
            or os.getenv("NEXT_PUBLIC_TRENDE_CONSUMER_ADDRESS")
        )
        self.oracle_address = (
            os.getenv("CHAINLINK_ORACLE_ADDRESS")
            or os.getenv("NEXT_PUBLIC_TRENDE_ORACLE_ADDRESS")
        )

        if self.rpc_url:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if self.private_key:
                self.account = Account.from_key(self.private_key)
            else:
                self.account = None
        else:
            self.w3 = None
            self.account = None

        # Minimal ABIs for interaction
        self.consumer_abi = [
            {
                "inputs": [
                    {"internalType": "string", "name": "source", "type": "string"},
                    {"internalType": "bytes", "name": "encryptedSecretsUrls", "type": "bytes"},
                    {"internalType": "uint8", "name": "donationAmount", "type": "uint8"},
                    {"internalType": "string[]", "name": "args", "type": "string[]"},
                    {"internalType": "uint64", "name": "subscriptionId", "type": "uint64"},
                    {"internalType": "uint32", "name": "callbackGasLimit", "type": "uint32"},
                    {"internalType": "bytes32", "name": "donId", "type": "bytes32"}
                ],
                "name": "sendRequest",
                "outputs": [{"internalType": "bytes32", "name": "requestId", "type": "bytes32"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "bytes32", "name": "requestId", "type": "bytes32"},
                    {"indexed": False, "internalType": "bytes", "name": "response", "type": "bytes"},
                    {"indexed": False, "internalType": "bytes", "name": "err", "type": "bytes"}
                ],
                "name": "Response",
                "type": "event"
            }
        ]

        self.oracle_abi = [
            {
                "inputs": [
                    {"internalType": "string", "name": "topic", "type": "string"},
                    {"internalType": "uint256", "name": "duration", "type": "uint256"}
                ],
                "name": "createMarket",
                "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "bytes32", "name": "marketId", "type": "bytes32"},
                    {"internalType": "string", "name": "source", "type": "string"},
                    {"internalType": "bytes", "name": "encryptedSecretsUrls", "type": "bytes"}
                ],
                "name": "resolveMarket",
                "outputs": [{"internalType": "bytes32", "name": "requestId", "type": "bytes32"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "bytes32", "name": "marketId", "type": "bytes32"},
                    {"indexed": False, "internalType": "string", "name": "topic", "type": "string"},
                    {"indexed": False, "internalType": "uint256", "name": "endTime", "type": "uint256"}
                ],
                "name": "MarketCreated",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "bytes32", "name": "marketId", "type": "bytes32"},
                    {"indexed": False, "internalType": "uint256", "name": "score", "type": "uint256"},
                    {"indexed": False, "internalType": "string", "name": "summary", "type": "string"}
                ],
                "name": "MarketResolved",
                "type": "event"
            }
        ]

    @property
    def chain_info(self) -> dict:
        return CHAIN_CONFIG.get(self.active_chain, CHAIN_CONFIG["base-sepolia"])

    def is_configured(self) -> bool:
        return bool(
            self.w3
            and self.w3.is_connected()
            and self.account
            and self.consumer_address
        )

    async def send_functions_request(
        self,
        source: str,
        args: list[str],
        subscription_id: int,
        don_id_hex: Optional[str] = None,
    ) -> Optional[str]:
        """
        Sends a Chainlink Functions request to the TrendeFunctionsConsumer contract.
        Uses the active chain's DON ID by default.
        Returns the transaction hash.
        """
        if don_id_hex is None:
            don_id_hex = self.chain_info["don_id"]
        if not self.is_configured():
            print("⚠️ ChainlinkService not configured. Skipping request.")
            return None

        try:
            contract = self.w3.eth.contract(
                address=self.consumer_address, abi=self.consumer_abi
            )

            # Prepare transaction
            nonce = self.w3.eth.get_transaction_count(self.account.address)

            # Build transaction
            tx = contract.functions.sendRequest(
                source,
                b"",  # No secrets for this integration yet
                0,    # donationAmount (unused)
                args,
                subscription_id,
                300000,  # Gas limit for callback
                don_id_hex
            ).build_transaction({
                'chainId': self.w3.eth.chain_id,
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })

            # Sign and send
            signed_tx = self.w3.eth.account.sign_transaction(
                tx, private_key=self.private_key
            )
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)

            print(f"🔗 Chainlink Request Sent! Tx Hash: {self.w3.to_hex(tx_hash)}")
            return self.w3.to_hex(tx_hash)

        except Exception as e:
            print(f"❌ Chainlink Request Failed: {e}")
            return None

    async def create_market(self, topic: str, duration_seconds: int = 86400) -> Optional[str]:
        """
        Creates a new prediction market on the TrendeOracle contract.
        Returns the transaction hash.
        """
        if not self.is_configured() or not self.oracle_address:
            print("⚠️ ChainlinkService or Oracle address not configured. Skipping market creation.")
            return None

        try:
            contract = self.w3.eth.contract(
                address=self.oracle_address, abi=self.oracle_abi
            )
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = contract.functions.createMarket(
                topic, duration_seconds
            ).build_transaction({
                'chainId': self.w3.eth.chain_id,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            print(f"🏛️ Market Created! Tx Hash: {self.w3.to_hex(tx_hash)}")
            return self.w3.to_hex(tx_hash)
        except Exception as e:
            print(f"❌ Market Creation Failed: {e}")
            return None

    async def resolve_market(self, market_id_hex: str, js_source: str) -> Optional[str]:
        """
        Submits a resolution request for a market on TrendeOracle.
        Returns the transaction hash.
        """
        if not self.is_configured() or not self.oracle_address:
            print("⚠️ ChainlinkService or Oracle address not configured. Skipping market resolution.")
            return None

        try:
            contract = self.w3.eth.contract(
                address=self.oracle_address, abi=self.oracle_abi
            )
            
            # Ensure hex format for market_id
            if market_id_hex.startswith("0x"):
                market_id_bytes = self.w3.to_bytes(hexstr=market_id_hex)
            else:
                market_id_bytes = self.w3.to_bytes(hexstr="0x" + market_id_hex)

            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = contract.functions.resolveMarket(
                market_id_bytes,
                js_source,
                b""  # secrets
            ).build_transaction({
                'chainId': self.w3.eth.chain_id,
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            print(f"⚖️ Market Resolution Requested! Tx Hash: {self.w3.to_hex(tx_hash)}")
            return self.w3.to_hex(tx_hash)
        except Exception as e:
            print(f"❌ Market Resolution Request Failed: {e}")
            return None

chainlink_service = ChainlinkService()
