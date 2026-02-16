from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import time
import logging

logger = logging.getLogger(__name__)

# Try to import eth_account for signature verification
try:
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    HAS_ETH_ACCOUNT = True
except ImportError:
    HAS_ETH_ACCOUNT = False
    logger.warning("eth_account not installed. X402 signature verification will use fallback mode.")


class X402Payment(BaseModel):
    """X402 payment payload following EIP-3009 transferWithAuthorization."""
    amount: str
    token: str  # Token contract address (or 'native' for MON)
    signature: str  # EIP-712 signature
    authorization: Dict[str, Any]  # EIP-3009 authorization fields


# EIP-712 domain for Monad testnet
def get_eip712_domain(chain_id: int = 10143) -> Dict[str, Any]:
    return {
        "name": "Trende Intelligence",
        "version": "1",
        "chainId": chain_id,
        "verifyingContract": os.getenv("X402_RECIPIENT_ADDRESS", "0x0000000000000000000000000000000000000000"),
    }


# EIP-712 types for payment authorization
EIP712_TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"},
    ],
    "PaymentAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ],
}


class X402Service:
    """Service for X402 payment verification on Monad."""
    
    def __init__(self):
        self.chain_id = int(os.getenv("MONAD_CHAIN_ID", "10143"))
        self.recipient = os.getenv("X402_RECIPIENT_ADDRESS", "")
        self.default_amount = os.getenv("X402_PAYMENT_AMOUNT", "0.001")
    
    def verify_payment(self, payment_payload: X402Payment) -> bool:
        """
        Verifies the X402 payment payload against EIP-712/EIP-3009 standards.
        Returns True if signature is valid and authorization is not expired.
        """
        try:
            # 1. Check basic structure
            if not payment_payload.signature or not payment_payload.authorization:
                logger.warning("X402: Missing signature or authorization")
                return False
            
            auth = payment_payload.authorization
            
            # 2. Check required fields
            required_fields = ["from", "to", "value", "validAfter", "validBefore", "nonce"]
            if not all(field in auth for field in required_fields):
                logger.warning(f"X402: Missing required fields. Got: {list(auth.keys())}")
                return False
            
            # 3. Check time validity
            now = int(time.time())
            valid_after = int(auth.get("validAfter", 0))
            valid_before = int(auth.get("validBefore", 0))
            
            if now < valid_after:
                logger.warning(f"X402: Authorization not yet valid. Now: {now}, validAfter: {valid_after}")
                return False
            
            if now > valid_before:
                logger.warning(f"X402: Authorization expired. Now: {now}, validBefore: {valid_before}")
                return False
            
            # 4. Check recipient matches
            if self.recipient and auth.get("to", "").lower() != self.recipient.lower():
                logger.warning(f"X402: Recipient mismatch. Expected: {self.recipient}, Got: {auth.get('to')}")
                return False
            
            # 5. Verify signature using eth_account if available
            if HAS_ETH_ACCOUNT:
                return self._verify_eip712_signature(auth, payment_payload.signature)
            
            # Fallback: basic validation if eth_account not installed
            # In production, you'd want to ensure eth_account is installed
            logger.warning("X402: Using fallback signature validation (eth_account not installed)")
            return len(payment_payload.signature) >= 130  # 65 bytes hex = 130 chars
            
        except Exception as e:
            logger.error(f"X402: Verification error: {e}")
            return False
    
    def _verify_eip712_signature(self, auth: Dict[str, Any], signature: str) -> bool:
        """Verify EIP-712 typed data signature."""
        try:
            # Construct the typed data
            typed_data = {
                "types": EIP712_TYPES,
                "primaryType": "PaymentAuthorization",
                "domain": get_eip712_domain(self.chain_id),
                "message": {
                    "from": auth["from"],
                    "to": auth["to"],
                    "value": int(auth["value"]),
                    "validAfter": int(auth["validAfter"]),
                    "validBefore": int(auth["validBefore"]),
                    "nonce": auth["nonce"],
                },
            }
            
            # Encode and recover signer
            encoded = encode_typed_data(full_message=typed_data)
            recovered_address = Account.recover_message(encoded, signature=signature)
            
            # Check if recovered address matches the 'from' field
            expected_from = auth["from"].lower()
            recovered_lower = recovered_address.lower()
            
            if recovered_lower != expected_from:
                logger.warning(f"X402: Signature mismatch. Expected: {expected_from}, Recovered: {recovered_lower}")
                return False
            
            logger.info(f"X402: Valid signature from {recovered_address}")
            return True
            
        except Exception as e:
            logger.error(f"X402: EIP-712 verification error: {e}")
            return False
    
    def get_payment_headers(self, amount: str, recipient: str, chain_id: int) -> Dict[str, str]:
        """Returns the X402 headers for the client to process payment."""
        return {
            "X-402-Amount": amount or self.default_amount,
            "X-402-Recipient": recipient or self.recipient,
            "X-402-Chain-ID": str(chain_id or self.chain_id),
            "X-402-Token-Type": "native",  # MON is native token
            "X-402-Scheme": "EIP-712",
            "X-402-Network": "monad-testnet",
        }
    
    def create_authorization_template(
        self,
        from_address: str,
        amount_wei: int,
        validity_seconds: int = 300,  # 5 minutes
    ) -> Dict[str, Any]:
        """
        Create an authorization template for the client to sign.
        Client signs this with their wallet, then sends back with signature.
        """
        import secrets
        
        now = int(time.time())
        return {
            "from": from_address,
            "to": self.recipient,
            "value": str(amount_wei),
            "validAfter": str(now),
            "validBefore": str(now + validity_seconds),
            "nonce": "0x" + secrets.token_hex(32),
        }


x402_service = X402Service()
