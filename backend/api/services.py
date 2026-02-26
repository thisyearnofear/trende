"""
Service layer for API business logic.

This module provides service classes that encapsulate business logic
with clean dependencies, enabling proper separation of concerns.
"""

import datetime
from typing import Any

from backend.database.repository import Repository
from backend.api.helpers import parse_iso, normalize_key_parts
from shared.models import QueryStatus


class TaskService:
    """
    Service for task lifecycle management.
    
    Encapsulates task cache management and database operations,
    providing a clean interface for route handlers.
    """
    
    def __init__(self, repository: Repository | None = None) -> None:
        self._repo = repository or Repository()
        self._cache: dict[str, dict[str, Any]] = {}
    
    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """Get task from cache or Repository (source of truth)."""
        if task_id in self._cache:
            return self._cache[task_id]
        task = self._repo.get_task(task_id)
        if task:
            self._cache[task_id] = task
        return task
    
    def save_task(self, task_id: str, task: dict[str, Any]) -> None:
        """Save task to Repository (source of truth) and update cache."""
        self._repo.save_task(task_id, task)
        self._cache[task_id] = task
    
    def update_task(self, task_id: str, updates: dict[str, Any]) -> None:
        """Update task fields in Repository and cache."""
        task = self.get_task(task_id)
        if task:
            task.update(updates)
            self.save_task(task_id, task)
    
    def mark_task_failed(
        self, 
        task: dict[str, Any], 
        reason: str, 
        log_prefix: str = "❌"
    ) -> None:
        """Mark a task as failed with a reason."""
        task_id = task.get("task_id")
        task["status"] = QueryStatus.FAILED
        task["error"] = reason
        logs = task.get("logs", [])
        logs.append(f"{log_prefix}: {reason}")
        task["logs"] = logs[-200:]
        task["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if task_id:
            self.save_task(task_id, task)
    
    def find_matching_active_task(
        self,
        topic: str,
        platforms: list[str],
        models: list[str],
        augmentation: dict[str, str] | None = None,
    ) -> str | None:
        """
        Find an existing active task matching the given parameters.
        
        Used for task deduplication - returns task_id if found, None otherwise.
        """
        topic_key = (topic or "").strip().lower()
        platforms_key = normalize_key_parts(platforms)
        models_key = normalize_key_parts(models)
        augmentation = augmentation or {}
        augment_key = tuple(
            f"{k}:{str(v).strip().lower()}"
            for k, v in sorted((augmentation or {}).items())
        )
        active_statuses = {
            QueryStatus.PENDING,
            QueryStatus.PLANNING,
            QueryStatus.RESEARCHING,
            QueryStatus.PROCESSING,
            QueryStatus.ANALYZING,
        }
        now = datetime.datetime.now(datetime.timezone.utc)
        max_age = datetime.timedelta(minutes=20)
        
        for task_id in list(self._cache.keys()):
            task = self.get_task(task_id)
            if not task or task.get("status") not in active_statuses:
                continue
            task_topic = str(task.get("topic", "")).strip().lower()
            if task_topic != topic_key:
                continue
            if normalize_key_parts(task.get("platforms", []) or []) != platforms_key:
                continue
            if normalize_key_parts(task.get("models", []) or []) != models_key:
                continue
            task_augmentation = task.get("augmentation") or {}
            task_augment_key = tuple(
                f"{k}:{str(v).strip().lower()}"
                for k, v in sorted(task_augmentation.items())
            )
            if task_augment_key != augment_key:
                continue
            created_at = parse_iso(task.get("created_at")) or now
            if now - created_at > max_age:
                continue
            return task_id
        return None
    
    def get_all_tasks(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get all tasks from repository."""
        return self._repo.get_all_tasks(limit=limit)
    
    def get_public_research(self, limit: int = 50, sponsor: str | None = None) -> list[dict[str, Any]]:
        """Get public research from repository."""
        return self._repo.get_public_research(limit=limit, sponsor=sponsor)
    
    def get_saved_research(self, wallet_address: str, limit: int = 100) -> list[dict[str, Any]]:
        """Get saved research for a wallet address."""
        return self._repo.get_saved_research(wallet_address, limit=limit)
    
    def mark_task_saved(
        self,
        task_id: str,
        wallet_address: str,
        visibility: str,
        ipfs_cid: str | None,
        ipfs_uri: str | None,
        save_label: str | None,
        tags: list[str],
    ) -> dict[str, Any] | None:
        """Mark a task as saved."""
        return self._repo.mark_task_saved(
            task_id=task_id,
            wallet_address=wallet_address,
            visibility=visibility,
            ipfs_cid=ipfs_cid,
            ipfs_uri=ipfs_uri,
            save_label=save_label,
            tags=tags,
        )
    
    def create_action(
        self,
        action_id: str,
        action_type: str,
        task_id: str | None,
        caller_address: str | None,
        idempotency_key: str | None,
        input_payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Create a new action."""
        return self._repo.create_action(
            action_id=action_id,
            action_type=action_type,
            task_id=task_id,
            caller_address=caller_address,
            idempotency_key=idempotency_key,
            input_payload=input_payload,
        )
    
    def get_action(self, action_id: str) -> dict[str, Any] | None:
        """Get an action by ID."""
        return self._repo.get_action(action_id)
    
    def get_action_by_idempotency_key(self, idempotency_key: str) -> dict[str, Any] | None:
        """Get an action by idempotency key."""
        return self._repo.get_action_by_idempotency_key(idempotency_key)
    
    def get_actions_for_task(self, task_id: str) -> list[dict[str, Any]]:
        """Get all actions for a task."""
        return self._repo.get_actions_for_task(task_id)
    
    def update_action(
        self,
        action_id: str,
        status: str,
        result_payload: dict[str, Any] | None = None,
        error: str | None = None,
        started_at: datetime.datetime | None = None,
        completed_at: datetime.datetime | None = None,
    ) -> None:
        """Update an action's status."""
        self._repo.update_action(
            action_id=action_id,
            status=status,
            result_payload=result_payload,
            error=error,
            started_at=started_at,
            completed_at=completed_at,
        )
    
    def create_mission_event(
        self,
        event_id: str,
        event_name: str,
        payload: dict[str, Any],
        session_id: str | None,
        source: str,
        stage: str | None,
        wallet_address: str | None,
        client_ip: str,
        user_agent: str,
    ) -> dict[str, Any] | None:
        """Create a mission telemetry event."""
        return self._repo.create_mission_event(
            event_id=event_id,
            event_name=event_name,
            payload=payload,
            session_id=session_id,
            source=source,
            stage=stage,
            wallet_address=wallet_address,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    
    def get_mission_events(
        self,
        limit: int,
        session_id: str | None = None,
        event_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get mission telemetry events."""
        return self._repo.get_mission_events(
            limit=limit,
            session_id=session_id,
            event_name=event_name,
        )
