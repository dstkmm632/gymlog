// скрипты для сайта GymLog

// показывает текст ошибки под полем (если текст пустой - ошибка пропадает)
// и подсвечивает само поле красной рамкой
function showError(id, text) {
    const error = document.querySelector('#' + id + '-error');
    error.textContent = text;

    const input = document.querySelector('#' + id);
    if (text === '') {
        input.classList.remove('has-error');
    } else {
        input.classList.add('has-error');
    }
}

// проверка почты: только латиница (английская раскладка)
// возвращает текст ошибки или пустую строку, если всё хорошо
function checkEmail(email) {
    if (email === '') {
        return 'Введите почту';
    }
    // русский домен (например, почта.рф) браузер сам превращает в xn--...,
    // поэтому такую почту тоже считаем введённой не латиницей
    if (/[а-яё]/i.test(email) || email.toLowerCase().includes('xn--')) {
        return 'Почту нужно вводить латиницей (английская раскладка)';
    }
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
        return 'Почта введена неправильно, пример: ivan@mail.ru';
    }
    return '';
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

// дата приходит как 2026-11-12, делаем 12.11.2026
function niceDate(text) {
    const parts = text.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

// вес с запятой: 62.5 -> «62,5»
function kg(value) {
    return String(value).replace('.', ',');
}

// сегодняшняя дата в виде 2026-11-12 (для полей с датой)
function todayText() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
}

// 1 день, 2 дня, 5 дней
function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) {
        return one;
    }
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) {
        return few;
    }
    return many;
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

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.href = 'exercise.html?id=' + exercise.id;
    link.textContent = exercise.name;
    title.append(link);

    const text = document.createElement('p');
    text.textContent = exercise.description;

    const muscle = document.createElement('span');
    muscle.className = 'badge';
    muscle.textContent = exercise.muscle_name;

    const level = document.createElement('span');
    level.className = 'badge';
    level.textContent = LEVELS[exercise.level];

    body.append(title, text, muscle, level);
    article.append(img, body);
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

// заполняет выпадающий список упражнениями
async function fillExerciseSelect(select) {
    const exercises = await loadExercises();
    exercises.sort(function (a, b) {
        return a.name.localeCompare(b.name);
    });
    for (const exercise of exercises) {
        const option = document.createElement('option');
        option.value = exercise.id;
        option.textContent = exercise.name;
        select.append(option);
    }
}


// ===== меню: «Профиль» вместо «Вход», если пользователь вошёл =====

async function updateMenu() {
    const link = document.querySelector('#nav-login');
    try {
        const response = await fetch('/api/me');
        const me = await response.json();
        if (me.logged_in) {
            link.textContent = 'Профиль';
            link.href = 'profile.html';
        }
    } catch (error) {
        console.log(error);
    }
}

updateMenu();


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

        const emailError = checkEmail(email);
        showError('email', emailError);
        if (emailError !== '') {
            ok = false;
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
        // показываем первые 8 упражнений
        for (const exercise of exercises.slice(0, 8)) {
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


// ===== каталог: загрузка, фильтр по группам мышц и сортировка =====

const filterForm = document.querySelector('#filter-form');

if (filterForm) {
    const list = document.querySelector('#exercise-list');
    const chips = document.querySelectorAll('#muscle-chips .chip');

    // группу мышц можно передать в адресе: catalog.html?muscle=legs
    let muscle = new URLSearchParams(window.location.search).get('muscle') || '';

    function filterCards() {
        const search = document.querySelector('#search').value.toLowerCase().trim();
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

        document.querySelector('#found-title').textContent = 'Найдено упражнений: ' + count;
    }

    // подсвечиваем выбранную группу мышц
    function selectChip() {
        let muscleName = '';
        for (const chip of chips) {
            if (chip.dataset.muscle === muscle) {
                chip.classList.add('active');
                chip.setAttribute('aria-pressed', 'true');
                muscleName = chip.textContent;
            } else {
                chip.classList.remove('active');
                chip.setAttribute('aria-pressed', 'false');
            }
        }

        // ссылка «Подобрать тренировку на эту группу»
        const box = document.querySelector('#workout-link-box');
        if (muscle === '') {
            box.classList.add('is-hidden');
        } else {
            const link = document.querySelector('#workout-link');
            link.href = 'workout.html?type=' + muscle;
            link.textContent = 'Подобрать тренировку: ' + muscleName;
            box.classList.remove('is-hidden');
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
            filterCards();
        } catch (error) {
            console.log(error);
            status.textContent = 'Не удалось загрузить упражнения. Сервер не отвечает.';
        }
    }

    for (const chip of chips) {
        chip.addEventListener('click', function () {
            muscle = chip.dataset.muscle;
            selectChip();
            filterCards();
        });
    }

    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        filterCards();
    });
    document.querySelector('#search').addEventListener('input', filterCards);
    document.querySelector('#sort').addEventListener('change', sortCards);

    selectChip();
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

        const badges = document.querySelector('#exercise-badges');
        for (const text of [exercise.muscle_name, LEVELS[exercise.level]]) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = text;
            badges.append(badge);
        }

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
        params += '\nРекомендация: ' + exercise.recommendation;
        fillList('#exercise-params', params);

        fillList('#exercise-steps', exercise.steps);
        fillList('#exercise-mistakes', exercise.mistakes);

        document.querySelector('#exercise-workout').href = 'workout.html?type=' + exercise.muscle;
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

        const emailError = checkEmail(email);
        showError('login-email', emailError);
        if (emailError !== '') {
            ok = false;
        }

        if (password === '') {
            showError('login-password', 'Введите пароль');
            ok = false;
        } else {
            showError('login-password', '');
        }

        result.textContent = '';
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

        const emailError = checkEmail(email);
        showError('reg-email', emailError);
        if (emailError !== '') {
            ok = false;
        }

        if (password.length < 6 || password.length > 50) {
            showError('reg-password', 'Пароль должен быть от 6 до 50 символов');
            ok = false;
        } else {
            showError('reg-password', '');
        }

        result.textContent = '';
        if (!ok) {
            return;
        }

        try {
            const response = await sendData('/api/register', { name: name, email: email, password: password });
            if (response.ok) {
                // после регистрации сервер сразу выполняет вход, открываем профиль
                window.location.href = 'profile.html?new=1';
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
        // 4 × 8, 50 кг (вес можно не указывать)
        let resultText = record.sets + ' × ' + record.reps;
        if (record.weight !== null) {
            resultText += ', ' + kg(record.weight) + '\u00a0кг';
        }

        const row = document.createElement('tr');
        addCell(row, niceDate(record.date));
        addCell(row, record.exercise);
        addCell(row, resultText);
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
        document.querySelector('#date').value = todayText();

        await fillExerciseSelect(document.querySelector('#exercise'));
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
                document.querySelector('#date').value = todayText();
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


// ===== профиль: данные о себе =====

const profileForm = document.querySelector('#profile-form');

// пустое поле -> null, иначе число
function numberOrNull(value) {
    if (value === '') {
        return null;
    }
    return Number(value);
}

// проверяет число в поле: можно не заполнять, но если заполнено - от min до max
function checkRange(id, min, max, text) {
    const value = document.querySelector('#' + id).value;
    if (value !== '' && (Number(value) < min || Number(value) > max)) {
        showError(id, text);
        return false;
    }
    showError(id, '');
    return true;
}

async function openProfile() {
    const status = document.querySelector('#profile-status');

    try {
        const response = await fetch('/api/profile');
        status.classList.add('is-hidden');

        if (response.status === 401) {
            document.querySelector('#profile-guest').classList.remove('is-hidden');
            return;
        }
        if (!response.ok) {
            throw new Error('Ошибка сервера: ' + response.status);
        }

        const profile = await response.json();
        document.querySelector('#profile-email').textContent = profile.email;
        document.querySelector('#profile-name').value = profile.name;
        if (profile.age !== null) {
            document.querySelector('#profile-age').value = profile.age;
        }
        if (profile.height !== null) {
            document.querySelector('#profile-height').value = profile.height;
        }
        if (profile.weight !== null) {
            document.querySelector('#profile-weight').value = profile.weight;
        }

        // после регистрации показываем подсказку
        if (new URLSearchParams(window.location.search).get('new') === '1') {
            document.querySelector('#profile-welcome').classList.remove('is-hidden');
        }

        document.querySelector('#profile-content').classList.remove('is-hidden');
        document.querySelector('#st-date').value = todayText();

        await fillExerciseSelect(document.querySelector('#st-exercise'));
        await loadStrength();
    } catch (error) {
        console.log(error);
        status.classList.remove('is-hidden');
        status.textContent = 'Не удалось загрузить профиль. Сервер не отвечает.';
    }
}

if (profileForm) {
    openProfile();

    profileForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const name = document.querySelector('#profile-name').value.trim();
        const result = document.querySelector('#profile-result');
        let ok = true;

        if (name.length < 2 || name.length > 50) {
            showError('profile-name', 'Имя должно быть от 2 до 50 символов');
            ok = false;
        } else {
            showError('profile-name', '');
        }

        if (!checkRange('profile-age', 10, 100, 'Возраст должен быть от 10 до 100 лет')) {
            ok = false;
        }
        if (!checkRange('profile-height', 100, 250, 'Рост должен быть от 100 до 250 см')) {
            ok = false;
        }
        if (!checkRange('profile-weight', 30, 300, 'Вес должен быть от 30 до 300 кг')) {
            ok = false;
        }

        result.classList.remove('is-error');
        if (!ok) {
            result.textContent = '';
            return;
        }

        try {
            const response = await sendData('/api/profile', {
                name: name,
                age: numberOrNull(document.querySelector('#profile-age').value),
                height: numberOrNull(document.querySelector('#profile-height').value),
                weight: numberOrNull(document.querySelector('#profile-weight').value)
            });

            if (response.ok) {
                result.textContent = 'Данные сохранены';
            } else {
                result.classList.add('is-error');
                result.textContent = await getErrorText(response);
            }
        } catch (error) {
            console.log(error);
            result.classList.add('is-error');
            result.textContent = 'Не удалось сохранить данные. Сервер не отвечает.';
        }
    });

    document.querySelector('#logout-btn').addEventListener('click', async function () {
        await sendData('/api/logout', {});
        window.location.href = 'index.html';
    });
}


// ===== профиль: силовые показатели и прогресс =====

const strengthForm = document.querySelector('#strength-form');

// 60 кг × 5 или «свой вес × 8»
function liftText(item) {
    if (item.weight === 0) {
        return 'свой вес × ' + item.reps;
    }
    return kg(item.weight) + '\u00a0кг × ' + item.reps;
}

// разница между первым и последним результатом
function diffText(first, last) {
    const weightDiff = last.weight - first.weight;
    const repsDiff = last.reps - first.reps;

    if (weightDiff !== 0) {
        let text = (weightDiff > 0 ? '+' : '') + kg(weightDiff) + ' кг';
        if (first.weight > 0) {
            const percent = Math.round(weightDiff / first.weight * 100);
            text += ' (' + (percent > 0 ? '+' : '') + percent + ' %)';
        }
        return { text: text, up: weightDiff > 0 };
    }
    if (repsDiff !== 0) {
        const word = plural(Math.abs(repsDiff), 'повтор', 'повтора', 'повторов');
        return { text: (repsDiff > 0 ? '+' : '') + repsDiff + ' ' + word, up: repsDiff > 0 };
    }
    return { text: 'без изменений', up: null };
}

function showStrength(items) {
    const list = document.querySelector('#progress-list');
    list.textContent = '';

    if (items.length === 0) {
        document.querySelector('#no-strength').classList.remove('is-hidden');
        return;
    }
    document.querySelector('#no-strength').classList.add('is-hidden');

    // группируем результаты по упражнениям (сервер уже отсортировал по дате)
    const groups = {};
    const order = [];
    for (const item of items) {
        if (!groups[item.exercise_id]) {
            groups[item.exercise_id] = [];
            order.push(item.exercise_id);
        }
        groups[item.exercise_id].push(item);
    }

    for (const id of order) {
        const group = groups[id];
        const first = group[0];
        const last = group[group.length - 1];

        const li = document.createElement('li');
        li.className = 'progress-item';

        const title = document.createElement('h3');
        title.textContent = last.exercise;

        const now = document.createElement('p');
        now.textContent = 'Сейчас: ' + liftText(last) + ' (' + niceDate(last.date) + ')';

        const info = document.createElement('p');
        if (group.length === 1) {
            info.className = 'muted';
            info.textContent = 'Это первый результат. Добавьте новый позже, чтобы увидеть разницу.';
        } else {
            const days = Math.round((new Date(last.date) - new Date(first.date)) / 86400000);
            const diff = diffText(first, last);

            info.textContent = 'Было: ' + liftText(first) + ' (' + niceDate(first.date) + '). Изменение за ' +
                days + ' ' + plural(days, 'день', 'дня', 'дней') + ': ';

            const badge = document.createElement('span');
            badge.className = 'diff';
            if (diff.up === true) {
                badge.classList.add('up');
            } else if (diff.up === false) {
                badge.classList.add('down');
            }
            badge.textContent = diff.text;
            info.append(badge);
        }

        li.append(title, now, info, createHistory(group));
        list.append(li);
    }
}

// история результатов по одному упражнению (раскрывается по нажатию)
function createHistory(group) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'История (' + group.length + ')';

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const text of ['Дата', 'Результат', '']) {
        const th = document.createElement('th');
        th.textContent = text;
        head.append(th);
    }
    table.append(head);

    for (const item of group) {
        const row = document.createElement('tr');
        addCell(row, niceDate(item.date));
        addCell(row, liftText(item));

        const cell = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'link-btn';
        button.textContent = 'Удалить';
        button.addEventListener('click', function () {
            deleteStrength(item.id);
        });
        cell.append(button);
        row.append(cell);
        table.append(row);
    }

    wrap.append(table);
    details.append(summary, wrap);
    return details;
}

async function loadStrength() {
    const response = await fetch('/api/strength');
    if (!response.ok) {
        throw new Error('Ошибка сервера: ' + response.status);
    }
    showStrength(await response.json());
}

async function deleteStrength(id) {
    try {
        const response = await fetch('/api/strength/' + id, { method: 'DELETE' });
        if (response.ok) {
            await loadStrength();
        }
    } catch (error) {
        console.log(error);
    }
}

if (strengthForm) {
    strengthForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const exercise = document.querySelector('#st-exercise').value;
        const date = document.querySelector('#st-date').value;
        const weight = document.querySelector('#st-weight').value;
        const reps = document.querySelector('#st-reps').value;
        const result = document.querySelector('#strength-result');
        let ok = true;

        if (exercise === '') {
            showError('st-exercise', 'Выберите упражнение');
            ok = false;
        } else {
            showError('st-exercise', '');
        }

        if (date === '') {
            showError('st-date', 'Выберите дату');
            ok = false;
        } else {
            showError('st-date', '');
        }

        if (weight === '' || Number(weight) < 0 || Number(weight) > 500) {
            showError('st-weight', 'Вес от 0 до 500 кг (0 — свой вес)');
            ok = false;
        } else {
            showError('st-weight', '');
        }

        if (reps === '' || Number(reps) < 1 || Number(reps) > 100) {
            showError('st-reps', 'Повторов должно быть от 1 до 100');
            ok = false;
        } else {
            showError('st-reps', '');
        }

        result.classList.remove('is-error');
        if (!ok) {
            result.textContent = '';
            return;
        }

        try {
            const response = await sendData('/api/strength', {
                exercise_id: Number(exercise),
                date: date,
                weight: Number(weight),
                reps: Number(reps)
            });

            if (response.ok) {
                result.textContent = 'Результат добавлен';
                document.querySelector('#st-weight').value = '';
                document.querySelector('#st-reps').value = '';
                await loadStrength();
            } else {
                result.classList.add('is-error');
                result.textContent = await getErrorText(response);
            }
        } catch (error) {
            console.log(error);
            result.classList.add('is-error');
            result.textContent = 'Не удалось сохранить результат. Сервер не отвечает.';
        }
    });
}


// ===== подбор тренировки =====

const workoutForm = document.querySelector('#workout-form');

async function makeWorkout() {
    const type = document.querySelector('#workout-type').value;
    const minutes = document.querySelector('input[name="minutes"]:checked').value;
    const error = document.querySelector('#workout-error');
    error.textContent = '';

    try {
        const response = await fetch('/api/workout?type=' + type + '&minutes=' + minutes);
        if (!response.ok) {
            error.textContent = await getErrorText(response);
            return;
        }
        showWorkout(await response.json());
    } catch (err) {
        console.log(err);
        error.textContent = 'Не удалось подобрать тренировку. Сервер не отвечает.';
    }
}

function showWorkout(workout) {
    document.querySelector('#workout-title').textContent = 'Тренировка: ' + workout.type;

    const count = workout.exercises.length;
    document.querySelector('#workout-summary').textContent = 'Выбрано время: ' + workout.minutes + ' мин. ' +
        count + ' ' + plural(count, 'упражнение', 'упражнения', 'упражнений') +
        ', примерно ' + workout.total + ' мин вместе с разминкой и заминкой.';

    const note = document.querySelector('#workout-note');
    if (workout.note) {
        note.textContent = workout.note;
        note.classList.remove('is-hidden');
    } else {
        note.classList.add('is-hidden');
    }

    const list = document.querySelector('#workout-list');
    list.textContent = '';

    workout.exercises.forEach(function (exercise, index) {
        const li = document.createElement('li');
        li.className = 'workout-item';

        const img = document.createElement('img');
        img.src = 'img/exercises/' + exercise.image;
        img.alt = exercise.image_alt;
        img.width = 90;
        img.height = 68;

        const box = document.createElement('div');

        const title = document.createElement('h3');
        const link = document.createElement('a');
        link.href = 'exercise.html?id=' + exercise.id;
        link.textContent = (index + 1) + '. ' + exercise.name;
        title.append(link);

        const sets = document.createElement('p');
        sets.className = 'workout-sets';
        sets.textContent = exercise.sets + ' ' + plural(exercise.sets, 'подход', 'подхода', 'подходов') +
            ' по ' + exercise.reps;

        const rest = document.createElement('p');
        rest.textContent = exercise.muscle_name + ' · отдых между подходами ' + exercise.rest;

        box.append(title, sets, rest);
        li.append(img, box);
        list.append(li);
    });

    const result = document.querySelector('#workout-result');
    result.classList.remove('is-hidden');
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (workoutForm) {
    // тип тренировки можно передать в адресе: workout.html?type=legs
    const type = new URLSearchParams(window.location.search).get('type');
    if (type && document.querySelector('#workout-type option[value="' + type + '"]')) {
        document.querySelector('#workout-type').value = type;
    }

    workoutForm.addEventListener('submit', function (event) {
        event.preventDefault();
        makeWorkout();
    });
    document.querySelector('#workout-again').addEventListener('click', makeWorkout);
}


// ===== КБЖУ продуктов (внешний источник: Open Food Facts) =====

const foodForm = document.querySelector('#food-form');
let foods = [];        // найденные продукты, чтобы пересчитать порцию без нового запроса
const foodCache = {};  // уже найденные запросы: Open Food Facts разрешает не больше 10 поисков в минуту

// число -> текст: калории целым числом, граммы с одной цифрой после запятой
function formatValue(value, isKcal) {
    if (value === null) {
        return '—';
    }
    if (isKcal) {
        return String(Math.round(value));
    }
    return String(Math.round(value * 10) / 10).replace('.', ',');
}

// достаёт из ответа нужные нам поля
function readFood(product) {
    const n = product.nutriments || {};
    let kcal = null;
    if (n['energy-kcal_100g'] !== undefined) {
        kcal = Number(n['energy-kcal_100g']);
    } else if (n['energy_100g'] !== undefined) {
        kcal = Number(n['energy_100g']) / 4.184;   // кДж -> ккал
    }

    function value(key) {
        if (n[key] === undefined || n[key] === '') {
            return null;
        }
        return Number(n[key]);
    }

    return {
        name: product.product_name_ru || product.product_name || '',
        brand: product.brands || '',
        kcal: kcal,
        protein: value('proteins_100g'),
        fat: value('fat_100g'),
        carbs: value('carbohydrates_100g')
    };
}

// ряд из четырёх плиток: ккал, белки, жиры, углеводы
function createMacros(food, grams) {
    const k = grams / 100;
    const ul = document.createElement('ul');
    ul.className = 'macros';

    const items = [
        ['ккал', food.kcal, true],
        ['белки, г', food.protein, false],
        ['жиры, г', food.fat, false],
        ['углев., г', food.carbs, false]
    ];

    for (const item of items) {
        const li = document.createElement('li');
        const b = document.createElement('b');
        b.textContent = formatValue(item[1] === null ? null : item[1] * k, item[2]);
        li.append(b, item[0]);
        ul.append(li);
    }
    return ul;
}

function showFoods() {
    const list = document.querySelector('#food-list');
    list.textContent = '';

    let grams = Number(document.querySelector('#food-grams').value);
    if (!(grams >= 1 && grams <= 2000)) {
        grams = 100;
    }

    for (const food of foods) {
        const li = document.createElement('li');
        li.className = 'panel food';

        const title = document.createElement('h3');
        title.textContent = food.name;

        const brand = document.createElement('p');
        brand.className = 'muted';
        brand.textContent = food.brand || 'Производитель не указан';

        const t100 = document.createElement('p');
        t100.className = 'macros-title';
        t100.textContent = 'На 100 г';

        const tPortion = document.createElement('p');
        tPortion.className = 'macros-title';
        tPortion.textContent = 'На порцию ' + grams + ' г';

        li.append(title, brand, t100, createMacros(food, 100), tPortion, createMacros(food, grams));
        list.append(li);
    }
}

// ищет продукты в Open Food Facts
// сайт иногда отвечает с ошибкой, поэтому пробуем по очереди:
// русский сайт, международный сайт и в конце через наш сервер
async function loadProducts(query) {
    const params = '?search_terms=' + encodeURIComponent(query) +
        '&search_simple=1&action=process&json=1&page_size=20' +
        '&fields=product_name,product_name_ru,brands,nutriments';
    const urls = [
        'https://ru.openfoodfacts.org/cgi/search.pl' + params,
        'https://world.openfoodfacts.org/cgi/search.pl' + params,
        '/api/food?q=' + encodeURIComponent(query)
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.log('Не получилось: ' + url, error);
        }
    }
    throw new Error('Open Food Facts не отвечает');
}

async function searchFood() {
    const query = document.querySelector('#food-search').value.trim();
    const grams = document.querySelector('#food-grams').value;
    const status = document.querySelector('#food-status');
    let ok = true;

    if (query.length < 2) {
        showError('food-search', 'Введите название продукта (минимум 2 буквы)');
        ok = false;
    } else {
        showError('food-search', '');
    }

    if (grams === '' || Number(grams) < 1 || Number(grams) > 2000) {
        showError('food-grams', 'Порция от 1 до 2000 г');
        ok = false;
    } else {
        showError('food-grams', '');
    }

    if (!ok) {
        return;
    }

    foods = [];
    showFoods();
    status.textContent = 'Ищем продукты...';
    status.classList.remove('is-hidden');

    try {
        const key = query.toLowerCase();
        let products = foodCache[key];

        if (!products) {
            products = await loadProducts(query);
            foodCache[key] = products;
        }

        for (const product of products) {
            const food = readFood(product);
            // берём только продукты с названием и хотя бы калориями или белками
            if (food.name !== '' && (food.kcal !== null || food.protein !== null) && foods.length < 10) {
                foods.push(food);
            }
        }

        if (foods.length === 0) {
            status.textContent = 'Ничего не найдено. Попробуйте другое название.';
        } else {
            status.textContent = 'Найдено продуктов: ' + foods.length;
        }
        showFoods();
    } catch (error) {
        console.log(error);
        status.textContent = 'Не удалось загрузить данные о продуктах. Проверьте интернет или подождите минуту и попробуйте ещё раз.';
    }
}

if (foodForm) {
    foodForm.addEventListener('submit', function (event) {
        event.preventDefault();
        searchFood();
    });

    // быстрый поиск по кнопкам
    for (const chip of document.querySelectorAll('[data-food]')) {
        chip.addEventListener('click', function () {
            document.querySelector('#food-search').value = chip.dataset.food;
            searchFood();
        });
    }

    // при изменении порции пересчитываем без нового запроса
    document.querySelector('#food-grams').addEventListener('input', function () {
        if (foods.length > 0) {
            showFoods();
        }
    });
}
