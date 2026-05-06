from sqlalchemy import Column, Integer, String, Date
from database import Base

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, default="")
    task_date = Column(Date)
    week_iso = Column(Integer)
    year_iso = Column(Integer)