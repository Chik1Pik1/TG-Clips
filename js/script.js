let tg = window.Telegram.WebApp;
tg.ready();

const videoPlaylist = [
    "https://www.w3schools.com/html/mov_bbb.mp4",
    "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"
];

const videoDataStore = videoPlaylist.map((url) => {
    const cachedData = localStorage.getItem(`videoData_${url}`);
    const defaultData = {
        views: new Set(),
        likes: 0,
        dislikes: 0,
        userLikes: new Set(),
        userDislikes: new Set(),
        comments: [],
        shares: 0,
        viewTime: 0,
        replays: 0,
        duration: 0,
        authorId: 'testAuthor123',
        lastPosition: 0,
        chatMessages: [],
        description: ''
    };
    if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return {
            ...defaultData,
            ...parsedData,
            views: new Set(parsedData.views || []),
            userLikes: new Set(parsedData.userLikes || []),
            userDislikes: new Set(parsedData.userDislikes || []),
            comments: parsedData.comments || [],
            chatMessages: parsedData.chatMessages || [],
            description: parsedData.description || ''
        };
    }
    return defaultData;
});

const channels = JSON.parse(localStorage.getItem('channels')) || {};

let currentVideoIndex = 0;
let preloadedVideos = {};
const MAX_PRELOAD_SIZE = 3;
const MAX_PLAYLIST_SIZE = 10;
let userId = null;
let uploadedFileUrl = null;

const authScreen = document.getElementById('authScreen');
const playerContainer = document.getElementById('playerContainer');
const authBtn = document.getElementById('authBtn');
const video = document.getElementById('videoPlayer');
const videoSource = document.getElementById('videoSource');
const viewCountEl = document.getElementById('viewCount');
const likeCountEl = document.getElementById('likeCount');
const dislikeCountEl = document.getElementById('dislikeCount');
const commentCountEl = document.getElementById('commentCount');
const shareCountEl = document.getElementById('shareCount');
const ratingEl = document.getElementById('rating');
const reactionBar = document.getElementById('reactionBar');
const reactionButtons = document.querySelectorAll('.reaction-btn');
const swipeArea = document.getElementById('swipeArea');
const reactionAnimation = document.getElementById('reactionAnimation');
const progressBar = document.getElementById('progressBar');
const progressRange = document.getElementById('progressRange');
const commentsWindow = document.getElementById('commentsWindow');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const sendCommentBtn = document.getElementById('sendComment');
const themeToggle = document.querySelector('.theme-toggle');
const toggleReactionBar = document.querySelector('.toggle-reaction-bar');
const plusBtn = document.querySelector('.plus-btn');
const uploadBtn = document.querySelector('.upload-btn');
const submenuUpload = document.getElementById('uploadVideo');
const submenuChat = document.getElementById('chatAuthor');
const uploadModal = document.getElementById('uploadModal');
const uploadProgress = document.getElementById('progressBarInner');
const uploadPreview = document.getElementById('uploadPreview');
const publishBtn = document.getElementById('publishBtn');
const cancelBtn = document.getElementById('cancelBtn');
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatMessage = document.getElementById('sendChatMessage');
const closeChat = document.getElementById('closeChat');
const shareModal = document.getElementById('shareModal');
const shareTelegram = document.getElementById('shareTelegram');
const copyLink = document.getElementById('copyLink');
const closeShare = document.getElementById('closeShare');
const tooltips = document.querySelectorAll('.tooltip');

const videoUpload = document.createElement('input');
videoUpload.type = 'file';
videoUpload.accept = 'video/mp4,video/quicktime,video/webm';
videoUpload.style.display = 'none';
document.body.appendChild(videoUpload);

if (tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id;
    showPlayer();
} else {
    console.log('No Telegram user detected on load');
}

authBtn.addEventListener('click', () => {
    if (tg.initDataUnsafe.user) {
        userId = tg.initDataUnsafe.user.id;
        showPlayer();
    } else {
        userId = 'browserTestUser';
        alert('Имитация: Вы вошли как ' + userId);
        showPlayer();
    }
});

function showPlayer() {
    authScreen.style.display = 'none';
    playerContainer.style.display = 'flex';
    initializePlayer();
}

function initializePlayer() {
    let isSubmenuOpen = false;
    let isProgressBarActivated = false;
    let lastTime = 0;
    let hasViewed = false;

    loadVideo();
    initializeTheme();
    initializeTooltips();

    const userAvatar = document.getElementById('userAvatar');
    if (tg.initDataUnsafe.user && tg.initDataUnsafe.user.photo_url) {
        userAvatar.src = tg.initDataUnsafe.user.photo_url;
    } else {
        userAvatar.src = 'https://via.placeholder.com/40';
    }

    const fullscreenBtn = document.querySelector('.fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFullscreen();
        });
    }

    reactionButtons.forEach(button => {
        button.removeEventListener('click', handleReaction);
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleReaction(button.dataset.type);
        });
    });

    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSubmenu();
    });

    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadCurrentVideo();
    });

    toggleReactionBar.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleReactionBarVisibility();
    });

    // Удержание на userAvatar для показа/скрытия списка видео
    let holdTimeout = null;
    const holdDuration = 2000; // 2 секунды
    let isHolding = false;

    function startHold(e) {
        e.preventDefault();
        if (holdTimeout || isHolding) return;
        isHolding = true;
        userAvatar.classList.add('holding');
        holdTimeout = setTimeout(() => {
            showVideoManagementList();
            holdTimeout = null;
            isHolding = false;
            userAvatar.classList.remove('holding');
        }, holdDuration);
    }

    function stopHold(e) {
        if (holdTimeout) {
            clearTimeout(holdTimeout);
            holdTimeout = null;
        }
        isHolding = false;
        userAvatar.classList.remove('holding');
    }

    // Десктоп
    userAvatar.addEventListener('mousedown', startHold);
    userAvatar.addEventListener('mouseup', stopHold);
    userAvatar.addEventListener('mouseleave', stopHold);

    // Мобильные устройства
    userAvatar.addEventListener('touchstart', startHold, { passive: false });
    userAvatar.addEventListener('touchend', stopHold);
    userAvatar.addEventListener('touchcancel', stopHold);
    userAvatar.addEventListener('touchmove', stopHold, { passive: false });

    // Закрытие при клике вне списка
    document.addEventListener('click', (e) => {
        const list = document.getElementById('videoManagementList');
        if (list.classList.contains('visible') && !list.contains(e.target) && e.target !== userAvatar) {
            list.classList.remove('visible');
        }
    });

    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    function handleLoadedMetadata() {
        video.muted = true;
        video.play().then(() => {
            video.pause();
            video.muted = false;
        }).catch(err => console.error('Unlock error:', err));
        const videoData = videoDataStore[currentVideoIndex];
        videoData.duration = video.duration;
        progressRange.max = video.duration;
        progressRange.value = videoData.lastPosition || 0;
        updateVideoCache(currentVideoIndex);
        updateRating();
    }

    video.addEventListener('play', handlePlay);
    function handlePlay() {
        const videoData = videoDataStore[currentVideoIndex];
        if (!hasViewed && userId) {
            videoData.views.add(userId);
            hasViewed = true;
            updateCounters();
        }
        if (isProgressBarActivated) progressBar.classList.remove('visible');
        commentsWindow.classList.remove('visible');
        preloadNextVideo();
    }

    video.addEventListener('pause', handlePause);
    function handlePause() {
        if (!isProgressBarActivated) isProgressBarActivated = true;
        progressBar.classList.add('visible');
        videoDataStore[currentVideoIndex].lastPosition = video.currentTime;
        updateVideoCache(currentVideoIndex);
    }

    video.addEventListener('ended', handleEnded);
    function handleEnded() {
        const videoData = videoDataStore[currentVideoIndex];
        if (video.currentTime >= video.duration * 0.9) videoData.replays++;
        videoData.lastPosition = 0;
        updateVideoCache(currentVideoIndex);
        playNextVideo();
    }

    video.addEventListener('timeupdate', handleTimeUpdate);
    function handleTimeUpdate() {
        const videoData = videoDataStore[currentVideoIndex];
        videoData.viewTime += video.currentTime - lastTime;
        videoData.lastPosition = video.currentTime;
        lastTime = video.currentTime;
        progressRange.value = video.currentTime;
        updateVideoCache(currentVideoIndex);
        updateRating();
    }

    progressRange.addEventListener('input', handleProgressInput);
    function handleProgressInput(e) {
        video.currentTime = e.target.value;
        videoDataStore[currentVideoIndex].lastPosition = video.currentTime;
        updateVideoCache(currentVideoIndex);
    }

    setupSwipeAndMouseEvents();

    sendCommentBtn.addEventListener('click', addComment);
    commentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addComment();
    });

    submenuUpload.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        videoUpload.click();
        toggleSubmenu();
    });
    videoUpload.addEventListener('change', handleVideoUpload);
    publishBtn.addEventListener('click', publishVideo);
    cancelBtn.addEventListener('click', cancelUpload);

    submenuChat.addEventListener('click', handleSubmenuChat);
    sendChatMessage.addEventListener('click', sendChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });
    closeChat.addEventListener('click', () => chatModal.classList.remove('visible'));

    shareTelegram.addEventListener('click', shareViaTelegram);
    copyLink.addEventListener('click', copyVideoLink);
    closeShare.addEventListener('click', () => shareModal.classList.remove('visible'));

    themeToggle.addEventListener('click', toggleTheme);

    const dragHandle = document.querySelector('.drag-handle');
    dragHandle.addEventListener('mousedown', startDragging);
    dragHandle.addEventListener('touchstart', startDragging, { passive: false });

    function toggleFullscreen() {
        if (window.Telegram && window.Telegram.WebApp) {
            Telegram.WebApp.expand();
            showNotification('Экран уже заполнен');
        } else {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error('Ошибка:', err));
            } else {
                document.exitFullscreen().catch(err => console.error('Ошибка:', err));
            }
        }
    }

    function downloadCurrentVideo() {
        const videoUrl = video.src;
        if (!videoUrl) {
            alert('Нет видео для загрузки!');
            return;
        }

        uploadBtn.classList.add('downloading');
        uploadBtn.style.setProperty('--progress', '0%');

        fetch(videoUrl)
            .then(response => {
                const total = Number(response.headers.get('content-length'));
                let loaded = 0;

                const reader = response.body.getReader();
                const stream = new ReadableStream({
                    start(controller) {
                        function push() {
                            reader.read().then(({ done, value }) => {
                                if (done) {
                                    controller.close();
                                    return;
                                }
                                loaded += value.length;
                                const progress = total ? (loaded / total) * 100 : simulateProgress();
                                uploadBtn.style.setProperty('--progress', `${progress}%`);
                                controller.enqueue(value);
                                push();
                            });
                        }
                        push();
                    }
                });

                return new Response(stream).blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `video_${Date.now()}.mp4`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setTimeout(() => {
                    uploadBtn.classList.remove('downloading');
                    uploadBtn.style.setProperty('--progress', '0%');
                }, 500);
            })
            .catch(err => {
                console.error('Ошибка загрузки:', err);
                alert('Не удалось скачать видео!');
                uploadBtn.classList.remove('downloading');
                uploadBtn.style.setProperty('--progress', '0%');
            });
    }

    function simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress >= 100) {
                clearInterval(interval);
            }
            uploadBtn.style.setProperty('--progress', `${progress}%`);
        }, 200);
        return progress;
    }

    function startDragging(e) {
        e.preventDefault();
        let startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        let isDragging = true;

        function onMove(e) {
            if (!isDragging) return;
            const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 50) {
                commentsWindow.classList.remove('visible');
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
            }
        }

        function onEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    function toggleSubmenu() {
        isSubmenuOpen = !isSubmenuOpen;
        submenuUpload.classList.toggle('active', isSubmenuOpen);
        submenuChat.classList.toggle('active', isSubmenuOpen);
    }

    function toggleReactionBarVisibility() {
        if (reactionBar.classList.contains('visible')) {
            reactionBar.classList.remove('visible');
            toggleReactionBar.classList.remove('active');
            toggleReactionBar.innerHTML = '<i class="fas fa-arrow-right"></i>';
        } else {
            reactionBar.classList.add('visible');
            toggleReactionBar.classList.add('active');
            toggleReactionBar.innerHTML = '<i class="fas fa-arrow-left"></i>';
            setTimeout(() => {
                if (reactionBar.classList.contains('visible')) {
                    reactionBar.classList.remove('visible');
                    toggleReactionBar.classList.remove('active');
                    toggleReactionBar.innerHTML = '<i class="fas fa-arrow-right"></i>';
                }
            }, 15000);
        }
    }

    function toggleVideoPlayback() {
        if (video.paused) {
            video.play().catch(err => console.error('Play error:', err));
        } else {
            video.pause();
        }
    }

    function handleReaction(type) {
        if (!userId) return;
        const videoData = videoDataStore[currentVideoIndex];
        if (type === 'like') {
            if (videoData.userLikes.has(userId)) {
                videoData.userLikes.delete(userId);
                videoData.likes--;
            } else {
                if (videoData.userDislikes.has(userId)) {
                    videoData.userDislikes.delete(userId);
                    videoData.dislikes--;
                }
                videoData.userLikes.add(userId);
                videoData.likes++;
                showReaction('like');
            }
        } else if (type === 'dislike') {
            if (videoData.userDislikes.has(userId)) {
                videoData.userDislikes.delete(userId);
                videoData.dislikes--;
            } else {
                if (videoData.userLikes.has(userId)) {
                    videoData.userLikes.delete(userId);
                    videoData.likes--;
                }
                videoData.userDislikes.add(userId);
                videoData.dislikes++;
                showReaction('dislike');
            }
        } else if (type === 'comment') {
            commentsWindow.classList.toggle('visible');
            if (commentsWindow.classList.contains('visible')) commentInput.focus();
        } else if (type === 'share') {
            shareModal.classList.add('visible');
            videoData.shares++;
            updateCounters();
            updateVideoCache(currentVideoIndex);
        }
        updateCounters();
        updateVideoCache(currentVideoIndex);
    }

    function showReaction(type) {
        reactionAnimation.innerHTML = type === 'like' ? '<i class="fas fa-thumbs-up"></i>' : '<i class="fas fa-thumbs-down"></i>';
        reactionAnimation.classList.add('show');
        setTimeout(() => reactionAnimation.classList.remove('show'), 2000);
    }

    function setupSwipeAndMouseEvents() {
        let startX = 0, startY = 0, endX = 0, endY = 0;
        let touchTimeout;

        swipeArea.addEventListener('touchstart', handleTouchStart, { passive: false });
        swipeArea.addEventListener('touchmove', throttle(handleTouchMove, 16), { passive: false });
        swipeArea.addEventListener('touchend', handleTouchEnd);

        swipeArea.addEventListener('mousedown', handleMouseStart);
        swipeArea.addEventListener('mousemove', throttle(handleMouseMove, 16));
        swipeArea.addEventListener('mouseup', handleMouseEnd);

        function handleTouchStart(e) {
            e.preventDefault();
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            clearTimeout(touchTimeout);
            touchTimeout = setTimeout(() => toggleVideoPlayback(), 200);
        }

        function handleTouchMove(e) {
            endX = e.touches[0].clientX;
            endY = e.touches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(touchTimeout);
            }
        }

        function handleTouchEnd() {
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const swipeThreshold = 50;

            if (Math.abs(deltaX) < swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
                return;
            }

            clearTimeout(touchTimeout);
            if (userId) {
                if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 0) playNextVideo();
                    else playPreviousVideo();
                } else if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
                    if (deltaY < 0) handleReaction('like');
                    else handleReaction('dislike');
                }
            }
        }

        let isDragging = false;
        function handleMouseStart(e) {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            clearTimeout(touchTimeout);
            touchTimeout = setTimeout(() => toggleVideoPlayback(), 200);
        }

        function handleMouseMove(e) {
            if (!isDragging) return;
            endX = e.clientX;
            endY = e.clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(touchTimeout);
            }
        }

        function handleMouseEnd() {
            if (!isDragging) return;
            isDragging = false;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const swipeThreshold = 50;

            if (Math.abs(deltaX) < swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
                return;
            }

            clearTimeout(touchTimeout);
            if (userId) {
                if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 0) playNextVideo();
                    else playPreviousVideo();
                } else if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
                    if (deltaY < 0) handleReaction('like');
                    else handleReaction('dislike');
                }
            }
        }
    }

    function playNextVideo() {
        recommendNextVideo();
        loadVideo('left');
        hasViewed = false;
        if (!isProgressBarActivated) progressBar.classList.remove('visible');
    }

    function playPreviousVideo() {
        currentVideoIndex = (currentVideoIndex - 1 + videoPlaylist.length) % videoPlaylist.length;
        loadVideo('right');
        hasViewed = false;
        if (!isProgressBarActivated) progressBar.classList.remove('visible');
    }

    function loadVideo(direction = 'left') {
        const fadeOutClass = direction === 'left' ? 'fade-out-left' : 'fade-out-right';
        video.classList.remove('fade-in');
        video.classList.add(fadeOutClass);
        video.pause();
        setTimeout(() => {
            videoSource.src = videoPlaylist[currentVideoIndex];
            video.load();
            video.addEventListener('canplay', () => {
                const lastPosition = videoDataStore[currentVideoIndex].lastPosition;
                video.classList.remove('fade-out-left', 'fade-out-right');
                video.classList.add('fade-in');
                if (lastPosition > 0 && lastPosition < video.duration) {
                    showResumePrompt(lastPosition);
                } else {
                    video.play().catch(err => console.log("Ошибка воспроизведения:", err));
                }
            }, { once: true });
            updateCounters();
            updateComments();
            updateRating();
            updateDescription();
            preloadNextVideo();
        }, 300);
    }

    function showResumePrompt(lastPosition) {
        const resumePrompt = document.createElement('div');
        resumePrompt.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--notification-bg); color: var(--notification-text);
            padding: 20px; border-radius: 10px; z-index: 100; text-align: center;
        `;
        resumePrompt.innerHTML = `
            <p>Продолжить с ${formatTime(lastPosition)}?</p>
            <button id="resumeYes" style="margin: 5px; padding: 5px 15px; background: var(--button-bg); color: #fff; border: none; border-radius: 5px; cursor: pointer;">Да</button>
            <button id="resumeNo" style="margin: 5px; padding: 5px 15px; background: var(--button-bg); color: #fff; border: none; border-radius: 5px; cursor: pointer;">Нет</button>
        `;
        document.body.appendChild(resumePrompt);

        document.getElementById('resumeYes').addEventListener('click', () => {
            video.currentTime = lastPosition;
            video.play();
            document.body.removeChild(resumePrompt);
        });

        document.getElementById('resumeNo').addEventListener('click', () => {
            video.currentTime = 0;
            video.play();
            document.body.removeChild(resumePrompt);
        });
    }

    function addComment() {
        const videoData = videoDataStore[currentVideoIndex];
        const text = commentInput.value.trim();
        if (text) {
            videoData.comments.push({
                text,
                replyTo: commentInput.dataset.replyTo || null
            });
            commentInput.value = '';
            commentInput.dataset.replyTo = '';
            commentInput.placeholder = 'Введите комментарий';
            updateComments();
            updateCounters();
        }
    }

    function updateComments() {
        const videoData = videoDataStore[currentVideoIndex];
        commentsList.innerHTML = '';
        videoData.comments.forEach((comment, idx) => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.innerHTML = `
                <img src="https://via.placeholder.com/30" alt="User">
                <div class="comment-text">${comment.text}${comment.replyTo ? `<blockquote>Цитата: ${videoData.comments[comment.replyTo].text}</blockquote>` : ''}</div>
                <button class="reply-btn" data-index="${idx}">Ответить</button>
            `;
            commentsList.appendChild(commentEl);
            commentEl.querySelector('.reply-btn').addEventListener('click', () => replyToComment(idx));
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    }

    function replyToComment(index) {
        commentInput.dataset.replyTo = index;
        commentInput.placeholder = `Ответ на: "${videoDataStore[currentVideoIndex].comments[index].text.slice(0, 20)}..."`;
        commentInput.focus();
    }

    function updateDescription() {
        let descriptionEl = document.getElementById('videoDescriptionDisplay');
        if (!descriptionEl) {
            descriptionEl = document.createElement('div');
            descriptionEl.id = 'videoDescriptionDisplay';
            const videoWrapper = document.querySelector('.video-wrapper');
            videoWrapper.insertAdjacentElement('afterend', descriptionEl);
        }
        descriptionEl.textContent = videoDataStore[currentVideoIndex].description || 'Описание отсутствует';
    }

    function updateChat() {
        const videoData = videoDataStore[currentVideoIndex];
        chatMessages.innerHTML = '';
        videoData.chatMessages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.sender === userId ? 'sent' : 'received'}`;
            messageEl.textContent = msg.text;
            chatMessages.appendChild(messageEl);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendChat() {
        const videoData = videoDataStore[currentVideoIndex];
        const text = chatInput.value.trim();
        if (text) {
            videoData.chatMessages.push({ sender: userId, text });
            chatInput.value = '';
            updateChat();
            updateVideoCache(currentVideoIndex);
            setTimeout(() => {
                videoData.chatMessages.push({ sender: videoData.authorId, text: "Спасибо за сообщение!" });
                updateChat();
                updateVideoCache(currentVideoIndex);
            }, 1000);
        }
    }

    function handleSubmenuChat(e) {
        e.stopPropagation();
        chatModal.classList.add('visible');
        updateChat();
        toggleSubmenu();
    }

    function shareViaTelegram() {
        const videoUrl = videoPlaylist[currentVideoIndex];
        const text = `Смотри это крутое видео: ${videoUrl}`;
        if (tg.isVersionGte('6.0')) {
            tg.sendData(JSON.stringify({ type: 'share', text }));
        } else {
            alert('Имитация: Отправлено в Telegram: ' + text);
        }
        shareModal.classList.remove('visible');
    }

    function copyVideoLink() {
        const videoUrl = videoPlaylist[currentVideoIndex];
        navigator.clipboard.writeText(videoUrl).then(() => {
            showNotification('Ссылка скопирована!');
            shareModal.classList.remove('visible');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            showNotification('Не удалось скопировать ссылку');
        });
    }

    function handleVideoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 100 * 1024 * 1024;
        const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

        if (file.size > maxSize) {
            showNotification('Файл слишком большой! Максимум 100 МБ.');
            return;
        }

        if (!validTypes.includes(file.type)) {
            showNotification('Неподдерживаемый формат! Используйте MP4, MOV или WebM.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const buffer = event.target.result;
            const uint = new Uint8Array(buffer.slice(0, 4));
            const isSuspicious = uint.every(byte => byte === 0);
            if (isSuspicious) {
                showNotification('Файл подозрительный и не может быть загружен.');
                return;
            }

            uploadModal.classList.add('visible');
            uploadProgress.style.width = '0%';
            uploadPreview.style.display = 'none';
            publishBtn.disabled = true;

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 10;
                uploadProgress.style.width = `${progress}%`;
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    uploadPreview.src = URL.createObjectURL(file);
                    uploadPreview.style.display = 'block';
                    publishBtn.disabled = false;
                    uploadedFileUrl = URL.createObjectURL(file);
                }
            }, 200);
        };
        reader.onerror = () => showNotification('Ошибка при чтении файла!');
        reader.readAsArrayBuffer(file);
    }

    function publishVideo() {
        if (uploadedFileUrl) {
            cleanVideoPlaylist();
            const duration = uploadPreview.duration;
            const description = document.getElementById('videoDescription')?.value || '';
            videoPlaylist.push(uploadedFileUrl);
            videoDataStore.push({
                views: new Set(),
                likes: 0,
                dislikes: 0,
                userLikes: new Set(),
                userDislikes: new Set(),
                comments: [],
                shares: 0,
                viewTime: 0,
                replays: 0,
                duration: duration,
                authorId: userId,
                lastPosition: 0,
                chatMessages: [],
                description: description
            });

            addVideoToManagementList(uploadedFileUrl, description);

            if (channels[userId]) {
                channels[userId].videos.push(uploadedFileUrl);
                localStorage.setItem('channels', JSON.stringify(channels));
            }

            currentVideoIndex = videoPlaylist.length - 1;
            loadVideo();
            updateVideoCache(currentVideoIndex);
            showNotification('Видео успешно загружено и добавлено в ваш канал!');
            uploadModal.classList.remove('visible');
            document.getElementById('videoDescription').value = '';
            uploadedFileUrl = null;
        }
    }

    function cancelUpload() {
        if (uploadedFileUrl) {
            URL.revokeObjectURL(uploadedFileUrl);
            uploadedFileUrl = null;
        }
        uploadModal.classList.remove('visible');
    }

    function addVideoToManagementList(url, description) {
        const managementList = document.getElementById('videoManagementList') || createManagementList();
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.innerHTML = `
            <span>${description || 'Без описания'}</span>
            <button class="edit-btn" data-url="${url}">Редактировать</button>
            <button class="delete-btn" data-url="${url}">Удалить</button>
        `;
        managementList.appendChild(videoItem);

        videoItem.querySelector('.edit-btn').addEventListener('click', () => editVideo(url));
        videoItem.querySelector('.delete-btn').addEventListener('click', () => deleteVideo(url));
    }

    function createManagementList() {
        const list = document.createElement('div');
        list.id = 'videoManagementList';
        list.style.cssText = 'position: absolute; bottom: 6vh; left: 2vw; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 10px; z-index: 100; display: none;';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-list-btn';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', () => {
            list.classList.remove('visible');
        });
        list.appendChild(closeBtn);
        document.body.appendChild(list);
        return list;
    }

    function editVideo(url) {
        const index = videoPlaylist.indexOf(url);
        if (index === -1) return;
        const newDescription = prompt('Введите новое описание:', videoDataStore[index].description);
        if (newDescription !== null) {
            videoDataStore[index].description = newDescription;
            updateVideoCache(index);
            document.querySelector(`.video-item [data-url="${url}"]`).parentElement.querySelector('span').textContent = newDescription || 'Без описания';
            showNotification('Описание обновлено!');
            if (currentVideoIndex === index) updateDescription();
        }
    }

    function deleteVideo(url) {
        const index = videoPlaylist.indexOf(url);
        if (index === -1) return;
        if (confirm('Удалить это видео?')) {
            videoPlaylist.splice(index, 1);
            videoDataStore.splice(index, 1);
            localStorage.removeItem(`videoData_${url}`);
            URL.revokeObjectURL(url);
            document.querySelector(`.video-item [data-url="${url}"]`).parentElement.remove();
            if (currentVideoIndex === index) {
                currentVideoIndex = Math.min(currentVideoIndex, videoPlaylist.length - 1);
                loadVideo();
            }
            showNotification('Видео удалено!');
        }
    }

    function showVideoManagementList() {
        const list = document.getElementById('videoManagementList');
        if (list.classList.contains('visible')) {
            list.classList.remove('visible');
        } else {
            list.classList.add('visible');
        }
    }

    function updateCounters() {
        const videoData = videoDataStore[currentVideoIndex];
        if (viewCountEl) viewCountEl.textContent = videoData.views.size;
        if (likeCountEl) likeCountEl.textContent = videoData.likes;
        if (dislikeCountEl) dislikeCountEl.textContent = videoData.dislikes;
        if (commentCountEl) commentCountEl.textContent = videoData.comments.length;
        if (shareCountEl) shareCountEl.textContent = videoData.shares;
        updateRating();
    }

    function calculateVideoScore(videoData, duration) {
        const avgViewTimePerView = videoData.viewTime / (videoData.views.size || 1);
        let viewTimeRatio = avgViewTimePerView / duration;
        if (viewTimeRatio > 1) viewTimeRatio = 1 + (videoData.replays / (videoData.views.size || 1));
        const rawScore = (videoData.likes * 5.0) + (videoData.comments.length * 10.0) + (videoData.shares * 15.0) + (videoData.viewTime * 0.1) + (videoData.replays * 20.0) * (1 + viewTimeRatio);
        const maxPossibleScore = 50;
        const normalizedScore = Math.max(0, Math.min(5, (rawScore / maxPossibleScore) * 5));
        return normalizedScore;
    }

    function updateRating() {
        const videoData = videoDataStore[currentVideoIndex];
        const duration = videoData.duration || 300;
        const score = calculateVideoScore(videoData, duration);
        const fullStars = Math.floor(score);
        const halfStar = score % 1 >= 0.5 ? 1 : 0;
        const emptyStars = Math.max(0, 5 - fullStars - halfStar);
        if (ratingEl) ratingEl.innerHTML = '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    function recommendNextVideo() {
        const scores = videoPlaylist.map((src, index) => {
            const data = videoDataStore[index];
            const duration = data.duration || 300;
            return { index, score: calculateVideoScore(data, duration) };
        });
        scores.sort((a, b) => b.score - a.score);
        const nextVideo = scores.find(item => item.index !== currentVideoIndex) || scores[0];
        currentVideoIndex = nextVideo.index;
    }

    function preloadNextVideo() {
        cleanPreloadedVideos();
        const nextIndex = (currentVideoIndex + 1) % videoPlaylist.length;
        if (!preloadedVideos[nextIndex]) {
            const preloadVideo = document.createElement('video');
            preloadVideo.src = videoPlaylist[nextIndex];
            preloadVideo.preload = 'auto';
            preloadedVideos[nextIndex] = preloadVideo;
        }
        const prevIndex = (currentVideoIndex - 1 + videoPlaylist.length) % videoPlaylist.length;
        if (!preloadedVideos[prevIndex]) {
            const preloadVideo = document.createElement('video');
            preloadVideo.src = videoPlaylist[prevIndex];
            preloadVideo.preload = 'auto';
            preloadedVideos[prevIndex] = preloadVideo;
        }
    }

    function cleanPreloadedVideos() {
        const keys = Object.keys(preloadedVideos).map(Number);
        if (keys.length <= MAX_PRELOAD_SIZE) return;

        const current = currentVideoIndex;
        const prev = (current - 1 + videoPlaylist.length) % videoPlaylist.length;
        const next = (current + 1) % videoPlaylist.length;

        for (let key of keys) {
            if (key !== current && key !== prev && key !== next) {
                const videoEl = preloadedVideos[key];
                if (videoEl && videoEl.src) URL.revokeObjectURL(videoEl.src);
                delete preloadedVideos[key];
            }
        }
    }

    function cleanVideoPlaylist() {
        if (videoPlaylist.length > MAX_PLAYLIST_SIZE) {
            const removeCount = videoPlaylist.length - MAX_PLAYLIST_SIZE;
            for (let i = 0; i < removeCount; i++) {
                const url = videoPlaylist[i];
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                localStorage.removeItem(`videoData_${url}`);
            }
            videoPlaylist.splice(0, removeCount);
            videoDataStore.splice(0, removeCount);
            currentVideoIndex -= removeCount;
            if (currentVideoIndex < 0) currentVideoIndex = 0;
        }
    }

    function updateVideoCache(index) {
        const videoData = videoDataStore[index];
        const url = videoPlaylist[index];
        const cacheData = {
            duration: videoData.duration,
            lastPosition: videoData.lastPosition,
            userLikes: Array.from(videoData.userLikes),
            userDislikes: Array.from(videoData.userDislikes),
            comments: videoData.comments,
            chatMessages: videoData.chatMessages,
            likes: videoData.likes,
            dislikes: videoData.dislikes,
            shares: videoData.shares,
            viewTime: videoData.viewTime,
            replays: videoData.replays,
            views: Array.from(videoData.views),
            description: videoData.description
        };
        localStorage.setItem(`videoData_${url}`, JSON.stringify(cacheData));
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    function toggleTheme() {
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
    }

    function initializeTooltips() {
        const isFirstVisit = !localStorage.getItem('hasSeenTooltips');
        if (isFirstVisit) {
            tooltips.forEach(tooltip => {
                tooltip.classList.add('visible');
                setTimeout(() => tooltip.classList.remove('visible'), 5000);
            });
            localStorage.setItem('hasSeenTooltips', 'true');
        }
    }

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
}