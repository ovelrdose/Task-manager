Веб-приложение для учёта рабочих задач и автоматической генерации недельных отчётов в PDF на основе шаблона Word.

##  Возможности
- Добавление, редактирование и удаление задач с привязкой к дате
- Навигация по неделям через встроенный календарь
- Генерация PDF-отчётов через шаблон `.docx` + Jinja2
-  SQLite (не требует отдельного сервера БД)
##  Стек
| Слой              |              Технологии |
|------|------------|
| **Backend**       | FastAPI, SQLAlchemy, Pydantic, `docxtpl` |
| **Frontend**      | React 18, Vite, TailwindCSS, Axios |
| **База данных**   | SQLite |
| **Конвертация**   | LibreOffice (headless) |
| **Деплой**        | Docker Compose, Nginx (reverse proxy) |

-------------------------------
## Шаблон
Шаблон хранится в директории backend/templates/report_template.docx
{{ author }} - Имя сотрудника (из интерфейса)
{{ report_date }} - Дата генерации отчёта
{{ week }}, {{ year }} - Номер недели и год
{{ week_start }}, {{ week_end }} -Даты начала и конца недели
{% for task in tasks %} - Цикл по задачам за неделю
{{ task.title }}, {{ task.description }}, {{ task.date }} - Поля задачи
------------------------------
## Запуск
docker compose up -d --build
Либо
Запуск backend
cd backend
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

Запуск frontend
cd frontend
npm install
npm run dev

