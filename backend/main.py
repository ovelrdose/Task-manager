from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from models import Task
from schemas import TaskCreate, Task as TaskSchema, ReportRequest
import report as report_module
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, status
from datetime import datetime, timedelta

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Task Report App", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В проде ограничьте до вашего домена
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/tasks/", response_model=TaskSchema)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    iso = task.task_date.isocalendar()  # (year, week, weekday)
    db_task = Task(**task.dict(), week_iso=iso[1], year_iso=iso[0])
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/tasks/", response_model=list[TaskSchema])
def get_tasks(year: int | None = None, week: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Task)
    if year and week:
        q = q.filter(Task.year_iso == year, Task.week_iso == week)
    return q.order_by(Task.task_date.asc()).all()

@app.get("/api/weeks/")
def get_weeks(db: Session = Depends(get_db)):
    weeks = db.query(Task.year_iso, Task.week_iso).distinct().order_by(Task.year_iso.desc(), Task.week_iso.desc()).all()
    return [{"year": w[0], "week": w[1]} for w in weeks]


def get_week_dates(year: int, week: int):
    """Возвращает даты начала и конца недели"""
    # Первый день года
    jan_first = datetime(year, 1, 1)
    # Сколько дней до первого понедельника
    days_until_monday = (0 - jan_first.weekday()) % 7
    if days_until_monday == 0 and jan_first.weekday() > 3:
        days_until_monday = 7
    first_monday = jan_first + timedelta(days=days_until_monday)
    # Начало нужной недели
    start_of_week = first_monday + timedelta(weeks=week - 1)
    end_of_week = start_of_week + timedelta(days=6)
    
    return start_of_week.strftime("%d.%m.%Y"), end_of_week.strftime("%d.%m.%Y")

@app.post("/api/report/")
async def generate_report(req: ReportRequest, db: Session = Depends(get_db)):
    print(f"📄 Запрос отчёта: year={req.year}, week={req.week}, author={req.author}")
    
    tasks = db.query(Task).filter(
        Task.year_iso == req.year, 
        Task.week_iso == req.week
    ).order_by(Task.task_date.asc()).all()
    
    print(f"📋 Найдено задач: {len(tasks)}")
    
    if not tasks:
        raise HTTPException(404, "Нет задач за выбранную неделю")

    week_start, week_end = get_week_dates(req.year, req.week)
    
    tasks_data = [
        {
            "date": t.task_date.strftime("%d.%m.%Y"), 
            "title": t.title, 
            "description": t.description or ""
        } 
        for t in tasks
    ]
    
    try:
        pdf_path = report_module.generate_pdf(
            req.year, 
            req.week, 
            req.author, 
            tasks_data,
            week_start,
            week_end
        )
        
        return FileResponse(
            pdf_path, 
            media_type="application/pdf", 
            filename=f"report_{req.year}_w{req.week}.pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{req.year}_w{req.week}.pdf"}
        )
    except Exception as e:
        print(f"💥 Ошибка в endpoint: {e}")
        raise

@app.put("/api/tasks/{task_id}", response_model=TaskSchema)
def update_task(task_id: int, task_update: TaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Обновляем только разрешённые поля
    for key, value in task_update.model_dump().items():
        setattr(db_task, key, value)
    
    # Пересчитываем неделю при смене даты
    iso = db_task.task_date.isocalendar()
    db_task.week_iso = iso[1]
    db_task.year_iso = iso[0]
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    db.delete(db_task)
    db.commit()
    return None