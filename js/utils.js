// utils.js
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
        background: var(--notification-bg); color: var(--notification-text);
        padding: 10px 20px; border-radius: 5px; z-index: 1000;
        opacity: 0; transition: opacity 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.style.opacity = '1', 10);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        document.querySelector('.theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark');
        document.querySelector('.theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        document.querySelector('.theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.add('dark');
        document.querySelector('.theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    }
}

function initializeTooltips() {
    const tooltips = document.querySelectorAll('.tooltip');
    const isFirstVisit = !localStorage.getItem('hasSeenTooltips');
    if (isFirstVisit) {
        tooltips.forEach(tooltip => {
            tooltip.classList.add('visible');
            setTimeout(() => tooltip.classList.remove('visible'), 5000);
        });
        localStorage.setItem('hasSeenTooltips', 'true');
    }
}

export { showNotification, formatTime, throttle, initializeTheme, toggleTheme, initializeTooltips };