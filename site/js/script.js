// скрипты для сайта GymLog

// показывает текст ошибки под полем (если текст пустой - ошибка пропадает)
function showError(id, text) {
    const error = document.querySelector('#' + id + '-error');
    error.textContent = text;
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


// ===== форма новой записи в дневнике =====

const diaryForm = document.querySelector('#diary-form');

if (diaryForm) {
    diaryForm.addEventListener('submit', function (event) {
        event.preventDefault();

        const date = document.querySelector('#date').value;
        const exercise = document.querySelector('#exercise');
        const sets = document.querySelector('#sets').value;
        const reps = document.querySelector('#reps').value;
        const weight = document.querySelector('#weight').value;
        let ok = true;

        if (date === '') {
            showError('date', 'Выберите дату');
            ok = false;
        } else {
            showError('date', '');
        }

        if (exercise.value === '') {
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

        const result = document.querySelector('#diary-result');
        if (ok) {
            const exerciseName = exercise.options[exercise.selectedIndex].text;
            addRecord(date, exerciseName, sets, reps, weight);
            result.textContent = 'Запись добавлена в таблицу';
            diaryForm.reset();
        } else {
            result.textContent = '';
        }
    });
}

// добавляет новую строку в начало таблицы
function addRecord(date, exerciseName, sets, reps, weight) {
    // дата из поля приходит как 2026-11-12, делаем 12.11.2026
    const parts = date.split('-');
    const niceDate = parts[2] + '.' + parts[1] + '.' + parts[0];

    let weightText = '—';
    if (weight !== '') {
        weightText = weight + ' кг';
    }

    const row = document.createElement('tr');
    addCell(row, niceDate);
    addCell(row, exerciseName);
    addCell(row, sets + ' × ' + reps);
    addCell(row, weightText);

    document.querySelector('#records').prepend(row);
}

function addCell(row, text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.append(cell);
}


// ===== фильтр и сортировка в каталоге =====

const filterForm = document.querySelector('#filter-form');

if (filterForm) {
    const list = document.querySelector('#exercise-list');
    const cards = list.querySelectorAll('li');

    function filterCards() {
        const search = document.querySelector('#search').value.toLowerCase();
        const muscle = document.querySelector('#muscle').value;
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
        const array = Array.from(cards);

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

    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        filterCards();
    });
    document.querySelector('#search').addEventListener('input', filterCards);
    document.querySelector('#muscle').addEventListener('change', filterCards);
    document.querySelector('#sort').addEventListener('change', sortCards);

    sortCards();
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
