// main.js
import { initializePlayer } from './player.js';
import { showNotification } from './utils.js';

const tg = window.Telegram.WebApp;
tg.ready();

let userId = null;

const authScreen = document.getElementById('authScreen');
const playerContainer = document.getElementById('playerContainer');
const authBtn = document.getElementById('authBtn');

if (tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id;
    showPlayer();
} else {
    console.log('No Telegram user detected on load');
}

authBtn.addEventListener('click', () => {
    console.log('Кнопка входа нажата'); // Отладка
    if (tg.initDataUnsafe.user) {
        userId = tg.initDataUnsafe.user.id;
        console.log('Авторизация через Telegram:', userId); // Отладка
        showPlayer();
    } else {
        userId = 'browserTestUser';
        showNotification('Имитация: Вы вошли как ' + userId);
        console.log('Имитация авторизации:', userId); // Отладка
        showPlayer();
    }
});

function showPlayer() {
    console.log('Запуск плеера с userId:', userId); // Отладка
    authScreen.style.display = 'none';
    playerContainer.style.display = 'flex';
    initializePlayer(userId);
}

export { tg, userId };