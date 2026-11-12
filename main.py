# Сервер GymLog на FastAPI
# Запуск: uvicorn main:app --reload

import os
import secrets
import sqlite3
from datetime import date
from typing import Optional

import bcrypt
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from database import create_database, get_connection

app = FastAPI(title="GymLog")

# ключ, которым подписывается cookie с сессией, берётся из переменной окружения
# если переменной нет (локальный запуск), создаётся случайный ключ
SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# при запуске создаём таблицы и заполняем упражнения
create_database()


# ---------- данные, которые приходят от браузера ----------

class RegisterData(BaseModel):
    name: str
    email: str
    password: str


class LoginData(BaseModel):
    email: str
    password: str


class RecordData(BaseModel):
    exercise_id: int
    date: str
    sets: int
    reps: int
    weight: Optional[float] = None


# возвращает пользователя, который сейчас вошёл, или ошибку 401
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")

    conn = get_connection()
    user = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if user is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    return user


# ---------- упражнения ----------

@app.get("/api/exercises")
def get_exercises():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM exercises ORDER BY id").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM exercises WHERE id = ?", (exercise_id,)).fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Упражнение не найдено")
    return dict(row)


# ---------- регистрация и вход ----------

@app.post("/api/register")
def register(data: RegisterData, request: Request):
    name = data.name.strip()
    email = data.email.strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Имя должно быть не короче 2 букв")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Почта введена неправильно")
    if len(data.password) < 6 or len(data.password) > 50:
        raise HTTPException(status_code=400, detail="Пароль должен быть от 6 до 50 символов")

    # пароль храним только в виде хеша
    password_hash = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name, email, password_hash),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Пользователь с такой почтой уже есть")
    conn.close()

    # после регистрации сразу входим
    request.session["user_id"] = cursor.lastrowid
    return {"name": name}


@app.post("/api/login")
def login(data: LoginData, request: Request):
    email = data.email.strip().lower()

    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if user is None:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    password_ok = bcrypt.checkpw(data.password.encode("utf-8"), user["password_hash"].encode("utf-8"))
    if not password_ok:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    request.session["user_id"] = user["id"]
    return {"name": user["name"]}


# ---------- записи дневника (только свои) ----------

@app.get("/api/records")
def get_records(request: Request):
    user = get_current_user(request)

    conn = get_connection()
    rows = conn.execute("""
        SELECT records.id, records.date, records.sets, records.reps, records.weight,
               exercises.name AS exercise
        FROM records
        JOIN exercises ON exercises.id = records.exercise_id
        WHERE records.user_id = ?
        ORDER BY records.date DESC, records.id DESC
    """, (user["id"],)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/records")
def add_record(data: RecordData, request: Request):
    user = get_current_user(request)

    # проверяем данные ещё раз на сервере, проверку в браузере можно обойти
    try:
        date.fromisoformat(data.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неправильная дата")
    if data.sets < 1 or data.sets > 10:
        raise HTTPException(status_code=400, detail="Подходов должно быть от 1 до 10")
    if data.reps < 1 or data.reps > 50:
        raise HTTPException(status_code=400, detail="Повторов должно быть от 1 до 50")
    if data.weight is not None and (data.weight < 0 or data.weight > 500):
        raise HTTPException(status_code=400, detail="Вес должен быть от 0 до 500 кг")

    conn = get_connection()
    exercise = conn.execute("SELECT id FROM exercises WHERE id = ?", (data.exercise_id,)).fetchone()
    if exercise is None:
        conn.close()
        raise HTTPException(status_code=400, detail="Такого упражнения нет")

    cursor = conn.execute(
        "INSERT INTO records (user_id, exercise_id, date, sets, reps, weight) VALUES (?, ?, ?, ?, ?, ?)",
        (user["id"], data.exercise_id, data.date, data.sets, data.reps, data.weight),
    )
    conn.commit()
    conn.close()
    return {"id": cursor.lastrowid}


# ---------- страницы сайта ----------
# всё, что не начинается с /api, отдаётся из папки site (index.html, css, js, картинки)
SITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")
