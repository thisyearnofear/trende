import asyncio
import json
import os
import sys
from pathlib import Path

# Add root directory to sys.path to allow imports from backend and shared
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

from dotenv import load_dotenv
from backend.agents.workflow import create_workflow
from shared.models import QueryStatus

# Ensure we load .env from the root
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

async def run_test(topic: str):
    print(f"\n🚀 Starting live research for topic: {topic}")
    print(f"📂 Loading environment from: {env_path.absolute()}")
    print(f"🔑 VENICE_API_KEY present: {'Yes' if os.getenv('VENICE_API_KEY') else 'No'}")
    print(f"🔑 AISA_API_KEY present: {'Yes' if os.getenv('AISA_API_KEY') else 'No'}")
    print("-" * 50)
    
    workflow = create_workflow()
    
    initial_state = {
        "topic": topic,
        "platforms": ["twitter", "news", "web", "linkedin"],
        "query_id": "test_run_" + os.urandom(4).hex(),
        "status": QueryStatus.PENDING,
        "logs": ["Test run initialized."],
        "created_at": "2026-02-16T00:50:00Z",
        "raw_findings": [],
        "filtered_findings": [],
        "plan": None,
        "search_queries": [],
        "summary": None,
        "final_report_md": None,
        "relevance_score": 0.0,
        "impact_score": 0.0,
        "confidence_score": 0.0,
        "validation_results": [],
        "error": None
    }
    
    current_logs = set()
    
    async for output in workflow.astream(initial_state):
        for node_name, state_update in output.items():
            print(f"\n📍 Node: {node_name}")
            
            # Print new logs
            if "logs" in state_update:
                for log in state_update["logs"]:
                    if log not in current_logs:
                        print(f"   📝 {log}")
                        current_logs.add(log)
            
            # Special print for specific updates
            if "confidence_score" in state_update:
                print(f"   ⚖️ Confidence Score: {state_update.get('confidence_score', 'N/A')}")
            
            if "consensus_data" in state_update:
                c_data = state_update["consensus_data"]
                print(f"   🏛️ Consensus Providers: {', '.join(c_data.get('providers', []))}")
                print(f"   ⚖️ Agreement Score: {c_data.get('agreement_score', 0.0)}")
                
                pillars = c_data.get("pillars", [])
                if pillars:
                    print("   🔗 Consensus Pillars:")
                    for p in pillars:
                        print(f"      • {p}")
                
                anomalies = c_data.get("anomalies", [])
                if anomalies:
                    print("   ❓ Fringe Anomalies:")
                    for a in anomalies:
                        print(f"      • {a}")
            
            if "final_report_md" in state_update and state_update["final_report_md"]:
                print("\n✅ Final Report Generated!")
                print("-" * 50)
                report = state_update["final_report_md"]
                # Print the first 1500 chars of the report
                print(report[:1500] + ("..." if len(report) > 1500 else ""))
            elif state_update.get("status") == QueryStatus.FAILED:
                print(f"\n❌ Task Failed: {state_update.get('error', 'Unknown Error')}")

if __name__ == "__main__":
    import sys
    topic = sys.argv[1] if len(sys.argv) > 1 else "Evolution of AI Agents in Decentralized Finance"
    asyncio.run(run_test(topic))
