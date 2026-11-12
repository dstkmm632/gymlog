// скрипты для сайта GymLog

// показывает текст ошибки под полем (если текст пустой - ошибка пропадает)
function showError(id, text) {
    const error = document.querySelector('#' + id + '-error');
    error.textContent = text;
}

// отправляет данные на сервер в формате JSON
async function sendData(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response;
}

// достаёт текст ошибки из ответа сервера
async function getErrorText(response) {
    const result = await response.json();
    if (typeof result.detail === 'string') {
        return result.detail;
    }
    return 'Проверьте введённые данные';
}

const LEVELS = ['', 'новичок', 'средний', 'опытный'];

// создаёт карточку упражнения для списка
function createCard(exercise) {
    const li = document.createElement('li');
    li.dataset.muscle = exercise.muscle;
    li.dataset.level = exercise.level;

    const article = document.createElement('article');
    article.className = 'card';

    const img = document.createElement('img');
    img.src = 'img/exercises/' + exercise.image;
    img.alt = exercise.image_alt;
    img.width = 400;
    img.height = 300;
    img.loading = 'lazy';

    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.href = 'exercise.html?id=' + exercise.id;
    link.textContent = exercise.name;
    title.append(link);

    const text = document.createElement('p');
    text.textContent = exercise.description;

    const info = document.createElement('p');
    info.className = 'card-info';
    info.textContent = exercise.muscle_name + ', ' + LEVELS[exercise.level];

    article.append(img, title, text, info);
    li.append(article);
    return li;
}

// загружает все упражнения с сервера
async function loadExercises() {
    const response = await fetch('/api/exercises');
    if (!response.ok) {
        throw new Error('Ошибка сервера: ' + response.status);
    }
    return await response.json();
}


// ===== форма обратной связи =====

const feedbackForm = document.querySelector('#feedback-form');

if (feedbackForm) {
    feedbackForm.addEventListener('submit', function (event) {
        event.preventDefault();

        const name = document.querySelector('#name').value.trim();
        const email = document.querySelector('#email').value.trim();
        const message = document.querySelector('#message').value.trim();
        let ok = true;

        if (name.length < 2) {
            showError('name', 'Введите имя (минимум 2 буквы)');
            ok = false;
        } else {
            showError('name', '');
        }

        if (email === '') {
            showError('email', 'Введите почту');
            ok = false;
        } else if (!email.includes('@') || !email.includes('.')) {
            showError('email', 'Почта введена неправильно, пример: ivan@mail.ru');
            ok = false;
        } else {
            showError('email', '');
        }

        if (message.length < 10) {
            showError('message', 'Сообщение слишком короткое (минимум 10 символов)');
            ok = false;
        } else {
            showError('message', '');
        }

        const result = document.querySelector('#feedback-result');
        if (ok) {
            result.textContent = 'Спасибо! Сообщение отправлено.';
            feedbackForm.reset();
        } else {
            result.textContent = '';
        }
    });
}


// ===== популярные упражнения на главной =====

const popularList = document.querySelector('#popular-list');

async function showPopular() {
    const status = document.querySelector('#popular-status');
    try {
        const exercises = await loadExercises();
        // показываем первые 6 упражнений
        for (const exercise of exercises.slice(0, 6)) {
            popularList.append(createCard(exercise));
        }
        status.classList.add('is-hidden');
    } catch (error) {
        console.log(error);
        status.textContent = 'Не удалось загрузить упражнения. Сервер не отвечает.';
    }
}

if (popularList) {
    showPopular();
}


// ===== каталог: загрузка, фильтр и сортировка =====

const filterForm = document.querySelector('#filter-form');

if (filterForm) {
    const list = document.querySelector('#exercise-list');

    function filterCards() {
        const search = document.querySelector('#search').value.toLowerCase();
        const muscle = document.querySelector('#muscle').value;
        const cards = list.querySelectorAll('li');
        let count = 0;

        for (const card of cards) {
            const name = card.querySelector('h3').textContent.toLowerCase();

            if (name.includes(search) && (muscle === '' || card.dataset.muscle === muscle)) {
                card.classList.remove('is-hidden');
                count++;
            } else {
                card.classList.add('is-hidden');
            }
        }

        const nothing = document.querySelector('#nothing-found');
        if (count === 0) {
            nothing.classList.remove('is-hidden');
        } else {
            nothing.classList.add('is-hidden');
        }
    }

    function sortCards() {
        const sort = document.querySelector('#sort').value;
        const array = Array.from(list.querySelectorAll('li'));

        if (sort === 'level') {
            array.sort(function (a, b) {
                return a.dataset.level - b.dataset.level;
            });
        } else {
            array.sort(function (a, b) {
                return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent);
            });
        }

        // переставляем карточки в новом порядке
        for (const card of array) {
            list.append(card);
        }
    }

    async function showCatalog() {
        const status = document.querySelector('#catalog-status');
        try {
            const exercises = await loadExercises();
            for (const exercise of exercises) {
                list.append(createCard(exercise));
            }
            status.classList.add('is-hidden');
            sortCards();
        } catch (error) {
            console.log(error);
            status.textContent = 'Не удалось загрузить упражнения. Сервер не отвечает.';
        }
    }

    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        filterCards();
    });
    document.querySelector('#search').addEventListener('input', filterCards);
    document.querySelector('#muscle').addEventListener('change', filterCards);
    document.querySelector('#sort').addEventListener('change', sortCards);

    showCatalog();
}


// ===== страница одного упражнения (exercise.html?id=1) =====

const exerciseName = document.querySelector('#exercise-name');

// добавляет пункты в список, текст разделён переносами строк
function fillList(selector, text) {
    const list = document.querySelector(selector);
    for (const line of text.split('\n')) {
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
    }
}

async function showExercise() {
    // номер упражнения берём из адреса страницы
    const id = new URLSearchParams(window.location.search).get('id');

    try {
        const response = await fetch('/api/exercises/' + id);
        if (response.status === 404 || response.status === 422) {
            exerciseName.textContent = 'Упражнение не найдено';
            return;
        }
        if (!response.ok) {
            throw new Error('Ошибка сервера: ' + response.status);
        }

        const exercise = await response.json();
        document.title = exercise.name + ' — GymLog';
        exerciseName.textContent = exercise.name;

        const img = document.createElement('img');
        img.className = 'exercise-img';
        img.src = 'img/exercises/' + exercise.image;
        img.alt = exercise.image_alt;
        img.width = 400;
        img.height = 300;
        document.querySelector('#exercise-image').append(img);

        document.querySelector('#exercise-description').textContent = exercise.description;

        let params = 'Основные мышцы: ' + exercise.main_muscles;
        if (exercise.extra_muscles) {
            params += '\nДополнительно работают: ' + exercise.extra_muscles;
        }
        params += '\nСнаряжение: ' + exercise.equipment;
        params += '\nУровень: ' + LEVELS[exercise.level];
        params += '\nРекомендация: ' + exercise.recommendation;
        fillList('#exercise-params', params);

        fillList('#exercise-steps', exercise.steps);
        fillList('#exercise-mistakes', exercise.mistakes);

        document.querySelector('#exercise-info').classList.remove('is-hidden');
    } catch (error) {
        console.log(error);
        exerciseName.textContent = 'Не удалось загрузить упражнение';
    }
}

if (exerciseName) {
    showExercise();
}


// ===== вход и регистрация =====

const loginForm = document.querySelector('#login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const email = document.querySelector('#login-email').value.trim();
        const password = document.querySelector('#login-password').value;
        const result = document.querySelector('#login-result');
        let ok = true;

        if (email === '') {
            showError('login-email', 'Введите почту');
            ok = false;
        } else {
            showError('login-email', '');
        }

        if (password === '') {
            showError('login-password', 'Введите пароль');
            ok = false;
        } else {
            showError('login-password', '');
        }

        if (!ok) {
            return;
        }

        try {
            const response = await sendData('/api/login', { email: email, password: password });
            if (response.ok) {
                window.location.href = 'diary.html';
            } else {
                result.textContent = await getErrorText(response);
            }
        } catch (error) {
            console.log(error);
            result.textContent = 'Сервер не отвечает, попробуйте позже';
        }
    });
}

const registerForm = document.querySelector('#register-form');

if (registerForm) {
    registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const name = document.querySelector('#reg-name').value.trim();
        const email = document.querySelector('#reg-email').value.trim();
        const password = document.querySelector('#reg-password').value;
        const result = document.querySelector('#register-result');
        let ok = true;

        if (name.length < 2) {
            showError('reg-name', 'Имя должно быть не короче 2 букв');
            ok = false;
        } else {
            showError('reg-name', '');
        }

        if (!email.includes('@') || !email.includes('.')) {
            showError('reg-email', 'Почта введена неправильно');
            ok = false;
        } else {
            showError('reg-email', '');
        }

        if (password.length < 6 || password.length > 50) {
            showError('reg-password', 'Пароль должен быть от 6 до 50 символов');
            ok = false;
        } else {
            showError('reg-password', '');
        }

        if (!ok) {
            return;
        }

        try {
            const response = await sendData('/api/register', { name: name, email: email, password: password });
            if (response.ok) {
                // после регистрации сервер сразу выполняет вход
                window.location.href = 'diary.html';
            } else {
                result.textContent = await getErrorText(response);
            }
        } catch (error) {
            console.log(error);
            result.textContent = 'Сервер не отвечает, попробуйте позже';
        }
    });
}


// ===== дневник =====

const diaryForm = document.querySelector('#diary-form');

// показывает записи в таблице и считает итог за 7 дней
function showRecords(records) {
    const table = document.querySelector('#records');
    table.textContent = '';

    if (records.length === 0) {
        document.querySelector('#no-records').classList.remove('is-hidden');
    } else {
        document.querySelector('#no-records').classList.add('is-hidden');
    }

    for (const record of records) {
        // дата приходит как 2026-11-12, делаем 12.11.2026
        const parts = record.date.split('-');
        const niceDate = parts[2] + '.' + parts[1] + '.' + parts[0];

        let weightText = '—';
        if (record.weight !== null) {
            weightText = record.weight + ' кг';
        }

        const row = document.createElement('tr');
        addCell(row, niceDate);
        addCell(row, record.exercise);
        addCell(row, record.sets + ' × ' + record.reps);
        addCell(row, weightText);
        table.append(row);
    }

    // итог за последние 7 дней
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const fromDate = weekAgo.toISOString().slice(0, 10);

    const days = [];
    let sets = 0;
    let total = 0;

    for (const record of records) {
        if (record.date >= fromDate) {
            if (!days.includes(record.date)) {
                days.push(record.date);
            }
            sets += record.sets;
            if (record.weight !== null) {
                total += record.sets * record.reps * record.weight;
            }
        }
    }

    document.querySelector('#sum-workouts').textContent = days.length;
    document.querySelector('#sum-sets').textContent = sets;
    document.querySelector('#sum-weight').textContent = Math.round(total);
}

function addCell(row, text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.append(cell);
}

async function loadRecords() {
    const response = await fetch('/api/records');
    if (!response.ok) {
        throw new Error('Ошибка сервера: ' + response.status);
    }
    showRecords(await response.json());
}

async function openDiary() {
    const status = document.querySelector('#diary-status');

    try {
        // если пользователь не вошёл, сервер ответит 401
        const response = await fetch('/api/records');
        status.classList.add('is-hidden');

        if (response.status === 401) {
            document.querySelector('#diary-guest').classList.remove('is-hidden');
            return;
        }
        if (!response.ok) {
            throw new Error('Ошибка сервера: ' + response.status);
        }

        const records = await response.json();
        document.querySelector('#diary-content').classList.remove('is-hidden');

        // список упражнений для формы
        const select = document.querySelector('#exercise');
        const exercises = await loadExercises();
        for (const exercise of exercises) {
            const option = document.createElement('option');
            option.value = exercise.id;
            option.textContent = exercise.name;
            select.append(option);
        }

        showRecords(records);
    } catch (error) {
        console.log(error);
        status.classList.remove('is-hidden');
        status.textContent = 'Не удалось загрузить дневник. Сервер не отвечает.';
    }
}

if (diaryForm) {
    openDiary();

    diaryForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const date = document.querySelector('#date').value;
        const exercise = document.querySelector('#exercise').value;
        const sets = document.querySelector('#sets').value;
        const reps = document.querySelector('#reps').value;
        const weight = document.querySelector('#weight').value;
        const result = document.querySelector('#diary-result');
        let ok = true;

        if (date === '') {
            showError('date', 'Выберите дату');
            ok = false;
        } else {
            showError('date', '');
        }

        if (exercise === '') {
            showError('exercise', 'Выберите упражнение');
            ok = false;
        } else {
            showError('exercise', '');
        }

        if (sets === '' || Number(sets) < 1 || Number(sets) > 10) {
            showError('sets', 'Подходов должно быть от 1 до 10');
            ok = false;
        } else {
            showError('sets', '');
        }

        if (reps === '' || Number(reps) < 1 || Number(reps) > 50) {
            showError('reps', 'Повторов должно быть от 1 до 50');
            ok = false;
        } else {
            showError('reps', '');
        }

        // вес можно не писать, например для подтягиваний
        if (weight !== '' && (Number(weight) < 0 || Number(weight) > 500)) {
            showError('weight', 'Вес должен быть от 0 до 500 кг');
            ok = false;
        } else {
            showError('weight', '');
        }

        if (!ok) {
            result.textContent = '';
            return;
        }

        let weightValue = null;
        if (weight !== '') {
            weightValue = Number(weight);
        }

        try {
            const response = await sendData('/api/records', {
                exercise_id: Number(exercise),
                date: date,
                sets: Number(sets),
                reps: Number(reps),
                weight: weightValue
            });

            if (response.ok) {
                result.textContent = 'Запись сохранена';
                diaryForm.reset();
                await loadRecords();
            } else {
                result.textContent = await getErrorText(response);
            }
        } catch (error) {
            console.log(error);
            result.textContent = 'Не удалось сохранить запись. Сервер не отвечает.';
        }
    });
}


// ===== погода на главной (Open-Meteo) =====

const weather = document.querySelector('#weather-text');

async function loadWeather() {
    weather.textContent = 'Загрузка погоды...';

    try {
        // координаты Санкт-Петербурга
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=59.94&longitude=30.31&current=temperature_2m,wind_speed_10m&wind_speed_unit=ms';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Ошибка сервера: ' + response.status);
        }

        const data = await response.json();
        const temp = Math.round(data.current.temperature_2m);
        const wind = Math.round(data.current.wind_speed_10m);

        weather.textContent = 'Сейчас ' + temp + ' °C, ветер ' + wind + ' м/с';
    } catch (error) {
        console.log(error);
        weather.textContent = 'Не удалось загрузить погоду. Проверьте интернет и обновите страницу.';
    }
}

if (weather) {
    loadWeather();
}
