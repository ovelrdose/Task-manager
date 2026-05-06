FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-calc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p output data templates
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]