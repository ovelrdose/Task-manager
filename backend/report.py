import os
import subprocess
import shutil
from datetime import datetime
from docxtpl import DocxTemplate
from fastapi import HTTPException

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

def find_libreoffice_path():
    """Поиск LibreOffice на Windows"""
    # Стандартные пути установки
    possible_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        r"%LOCALAPPDATA%\LibreOffice\program\soffice.exe",
    ]
    
    for path in possible_paths:
        expanded = os.path.expandvars(path)
        if os.path.exists(expanded):
            return expanded
    
    # Попробуем найти через PATH
    if shutil.which("soffice"):
        return "soffice"
    if shutil.which("libreoffice"):
        return "libreoffice"
    
    return None

def generate_pdf(year: int, week: int, author: str, tasks: list, week_start: str = None, week_end: str = None) -> str:
    try:
        os.makedirs(TEMPLATE_DIR, exist_ok=True)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        template_path = os.path.join(TEMPLATE_DIR, "report_template.docx")
        print(f"🔍 Шаблон: {template_path} | Существует: {os.path.exists(template_path)}")
        
        if not os.path.exists(template_path):
            raise HTTPException(404, f"Шаблон не найден: {template_path}")

        tpl = DocxTemplate(template_path)
        context = {
            "report_date": datetime.now().strftime("%d.%m.%Y"),
            "author": author,
            "week": week,
            "year": year,
            "week_start": week_start or "01.01.2026",
            "week_end": week_end or "07.01.2026",
            "tasks": tasks
        }
        tpl.render(context)

        docx_filename = f"report_{year}_w{week}.docx"
        docx_path = os.path.join(OUTPUT_DIR, docx_filename)
        tpl.save(docx_path)

        # Поиск LibreOffice
        libreoffice_path = find_libreoffice_path()
        if not libreoffice_path:
            raise RuntimeError(
                "LibreOffice не найден!\n"
                "1. Скачайте с https://www.libreoffice.org/\n"
                "2. Установите с настройками по умолчанию\n"
                "3. Перезапустите терминал и сервер"
            )
        
        print(f"🔧 LibreOffice: {libreoffice_path}")
        
        # Конвертация
        cmd = [
            libreoffice_path,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", OUTPUT_DIR,
            docx_path
        ]
        
        print(f"🔄 Конвертирую: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            print(f"❌ STDOUT: {result.stdout}")
            print(f"❌ STDERR: {result.stderr}")
            raise RuntimeError(f"Ошибка конвертации: {result.stderr}")
        
        pdf_path = os.path.join(OUTPUT_DIR, docx_filename.replace(".docx", ".pdf"))
        if not os.path.exists(pdf_path):
            raise RuntimeError(f"PDF не создан: {pdf_path}")
            
        print(f"✅ Готово: {pdf_path}")
        return pdf_path
        
    except Exception as e:
        import traceback
        print(f"💥 ОШИБКА: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Ошибка генерации отчёта: {str(e)}")