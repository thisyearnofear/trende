try:
    from sqlalchemy import Column, String, JSON, DateTime, Float, create_engine
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker
    HAS_SQL = True
except ImportError:
    HAS_SQL = False

from datetime import datetime
import json
from shared.config import get_settings

settings = get_settings()

if HAS_SQL:
    Base = declarative_base()
    class TaskModel(Base):
        __tablename__ = "tasks"
        task_id = Column(String, primary_key=True)
        topic = Column(String)
        status = Column(String)
        logs = Column(JSON)
        result = Column(JSON)
        platforms = Column(JSON)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    if HAS_SQL:
        Base.metadata.create_all(bind=engine)

class Repository:
    def __init__(self):
        if HAS_SQL:
            self.Session = SessionLocal
        else:
            print("Warning: SQLAlchemy not installed. Repository will operate in Mock mode.")
            self.Session = None

    def save_task(self, task_id: str, state: dict):
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
            
            result_data = {
                "summary": state.get("summary"),
                "relevance_score": state.get("relevance_score"),
                "impact_score": state.get("impact_score"),
                "final_report_md": state.get("final_report_md"),
                "raw_findings": [item.model_dump() if hasattr(item, 'model_dump') else item for item in state.get("raw_findings", [])]
            }
            task.result = result_data
            session.commit()

    def get_task(self, task_id: str) -> dict:
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
                "created_at": task.created_at.isoformat()
            }

    def get_all_tasks(self, limit: int = 50):
        if not HAS_SQL or not self.Session:
            return []
        with self.Session() as session:
            tasks = session.query(TaskModel).order_by(TaskModel.created_at.desc()).limit(limit).all()
            return [
                {
                    "task_id": t.task_id,
                    "topic": t.topic,
                    "status": t.status,
                    "created_at": t.created_at.isoformat()
                }
                for t in tasks
            ]
