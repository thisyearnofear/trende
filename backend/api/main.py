from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from backend.agents.workflow import create_workflow
from shared.models.models import QueryStatus
from backend.services.x402_service import x402_service, X402Payment

# Simple in-memory task store (should move to Redis/DB later)
tasks = {}

class QueryRequest(BaseModel):
    topic: str
    platforms: List[str] = ["twitter", "news", "linkedin"]

@app.post("/api/trends/start")
async def start_analysis(request: QueryRequest, background_tasks: BackgroundTasks, response: Response, payment: Optional[X402Payment] = None):
    # If no payment is provided, return 402 Payment Required with X402 headers
    if not payment:
        headers = x402_service.get_payment_headers("0.1", "0xYourWalletAddress", 8453) # Base chain
        for k, v in headers.items():
            response.headers[k] = v
        return Response(status_code=402, content="Payment Required")

    # Verify real payment
    if not x402_service.verify_payment(payment):
        return Response(status_code=403, content="Invalid Payment")

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": QueryStatus.PENDING,
        "logs": [],
        "result": None
    }
    
    background_tasks.add_task(run_agent_workflow, task_id, request.topic, request.platforms)
    
    return {"task_id": task_id}

async def run_agent_workflow(task_id: str, topic: str, platforms: List[str]):
    workflow = create_workflow()
    initial_state = {
        "topic": topic,
        "platforms": platforms,
        "query_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": ["Task initialized."],
        "raw_findings": [],
        "filtered_findings": [],
        "plan": None,
        "search_queries": [],
        "summary": None,
        "final_report_md": None,
        "relevance_score": 0.0,
        "impact_score": 0.0,
        "error": None
    }
    
    # Run the graph
    async for output in workflow.astream(initial_state):
        for node_name, state_update in output.items():
            # Update the global task state with the latest changes from the agent
            for key, value in state_update.items():
                tasks[task_id][key] = value
            
            # Log the node completion
            if "logs" not in tasks[task_id]:
                tasks[task_id]["logs"] = []
            tasks[task_id]["logs"].append(f"Completed step: {node_name}")

@app.get("/api/trends/status/{task_id}")
async def get_status(task_id: str):
    if task_id not in tasks:
        return {"error": "Task not found"}, 404
    return tasks[task_id]

@app.get("/api/trends/stream/{task_id}")
async def stream_status(task_id: str):
    async def event_generator():
        while True:
            if task_id not in tasks:
                yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                break
            
            state = tasks[task_id]
            yield f"data: {json.dumps(state)}\n\n"
            
            if state["status"] in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                break
                
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
