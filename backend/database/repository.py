from datetime import datetime, timezone
from typing import Any

from shared.config import get_settings

settings = get_settings()

try:
    from sqlalchemy import JSON, Column, DateTime, Float, String, create_engine
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
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
                "raw_findings": [
                    item.model_dump(mode="json") if hasattr(item, "model_dump") else item
                    for item in state.get("raw_findings", [])
                ],
            }
            task.result = result_data
            session.commit()

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
                    "created_at": t.created_at.isoformat(),
                }
                for t in tasks
            ]

    def get_public_research(
        self, limit: int = 50, sponsor: str | None = None
    ) -> list[dict[str, Any]]:
        """Get completed research for the public commons."""
        if not HAS_SQL or not self.Session:
            return []
        with self.Session() as session:
            query = session.query(TaskModel).filter(TaskModel.status == "completed")
            if sponsor:
                query = query.filter(TaskModel.sponsor_address == sponsor.lower())
            tasks = query.order_by(TaskModel.created_at.desc()).limit(limit).all()
            return [
                {
                    "task_id": t.task_id,
                    "topic": t.topic,
                    "status": t.status,
                    "sponsor_address": t.sponsor_address,
                    "platforms": t.platforms,
                    "created_at": t.created_at.isoformat(),
                    "has_attestation": bool(t.result and t.result.get("attestation_data")),
                }
                for t in tasks
            ]
