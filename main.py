# Сервер GymLog на FastAPI
# Запуск: uvicorn main:app --reload

import json
import os
import random
import re
import secrets
import sqlite3
import urllib.parse
import urllib.request
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


class ProfileData(BaseModel):
    name: str
    age: Optional[int] = None
    height: Optional[int] = None
    weight: Optional[float] = None


class StrengthData(BaseModel):
    exercise_id: int
    date: str
    weight: float
    reps: int


# почта только латиницей: буквы, цифры, точка, дефис и т.п., потом @ и домен
EMAIL_PATTERN = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"


def check_email(email):
    # xn-- значит, что домен был русскими буквами (браузер переводит его в такой вид)
    if re.fullmatch(EMAIL_PATTERN, email) is None or "xn--" in email:
        raise HTTPException(status_code=400, detail="Почту нужно вводить латиницей, например ivan@mail.ru")


def check_date(text):
    try:
        date.fromisoformat(text)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неправильная дата")


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
    check_email(email)
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
    check_email(email)

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


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


# вошёл ли пользователь (нужно, чтобы в меню показывать «Профиль» вместо «Вход»)
@app.get("/api/me")
def get_me(request: Request):
    user_id = request.session.get("user_id")
    if user_id is None:
        return {"logged_in": False}

    conn = get_connection()
    user = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if user is None:
        return {"logged_in": False}
    return {"logged_in": True, "name": user["name"]}


# ---------- профиль: имя, возраст, рост, вес ----------

@app.get("/api/profile")
def get_profile(request: Request):
    user = get_current_user(request)

    conn = get_connection()
    profile = conn.execute("SELECT age, height, weight FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
    conn.close()

    result = {"name": user["name"], "email": user["email"], "age": None, "height": None, "weight": None}
    if profile is not None:
        result["age"] = profile["age"]
        result["height"] = profile["height"]
        result["weight"] = profile["weight"]
    return result


@app.post("/api/profile")
def save_profile(data: ProfileData, request: Request):
    user = get_current_user(request)
    name = data.name.strip()

    if len(name) < 2 or len(name) > 50:
        raise HTTPException(status_code=400, detail="Имя должно быть от 2 до 50 символов")
    if data.age is not None and (data.age < 10 or data.age > 100):
        raise HTTPException(status_code=400, detail="Возраст должен быть от 10 до 100 лет")
    if data.height is not None and (data.height < 100 or data.height > 250):
        raise HTTPException(status_code=400, detail="Рост должен быть от 100 до 250 см")
    if data.weight is not None and (data.weight < 30 or data.weight > 300):
        raise HTTPException(status_code=400, detail="Вес должен быть от 30 до 300 кг")

    conn = get_connection()
    conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, user["id"]))

    found = conn.execute("SELECT user_id FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
    if found is None:
        conn.execute("INSERT INTO profiles (user_id, age, height, weight) VALUES (?, ?, ?, ?)",
                     (user["id"], data.age, data.height, data.weight))
    else:
        conn.execute("UPDATE profiles SET age = ?, height = ?, weight = ? WHERE user_id = ?",
                     (data.age, data.height, data.weight, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------- силовые показатели (только свои) ----------

@app.get("/api/strength")
def get_strength(request: Request):
    user = get_current_user(request)

    conn = get_connection()
    rows = conn.execute("""
        SELECT strength.id, strength.exercise_id, strength.date, strength.weight, strength.reps,
               exercises.name AS exercise
        FROM strength
        JOIN exercises ON exercises.id = strength.exercise_id
        WHERE strength.user_id = ?
        ORDER BY exercises.name, strength.date, strength.id
    """, (user["id"],)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/strength")
def add_strength(data: StrengthData, request: Request):
    user = get_current_user(request)

    check_date(data.date)
    if data.weight < 0 or data.weight > 500:
        raise HTTPException(status_code=400, detail="Вес должен быть от 0 до 500 кг")
    if data.reps < 1 or data.reps > 100:
        raise HTTPException(status_code=400, detail="Повторов должно быть от 1 до 100")

    conn = get_connection()
    exercise = conn.execute("SELECT id FROM exercises WHERE id = ?", (data.exercise_id,)).fetchone()
    if exercise is None:
        conn.close()
        raise HTTPException(status_code=400, detail="Такого упражнения нет")

    cursor = conn.execute(
        "INSERT INTO strength (user_id, exercise_id, date, weight, reps) VALUES (?, ?, ?, ?, ?)",
        (user["id"], data.exercise_id, data.date, data.weight, data.reps),
    )
    conn.commit()
    conn.close()
    return {"id": cursor.lastrowid}


@app.delete("/api/strength/{strength_id}")
def delete_strength(strength_id: int, request: Request):
    user = get_current_user(request)

    # удаляем только свою запись
    conn = get_connection()
    cursor = conn.execute("DELETE FROM strength WHERE id = ? AND user_id = ?", (strength_id, user["id"]))
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"ok": True}


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
    check_date(data.date)
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


# ---------- подбор тренировки ----------

MUSCLE_NAMES = {
    "fullbody": "Full body (всё тело)",
    "legs": "Ноги",
    "chest": "Грудь",
    "back": "Спина",
    "shoulders": "Плечи",
    "arms": "Руки",
    "core": "Пресс",
}

# время тренировки -> (сколько упражнений, сколько подходов в каждом)
PLANS = {
    30: (3, 3),
    45: (4, 3),
    60: (5, 4),
    90: (7, 4),
}

# в каком порядке берём группы мышц для тренировки на всё тело
FULLBODY_ORDER = ["legs", "chest", "back", "shoulders", "arms", "core", "legs"]


def rest_time(level):
    if level == 3:
        return "2–3 мин"
    if level == 2:
        return "1,5–2 мин"
    return "1 мин"


def exercise_word(n):
    # 1 упражнение, 2 упражнения, 5 упражнений
    if n % 10 == 1 and n % 100 != 11:
        return "упражнение"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return "упражнения"
    return "упражнений"


def reps_text(recommendation):
    # из «3–4 подхода по 8–10 повторений» берём «8–10 повторений»
    match = re.search(r"по (.+)$", recommendation)
    if match:
        return match.group(1)
    return recommendation


@app.get("/api/workout")
def make_workout(type: str = "fullbody", minutes: int = 45):
    if type not in MUSCLE_NAMES:
        raise HTTPException(status_code=400, detail="Неизвестный тип тренировки")
    if minutes not in PLANS:
        raise HTTPException(status_code=400, detail="Время тренировки: 30, 45, 60 или 90 минут")

    count, sets = PLANS[minutes]

    conn = get_connection()
    rows = [dict(row) for row in conn.execute("SELECT * FROM exercises").fetchall()]
    conn.close()

    note = ""
    chosen = []
    if type == "fullbody":
        # по одному упражнению на каждую группу мышц
        for muscle in FULLBODY_ORDER[:count]:
            variants = [ex for ex in rows if ex["muscle"] == muscle and ex not in chosen]
            if variants:
                chosen.append(random.choice(variants))
    else:
        variants = [ex for ex in rows if ex["muscle"] == type]
        if len(variants) < count:
            # упражнений меньше, чем нужно, поэтому делаем больше подходов
            sets = min(5, round(count * sets / len(variants)))
            count = len(variants)
            note = "Для этой группы мышц в каталоге всего " + str(count) + " " + exercise_word(count) + ", поэтому подходов больше."
        chosen = random.sample(variants, count)
        # сначала тяжёлые упражнения, потом лёгкие
        chosen.sort(key=lambda ex: ex["level"], reverse=True)

    exercises = []
    for ex in chosen:
        exercises.append({
            "id": ex["id"],
            "name": ex["name"],
            "muscle_name": ex["muscle_name"],
            "image": ex["image"],
            "image_alt": ex["image_alt"],
            "sets": sets,
            "reps": reps_text(ex["recommendation"]),
            "rest": rest_time(ex["level"]),
        })

    # примерно 2,5 минуты на подход вместе с отдыхом + 10 минут разминка и заминка
    total = round((len(exercises) * sets * 2.5 + 10) / 5) * 5

    return {
        "type": MUSCLE_NAMES[type],
        "minutes": minutes,
        "total": total,
        "note": note,
        "exercises": exercises,
    }


# ---------- КБЖУ: запасной путь через наш сервер ----------
# браузер сначала сам обращается к Open Food Facts,
# а если не получилось - спрашивает наш сервер, и сервер делает тот же запрос

FOOD_CACHE = {}   # уже найденные продукты, чтобы не спрашивать одно и то же


@app.get("/api/food")
def search_food(q: str):
    query = q.strip()
    if len(query) < 2 or len(query) > 50:
        raise HTTPException(status_code=400, detail="Введите название продукта (от 2 до 50 символов)")

    key = query.lower()
    if key in FOOD_CACHE:
        return {"products": FOOD_CACHE[key]}

    params = urllib.parse.urlencode({
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 20,
        "fields": "product_name,product_name_ru,brands,nutriments",
    })
    url = "https://world.openfoodfacts.org/cgi/search.pl?" + params
    # Open Food Facts просит указывать, кто делает запрос
    req = urllib.request.Request(url, headers={"User-Agent": "GymLog/1.0 (student project)"})

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.load(response)
    except Exception:
        raise HTTPException(status_code=502, detail="Сервис Open Food Facts сейчас не отвечает")

    products = data.get("products", [])
    FOOD_CACHE[key] = products
    return {"products": products}


# ---------- страницы сайта ----------
# всё, что не начинается с /api, отдаётся из папки site (index.html, css, js, картинки)
SITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")
