
import asyncio
import os
import sys
import json

# Setup path to include project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from backend.services.ai_service import ai_service
from backend.services.attestation_service import attestation_service

async def main():
    print("🧪 Testing Trende Consensus & TEE Attestation Core...")
    
    # 1. Check Attestation Service Health
    print("\n[Stage 1] Checking Attestation Service...")
    health = await attestation_service.health_check(probe=True)
    print(f"Status: {health.get('status')}")
    print(f"Message: {health.get('message')}")
    
    if health.get('ok'):
        print("✅ Attestation service is ready.")
    else:
        print("⚠️ Attestation service is degraded. Check your EIGEN_ATTEST_URL or provider settings.")

    # 2. Test Parallel Consensus Extraction
    print("\n[Stage 2] Submitting Query to Multi-Model Consensus Engine...")
    query = "Future of EigenCloud and Verifiable Agents"
    
    # We'll use a smaller set of models for speed during test
    providers = ["venice", "aisa"] # Venice and AIsa (GPT-4o)
    
    try:
        print(f"Query: '{query}'")
        print(f"Consulting providers: {providers}")
        
        bundle = await ai_service.get_consensus_bundle(
            prompt=f"Provide a brief analysis of the following topic: {query}",
            system_prompt="You are a neutral research assistant.",
            providers=providers
        )
        
        print("\n--- CONSENSUS REPORT ---")
        print(bundle.get("consensus_report", "NO REPORT GENERATED")[:500] + "...")
        print("-" * 23)
        
        print(f"\nAgreement Score: {bundle.get('agreement_score')}")
        print(f"Diversity Level: {bundle.get('diversity_level')}")
        print(f"Providers Responded: {', '.join(bundle.get('providers', []))}")
        
        # 3. Verify TEE Attestation
        print("\n[Stage 3] Verifying TEE Attestation Payload...")
        attestation = bundle.get("attestation")
        if attestation and attestation.get("status") == "signed":
            print("✅ Attestation received and signed.")
            print(f"Attestation ID: {attestation.get('attestation_id')}")
            print(f"Provider: {attestation.get('provider')}")
            
            # Verify the signature locally
            is_valid = attestation_service.verify(attestation.get("payload", {}), attestation)
            print(f"Integrity Verification: {'PASSED' if is_valid else 'FAILED'}")
        else:
            print("❌ No valid attestation received.")
            if attestation and attestation.get("error"):
                print(f"Error: {attestation.get('error')}")

    except Exception as e:
        print(f"❌ Error during consensus test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
