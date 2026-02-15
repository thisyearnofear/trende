from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from datetime import datetime
from backend.agents.workflow import create_workflow
from shared.models import QueryStatus, TrendItem
from backend.services.x402_service import x402_service, X402Payment
from backend.database.repository import Repository, init_db

app = FastAPI(title="Trende Agent API")

# Initialize DB on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    # Resume interrupted tasks
    await resume_interrupted_tasks()

async def resume_interrupted_tasks():
    # Only resume if they are in a processing state
    unfinished = [t for t in repo.get_all_tasks(limit=100) if t['status'] not in [QueryStatus.COMPLETED, QueryStatus.FAILED]]
    for t in unfinished:
        # Load full state
        full_task = repo.get_task(t['task_id'])
        if full_task:
            tasks[t['task_id']] = full_task
            # Restart agent loop in background
            asyncio.create_task(run_agent_workflow(t['task_id'], full_task['topic'], full_task['platforms']))
            print(f"Resumed task: {t['task_id']}")

repo = Repository()

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
        "task_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": [],
        "result": None,
        "topic": request.topic,
        "platforms": request.platforms,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Save to DB
    repo.save_task(task_id, tasks[task_id])
    
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
        "created_at": tasks[task_id]["created_at"],
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
            
            # Persist update to DB
            repo.save_task(task_id, tasks[task_id])

@app.get("/api/trends/status/{task_id}")
async def get_status(task_id: str):
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))
    return task

@app.get("/api/trends/{task_id}")
async def get_task_results(task_id: str):
    """Returns the full task results in the format expected by the frontend."""
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))
    
    # Normalize result extraction (Handle both memory state and DB state)
    res_node = task.get("result") if isinstance(task.get("result"), dict) else task
    
    # Transform raw items into TrendResult objects
    items_by_platform = {}
    for item in res_node.get("raw_findings", []):
        platform = item.get("platform", "web")
        if platform not in items_by_platform:
            items_by_platform[platform] = []
        items_by_platform[platform].append(item)
    
    results = []
    for platform, items in items_by_platform.items():
        results.append({
            "queryId": task_id,
            "platform": platform,
            "items": items,
            "relevanceScore": res_node.get("relevance_score", 0.0),
            "totalFetched": len(items),
            "processingTimeMs": 0 # TODO: Track this
        })

    # Construct response matching ResultsResponse in frontend/lib/types.ts
    return {
        "query": {
            "id": task_id,
            "idea": task.get("topic", ""),
            "platforms": task.get("platforms", []),
            "status": task.get("status", "pending"),
            "createdAt": task.get("created_at", ""),
            "updatedAt": task.get("updated_at", ""),
            "errorMessage": task.get("error"),
            "totalResults": len(res_node.get("raw_findings", [])),
            "relevanceThreshold": 0.5
        },
        "results": results,
        "summary": {
            "overview": res_node.get("summary", ""),
            "keyThemes": [], # TODO: Extract from report
            "topTrends": [], # TODO: Extract from report
            "sentiment": "neutral",
            "confidenceScore": res_node.get("confidence_score", 0.0),
            "validationResults": res_node.get("validation_results", []),
            "finalReportMd": res_node.get("final_report_md", ""),
            "generatedAt": task.get("updated_at", "")
        }
    }

@app.get("/api/trends/history")
async def get_history():
    """Returns a list of all past queries."""
    return repo.get_all_tasks()

@app.get("/api/trends/stream/{task_id}")
async def stream_status(task_id: str):
    async def event_generator():
        while True:
            if task_id not in tasks:
                yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                break
            
            state = tasks[task_id]
            
            # Estimate progress based on current status/logs
            progress = 0
            if state["status"] == QueryStatus.PENDING: progress = 10
            elif state["status"] == QueryStatus.PLANNING: progress = 25
            elif state["status"] == QueryStatus.RESEARCHING: progress = 50
            elif state["status"] == QueryStatus.ANALYZING: progress = 90
            elif state["status"] == QueryStatus.COMPLETED: progress = 100
            
            state["progress"] = progress
            yield f"data: {json.dumps(state)}\n\n"
            
            if state["status"] in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                break
                
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
