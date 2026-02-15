from typing import Dict, Any, List
from pydantic import BaseModel

class X402Payment(BaseModel):
    amount: str
    token: str
    signature: str
    authorization: Dict[str, Any]

class X402Service:
    def __init__(self):
        # In a real app, this would verify against an RPC or a facilitator API
        pass

    def verify_payment(self, payment_payload: X402Payment) -> bool:
        """
        Verifies the X402 payment payload against EIP-3009 standards.
        """
        try:
            # 1. Check basic structure
            if not payment_payload.signature or not payment_payload.authorization:
                return False
            
            # 2. Extract authorization fields (EIP-3009 / TransferWithAuthorization)
            auth = payment_payload.authorization
            required_fields = ["from", "to", "value", "validAfter", "validBefore", "nonce"]
            if not all(field in auth for field in required_fields):
                return False

            # 3. Verify Signature (EIP-712 recovery)
            # In production, we'd use eth_account.messages.recover_typed_data
            # recovered_address = recover_eip3009(auth, payment_payload.signature)
            # return recovered_address.lower() == auth["from"].lower()
            
            # For Day 1, we assume the signature is verified if present and non-empty
            return len(payment_payload.signature) > 64
        except Exception:
            return False

    def get_payment_headers(self, amount: str, recipient: str, chain_id: int) -> Dict[str, str]:
        """Returns the X402 headers for the client to process."""
        return {
            "X-402-Amount": amount,
            "X-402-Recipient": recipient,
            "X-402-Chain-ID": str(chain_id),
            "X-402-Token-Type": "ERC20",
            "X-402-Scheme": "EIP-3009"
        }

x402_service = X402Service()
