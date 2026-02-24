import datetime
import os
from typing import Any
import json

from shared.config import get_settings

settings = get_settings()

try:
    from sqlalchemy import JSON, Boolean, Column, DateTime, Float, String, create_engine, inspect, text
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker

    HAS_SQL = True
    Base = declarative_base()
except ImportError:
    HAS_SQL = False
    Base = object  # type: ignore

    # Mock components for environment without sqlalchemy
    def Column(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore

    def String(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore

    def JSON(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore
    
    def Boolean(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore

    def DateTime(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore

    def Float(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore

    def create_engine(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore
    
    def sessionmaker(*args: Any, **kwargs: Any) -> Any:
        return None  # type: ignore


class TaskModel(Base):  # type: ignore
    __tablename__ = "tasks"
    task_id = Column(String, primary_key=True)
    topic = Column(String)
    status = Column(String)
    logs = Column(JSON)
    result = Column(JSON)
    platforms = Column(JSON)
    models = Column(JSON, nullable=True)
    sponsor_address = Column(String, nullable=True)  # Wallet that funded this research
    owner_address = Column(String, nullable=True)  # Wallet that saved/claimed this research
    is_saved = Column(Boolean, default=False)
    visibility = Column(String, default="private")
    saved_at = Column(DateTime, nullable=True)
    ipfs_cid = Column(String, nullable=True)
    ipfs_uri = Column(String, nullable=True)
    save_label = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


class ActionModel(Base):  # type: ignore
    __tablename__ = "actions"
    action_id = Column(String, primary_key=True)
    action_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    task_id = Column(String, nullable=True)
    caller_address = Column(String, nullable=True)
    idempotency_key = Column(String, nullable=True, unique=True)
    input_payload = Column(JSON, nullable=False, default=dict)
    result_payload = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


if HAS_SQL:
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    engine = None
    SessionLocal = None


def init_db() -> None:
    if HAS_SQL and hasattr(Base, "metadata"):
        Base.metadata.create_all(bind=engine)  # type: ignore
        _migrate_task_columns()
        _migrate_action_columns()


def _migrate_task_columns() -> None:
    """Best-effort additive migration for legacy sqlite deployments."""
    if not HAS_SQL or engine is None:
        return
    with engine.begin() as conn:
        cols = {col["name"] for col in inspect(conn).get_columns("tasks")}
        migrations = [
            ("owner_address", "ALTER TABLE tasks ADD COLUMN owner_address VARCHAR"),
            ("is_saved", "ALTER TABLE tasks ADD COLUMN is_saved BOOLEAN DEFAULT 0"),
            ("visibility", "ALTER TABLE tasks ADD COLUMN visibility VARCHAR DEFAULT 'private'"),
            ("saved_at", "ALTER TABLE tasks ADD COLUMN saved_at DATETIME"),
            ("ipfs_cid", "ALTER TABLE tasks ADD COLUMN ipfs_cid VARCHAR"),
            ("ipfs_uri", "ALTER TABLE tasks ADD COLUMN ipfs_uri VARCHAR"),
            ("save_label", "ALTER TABLE tasks ADD COLUMN save_label VARCHAR"),
            ("tags", "ALTER TABLE tasks ADD COLUMN tags JSON"),
        ]
        for column_name, ddl in migrations:
            if column_name not in cols:
                conn.execute(text(ddl))


def _migrate_action_columns() -> None:
    """Best-effort additive migration for action table."""
    if not HAS_SQL or engine is None:
        return
    with engine.begin() as conn:
        tables = {t for t in inspect(conn).get_table_names()}
        if "actions" not in tables:
            return
        cols = {col["name"] for col in inspect(conn).get_columns("actions")}
        migrations = [
            ("caller_address", "ALTER TABLE actions ADD COLUMN caller_address VARCHAR"),
            ("idempotency_key", "ALTER TABLE actions ADD COLUMN idempotency_key VARCHAR"),
            ("input_payload", "ALTER TABLE actions ADD COLUMN input_payload JSON"),
            ("result_payload", "ALTER TABLE actions ADD COLUMN result_payload JSON"),
            ("error", "ALTER TABLE actions ADD COLUMN error VARCHAR"),
            ("started_at", "ALTER TABLE actions ADD COLUMN started_at DATETIME"),
            ("completed_at", "ALTER TABLE actions ADD COLUMN completed_at DATETIME"),
            ("updated_at", "ALTER TABLE actions ADD COLUMN updated_at DATETIME"),
        ]
        for column_name, ddl in migrations:
            if column_name not in cols:
                conn.execute(text(ddl))


class Repository:
    def __init__(self) -> None:
        if HAS_SQL:
            self.Session = SessionLocal
        else:
            print("Warning: SQLAlchemy not installed. Repository will operate in Mock mode.")
            self.Session = None

    def save_task(self, task_id: str, state: dict[str, Any]) -> None:
        if not HAS_SQL or not self.Session:
            return
        with self.Session() as session:
            task = session.query(TaskModel).filter(TaskModel.task_id == task_id).first()
            if not task:
                task = TaskModel(task_id=task_id)
                session.add(task)

            task.topic = state.get("topic")
            task.status = state.get("status")
            task.logs = state.get("logs", [])
            task.platforms = state.get("platforms", [])
            task.models = state.get("models", [])
            task.sponsor_address = state.get("sponsor_address")
            task.owner_address = state.get("owner_address", task.owner_address)
            task.is_saved = bool(state.get("is_saved", task.is_saved))
            task.visibility = state.get("visibility", task.visibility or "private")
            saved_at_value = state.get("saved_at", task.saved_at)
            if isinstance(saved_at_value, str):
                try:
                    saved_at_value = datetime.datetime.fromisoformat(saved_at_value)
                except ValueError:
                    saved_at_value = task.saved_at
            task.saved_at = saved_at_value
            task.ipfs_cid = state.get("ipfs_cid", task.ipfs_cid)
            task.ipfs_uri = state.get("ipfs_uri", task.ipfs_uri)
            task.save_label = state.get("save_label", task.save_label)
            task.tags = state.get("tags", task.tags)

            result_data = {
                "summary": state.get("summary"),
                "relevance_score": state.get("relevance_score"),
                "impact_score": state.get("impact_score"),
                "final_report_md": state.get("final_report_md"),
                "confidence_score": state.get("confidence_score"),
                "validation_results": state.get("validation_results", []),
                "meme_page_data": state.get("meme_page_data"),
                "consensus_data": state.get("consensus_data"),
                "attestation_data": state.get("attestation_data"),
                "run_telemetry": state.get("run_telemetry"),
                "raw_findings": self._serialize_findings(state.get("raw_findings", [])),
                "editorial_data": state.get("editorial_data"),
            }
            task.result = result_data
            try:
                session.commit()
            except Exception as e:
                print(f"Database commit failed: {e}")
                session.rollback()
                raise

    def _serialize_findings(self, findings):
        """Safely serialize findings to prevent JSON serialization errors."""
        serialized_findings = []
        for item in findings:
            try:
                if hasattr(item, "model_dump"):
                    # Pydantic model
                    serialized_item = item.model_dump(mode="json")
                elif hasattr(item, "__dict__"):
                    # Regular object
                    serialized_item = {k: v for k, v in item.__dict__.items() if not k.startswith('_')}
                else:
                    # Dictionary or other
                    serialized_item = item
                
                # Ensure all datetime objects are properly serialized
                serialized_item = self._ensure_serializable(serialized_item)
                serialized_findings.append(serialized_item)
            except Exception as e:
                print(f"Failed to serialize finding: {e}")
                # Create a minimal representation
                serialized_findings.append({
                    "id": getattr(item, "id", "unknown"),
                    "platform": getattr(item, "platform", "unknown"),
                    "title": getattr(item, "title", "unknown"),
                    "content": getattr(item, "content", "serialized_failed"),
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                })
        return serialized_findings
    
    def _ensure_serializable(self, obj):
        """Recursively ensure all datetime objects are properly serialized."""
        if isinstance(obj, dict):
            return {k: self._ensure_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._ensure_serializable(item) for item in obj]
        elif hasattr(obj, 'isoformat'):  # datetime objects
            return obj.isoformat()
        elif hasattr(obj, 'model_dump'):  # Pydantic models
            return self._ensure_serializable(obj.model_dump(mode="json"))
        else:
            return obj

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        with self.Session() as session:
            task = session.query(TaskModel).filter(TaskModel.task_id == task_id).first()
            if not task:
                return None
            return {
                "task_id": task.task_id,
                "topic": task.topic,
                "status": task.status,
                "logs": task.logs,
                "result": task.result,
                "platforms": task.platforms,
                "models": task.models,
                "sponsor_address": task.sponsor_address,
                "owner_address": task.owner_address,
                "is_saved": bool(task.is_saved),
                "visibility": task.visibility or "private",
                "saved_at": task.saved_at.isoformat() if task.saved_at else None,
                "ipfs_cid": task.ipfs_cid,
                "ipfs_uri": task.ipfs_uri,
                "save_label": task.save_label,
                "tags": task.tags or [],
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat()
                if task.updated_at
                else task.created_at.isoformat(),
            }

    def get_all_tasks(self, limit: int = 50) -> list[dict[str, Any]]:
        if not HAS_SQL or not self.Session:
            return []
        with self.Session() as session:
            tasks = (
                session.query(TaskModel).order_by(TaskModel.created_at.desc()).limit(limit).all()
            )
            return [
                {
                    "task_id": t.task_id,
                    "topic": t.topic,
                    "status": t.status,
                    "sponsor_address": t.sponsor_address,
                    "owner_address": t.owner_address,
                    "is_saved": bool(t.is_saved),
                    "visibility": t.visibility or "private",
                    "saved_at": t.saved_at.isoformat() if t.saved_at else None,
                    "ipfs_cid": t.ipfs_cid,
                    "ipfs_uri": t.ipfs_uri,
                    "save_label": t.save_label,
                    "tags": t.tags or [],
                    "created_at": t.created_at.isoformat(),
                }
                for t in tasks
            ]

    def mark_task_saved(
        self,
        task_id: str,
        wallet_address: str,
        visibility: str,
        ipfs_cid: str | None = None,
        ipfs_uri: str | None = None,
        save_label: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        normalized_wallet = wallet_address.lower()
        with self.Session() as session:
            task = session.query(TaskModel).filter(TaskModel.task_id == task_id).first()
            if not task:
                return None

            if task.owner_address and task.owner_address.lower() != normalized_wallet:
                raise PermissionError("Task already owned by another wallet.")

            task.owner_address = normalized_wallet
            task.is_saved = True
            task.visibility = visibility
            task.saved_at = datetime.datetime.now(datetime.timezone.utc)
            task.ipfs_cid = ipfs_cid
            task.ipfs_uri = ipfs_uri
            task.save_label = save_label
            task.tags = tags or []
            session.commit()

            return {
                "task_id": task.task_id,
                "owner_address": task.owner_address,
                "is_saved": bool(task.is_saved),
                "visibility": task.visibility,
                "saved_at": task.saved_at.isoformat() if task.saved_at else None,
                "ipfs_cid": task.ipfs_cid,
                "ipfs_uri": task.ipfs_uri,
                "save_label": task.save_label,
                "tags": task.tags or [],
            }

    def get_saved_research(
        self,
        wallet_address: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if not HAS_SQL or not self.Session:
            return []
        normalized_wallet = wallet_address.lower()
        with self.Session() as session:
            tasks = (
                session.query(TaskModel)
                .filter(TaskModel.owner_address == normalized_wallet)
                .filter(TaskModel.is_saved == True)  # noqa: E712
                .order_by(TaskModel.saved_at.desc(), TaskModel.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "task_id": t.task_id,
                    "topic": t.topic,
                    "status": t.status,
                    "platforms": t.platforms,
                    "created_at": t.created_at.isoformat(),
                    "saved_at": t.saved_at.isoformat() if t.saved_at else None,
                    "visibility": t.visibility or "private",
                    "ipfs_cid": t.ipfs_cid,
                    "ipfs_uri": t.ipfs_uri,
                    "save_label": t.save_label,
                    "tags": t.tags or [],
                    "has_attestation": bool(t.result and t.result.get("attestation_data")),
                }
                for t in tasks
            ]

    def get_public_research(
        self, limit: int = 50, sponsor: str | None = None
    ) -> list[dict[str, Any]]:
        """Get high-quality completed research for the public commons feed."""
        if not HAS_SQL or not self.Session:
            return []
        include_partial = os.getenv("COMMONS_INCLUDE_PARTIAL", "false").strip().lower() in {"1", "true", "yes"}
        min_findings = max(1, int(os.getenv("COMMONS_MIN_FINDINGS", "5")))
        allowed_sufficiency = {"healthy"}
        if include_partial:
            allowed_sufficiency.add("partial")

        with self.Session() as session:
            query = (
                session.query(TaskModel)
                .filter(TaskModel.status == "completed")
                .filter(TaskModel.visibility == "public")
            )
            if sponsor:
                query = query.filter(TaskModel.sponsor_address == sponsor.lower())
            # Pull a wider window first, then apply quality gate.
            candidates = query.order_by(TaskModel.created_at.desc()).limit(max(limit * 4, limit)).all()
            rows: list[dict[str, Any]] = []
            for t in candidates:
                result = t.result or {}
                telemetry = result.get("run_telemetry") or {}
                sufficiency = str(telemetry.get("data_sufficiency", "unknown")).strip().lower()
                findings_count = int(telemetry.get("findings_count") or 0)
                if sufficiency not in allowed_sufficiency:
                    continue
                if findings_count < min_findings:
                    continue
                rows.append(
                    {
                        "task_id": t.task_id,
                        "topic": t.topic,
                        "status": t.status,
                        "sponsor_address": t.sponsor_address,
                        "platforms": t.platforms,
                        "created_at": t.created_at.isoformat(),
                        "has_attestation": bool(result.get("attestation_data")),
                    }
                )
                if len(rows) >= limit:
                    break
            return rows

    def create_action(
        self,
        action_id: str,
        action_type: str,
        task_id: str | None = None,
        caller_address: str | None = None,
        idempotency_key: str | None = None,
        input_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        with self.Session() as session:
            action = ActionModel(
                action_id=action_id,
                action_type=action_type,
                status="queued",
                task_id=task_id,
                caller_address=caller_address.lower() if caller_address else None,
                idempotency_key=idempotency_key,
                input_payload=input_payload or {},
            )
            session.add(action)
            session.commit()
            return self._serialize_action(action)

    def update_action(
        self,
        action_id: str,
        *,
        status: str | None = None,
        result_payload: dict[str, Any] | None = None,
        error: str | None = None,
        started_at: str | datetime.datetime | None = None,
        completed_at: str | datetime.datetime | None = None,
    ) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        with self.Session() as session:
            action = session.query(ActionModel).filter(ActionModel.action_id == action_id).first()
            if not action:
                return None
            if status:
                action.status = status
            if result_payload is not None:
                action.result_payload = result_payload
            if error is not None:
                action.error = error
            if started_at is not None:
                action.started_at = self._coerce_datetime(started_at)
            if completed_at is not None:
                action.completed_at = self._coerce_datetime(completed_at)
            action.updated_at = datetime.datetime.now(datetime.timezone.utc)
            session.commit()
            return self._serialize_action(action)

    def get_action(self, action_id: str) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        with self.Session() as session:
            action = session.query(ActionModel).filter(ActionModel.action_id == action_id).first()
            if not action:
                return None
            return self._serialize_action(action)

    def get_action_by_idempotency_key(self, idempotency_key: str) -> dict[str, Any] | None:
        if not HAS_SQL or not self.Session:
            return None
        with self.Session() as session:
            action = (
                session.query(ActionModel)
                .filter(ActionModel.idempotency_key == idempotency_key)
                .order_by(ActionModel.created_at.desc())
                .first()
            )
            if not action:
                return None
            return self._serialize_action(action)

    def _coerce_datetime(
        self, value: str | datetime.datetime | None
    ) -> datetime.datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime.datetime):
            return value
        try:
            return datetime.datetime.fromisoformat(value)
        except ValueError:
            return None

    def _serialize_action(self, action: ActionModel) -> dict[str, Any]:
        return {
            "action_id": action.action_id,
            "action_type": action.action_type,
            "status": action.status,
            "task_id": action.task_id,
            "caller_address": action.caller_address,
            "idempotency_key": action.idempotency_key,
            "input_payload": action.input_payload or {},
            "result_payload": action.result_payload,
            "error": action.error,
            "created_at": action.created_at.isoformat() if action.created_at else None,
            "started_at": action.started_at.isoformat() if action.started_at else None,
            "completed_at": action.completed_at.isoformat() if action.completed_at else None,
            "updated_at": action.updated_at.isoformat() if action.updated_at else None,
        }
