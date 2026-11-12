# Образ для запуска GymLog
FROM python:3.12-slim

WORKDIR /app

# сначала ставим библиотеки, потом копируем код
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# порт можно поменять переменной PORT (некоторые хостинги задают её сами)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
