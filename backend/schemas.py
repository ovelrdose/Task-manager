from pydantic import BaseModel
from datetime import date

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    task_date: date

class Task(TaskCreate):
    id: int
    class Config:
        from_attributes = True

class ReportRequest(BaseModel):
    year: int
    week: int
    author: str