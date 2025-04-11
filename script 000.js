// Инициализация Supabase
const supabaseUrl = 'https://seckthcbnslsropswpik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2t0aGNibnNsc3JvcHN3cGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNzU3ODMsImV4cCI6MjA1ODc1MTc4M30.JoI03vFuRd-7sApD4dZ-zeBfUQlZrzRg7jtz0HgnJyI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

class VideoManager {
    constructor() {
        this.videoPlaylist = [];
        this.videoDataStore = [];
        this.currentVideoIndex = 0;
        this.preloadedVideos = {};
        this.MAX_PRELOAD_SIZE = 3;
        this.MAX_PLAYLIST_SIZE = 10;
        this.userId = null;
        this.uploadedFileUrl = null;
        this.tg = window.Telegram?.WebApp;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.touchTimeout = null; // Добавляем как свойство класса

        if (this.tg) {
            this.tg.ready();
            console.log('Telegram Web App инициализирован, данные:', this.tg.initDataUnsafe);
        } else {
            console.warn('Telegram Web App SDK не загружен. Работа в режиме браузера.');
        }

        this.channels = JSON.parse(localStorage.getItem('channels')) || {};
    }

    async init() {
        console.log('Скрипт обновлён, версия 7');
        this.tg = window.Telegram?.WebApp;
        if (this.tg) {
            this.tg.ready();
            console.log('Полные данные initDataUnsafe:', this.tg.initDataUnsafe);
            if (this.tg.initDataUnsafe?.user) {
                this.userId = String(this.tg.initDataUnsafe.user.id);
                console.log('Telegram инициализирован, userId:', this.userId);
            } else {
                console.warn('Нет данных пользователя Telegram, используем тестовый режим');
                this.userId = 'testUser_' + Date.now();
                console.log('Тестовый userId:', this.userId);
            }
        } else {
            console.warn('Telegram Web App не доступен, работа в режиме браузера');
            this.userId = 'testUser_' + Date.now();
            console.log('Тестовый userId:', this.userId);
        }
        this.bindElements();
        this.showPlayer();
        this.bindEvents();
        await this.loadInitialVideos();
    }

    bindElements() {
        this.authScreen = document.getElementById('authScreen');
        this.playerContainer = document.getElementById('playerContainer');
        this.authBtn = document.getElementById('authBtn');
        this.registerChannelBtn = document.getElementById('registerChannelBtn');
        this.userAvatar = document.getElementById('userAvatar');
        this.video = document.getElementById('videoPlayer');
        this.videoSource = document.getElementById('videoSource');
        this.viewCountEl = document.querySelector('.view-count');
        this.viewCountSpan = document.getElementById('viewCount');
        this.likeCountEl = document.getElementById('likeCount');
        this.dislikeCountEl = document.getElementById('dislikeCount');
        this.commentCountEl = document.getElementById('commentCount');
        this.shareCountEl = document.getElementById('shareCount');
        this.ratingEl = document.getElementById('rating');
        this.reactionBar = document.getElementById('reactionBar');
        this.reactionButtons = document.querySelectorAll('.reaction-btn');
        this.swipeArea = document.getElementById('swipeArea');
        this.reactionAnimation = document.getElementById('reactionAnimation');
        this.progressBar = document.getElementById('progressBar');
        this.progressRange = document.getElementById('progressRange');
        this.commentsWindow = document.getElementById('commentsWindow');
        this.commentsList = document.getElementById('commentsList');
        this.commentInput = document.getElementById('commentInput');
        this.sendCommentBtn = document.getElementById('sendComment');
        this.themeToggle = document.querySelector('.theme-toggle');
        this.toggleReactionBar = document.querySelector('.toggle-reaction-bar');
        this.plusBtn = document.querySelector('.plus-btn');
        this.uploadBtn = document.querySelector('.upload-btn');
        this.submenuUpload = document.getElementById('uploadVideo');
        this.submenuChat = document.getElementById('chatAuthor');
        this.uploadModal = document.getElementById('uploadModal');
        this.uploadProgress = document.getElementById('progressBarInner');
        this.uploadPreview = document.getElementById('uploadPreview');
        this.publishBtn = document.getElementById('publishBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.chatModal = document.getElementById('chatModal');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendChatMessage = document.getElementById('sendChatMessage');
        this.closeChat = document.getElementById('closeChat');
        this.shareModal = document.getElementById('shareModal');
        this.shareTelegram = document.getElementById('shareTelegram');
        this.copyLink = document.getElementById('copyLink');
        this.closeShare = document.getElementById('closeShare');
        this.videoUpload = document.createElement('input');
        this.videoUpload.type = 'file';
        this.videoUpload.accept = 'video/mp4,video/quicktime,video/webm';
        this.videoUpload.style.display = 'none';
        document.body.appendChild(this.videoUpload);

        console.log('Элементы привязаны, authBtn:', this.authBtn ? 'найден' : 'не найден');
    }

    bindEvents() {
        if (this.authBtn) {
            this.authBtn.addEventListener('click', () => {
                console.log('Клик по #authBtn зарегистрирован');
                this.handleAuth();
            });
        } else {
            console.error('Элемент #authBtn не найден при привязке событий');
        }
        if (this.registerChannelBtn) this.bindRegisterChannelBtn();
        this.reactionButtons.forEach(btn => btn.addEventListener('click', (e) => this.handleReaction(btn.dataset.type, e)));
        this.plusBtn.addEventListener('click', (e) => this.toggleSubmenu(e));
        this.uploadBtn.addEventListener('click', (e) => this.downloadCurrentVideo(e));
        this.toggleReactionBar.addEventListener('click', (e) => this.toggleReactionBarVisibility(e));
        this.video.addEventListener('loadedmetadata', () => this.handleLoadedMetadata(), { once: true });
        this.video.addEventListener('play', () => this.handlePlay());
        this.video.addEventListener('pause', () => this.handlePause());
        this.video.addEventListener('ended', () => this.handleEnded());
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.progressRange.addEventListener('input', (e) => this.handleProgressInput(e));
        this.setupSwipeAndMouseEvents();
        this.sendCommentBtn.addEventListener('click', () => this.addComment());
        this.commentInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.addComment());
        this.submenuUpload.addEventListener('click', (e) => this.handleSubmenuUpload(e));
        this.videoUpload.addEventListener('change', (e) => this.handleVideoUpload(e));
        this.publishBtn.addEventListener('click', () => this.publishVideo());
        this.cancelBtn.addEventListener('click', () => this.cancelUpload());
        this.submenuChat.addEventListener('click', (e) => this.handleSubmenuChat(e));
        this.sendChatMessage.addEventListener('click', () => this.sendChat());
        this.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.sendChat());
        this.closeChat.addEventListener('click', () => this.chatModal.classList.remove('visible'));
        this.shareTelegram.addEventListener('click', () => this.shareViaTelegram());
        this.copyLink.addEventListener('click', () => this.copyVideoLink());
        this.closeShare.addEventListener('click', () => this.shareModal.classList.remove('visible'));
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        document.querySelector('.drag-handle')?.addEventListener('mousedown', (e) => this.startDragging(e));
        document.querySelector('.drag-handle')?.addEventListener('touchstart', (e) => this.startDragging(e), { passive: false });
        document.querySelector('.fullscreen-btn')?.addEventListener('click', (e) => this.toggleFullscreen(e));
        document.addEventListener('click', (e) => this.hideManagementListOnClickOutside(e));
        console.log('События привязаны');
    }

    handleAuth() {
        console.log('handleAuth вызван');
        if (this.tg?.initDataUnsafe?.user) {
            this.userId = String(this.tg.initDataUnsafe.user.id);
            this.showNotification('Вход успешен: ' + this.userId);
            this.showPlayer();
        } else {
            this.userId = 'browserTestUser_' + Date.now();
            this.showNotification('Имитация входа: ' + this.userId);
            this.showPlayer();
        }
    }

    showPlayer() {
        console.log('showPlayer вызван');
        if (!this.authScreen) console.error('authScreen не найден в DOM');
        if (!this.playerContainer) console.error('playerContainer не найден в DOM');
        if (this.authScreen && this.playerContainer) {
            this.authScreen.style.display = 'none';
            this.playerContainer.style.display = 'flex';
            this.initializePlayer();
            if (this.userAvatar) {
                console.log('Привязываем события для userAvatar');
                this.bindUserAvatar();
            } else {
                console.error('Элемент #userAvatar не найден после отображения playerContainer!');
            }
        } else {
            console.error('Ошибка: authScreen или playerContainer не найдены');
        }
    }

    bindRegisterChannelBtn() {
        this.registerChannelBtn.addEventListener('click', () => this.registerChannel());
    }

    bindUserAvatar() {
        if (!this.userAvatar) {
            console.error('Элемент #userAvatar не найден при вызове bindUserAvatar!');
            return;
        }

        this.userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Клик по аватару, isHolding:', this.isHolding);
            if (!this.isHolding) {
                const channel = this.channels[this.userId];
                if (channel && channel.link) {
                    if (this.tg?.isVersionGte('6.0')) {
                        this.tg.openTelegramLink(channel.link);
                        console.log('Открываем ссылку через Telegram:', channel.link);
                    } else {
                        window.open(channel.link, '_blank');
                        console.log('Открываем ссылку в новом окне:', channel.link);
                    }
                } else {
                    console.log('Канал не найден, регистрируем новый');
                    this.registerChannel();
                }
            }
        });

        const holdDuration = 2000;
        this.isHolding = false;

        const startHold = (e) => {
            e.preventDefault();
            if (this.touchTimeout || this.isHolding) return;
            this.isHolding = true;
            this.userAvatar.classList.add('holding');
            console.log('Начато удержание аватара');
            this.touchTimeout = setTimeout(() => {
                this.showVideoManagementList();
                this.touchTimeout = null;
                this.isHolding = false;
                this.userAvatar.classList.remove('holding');
                console.log('Показываем список управления видео');
            }, holdDuration);
        };

        const stopHold = () => {
            if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
                this.touchTimeout = null;
            }
            this.isHolding = false;
            this.userAvatar.classList.remove('holding');
            console.log('Удержание отменено');
        };

        this.userAvatar.addEventListener('mousedown', startHold);
        this.userAvatar.addEventListener('mouseup', stopHold);
        this.userAvatar.addEventListener('mouseleave', stopHold);
        this.userAvatar.addEventListener('touchstart', startHold, { passive: false });
        this.userAvatar.addEventListener('touchend', stopHold);
        this.userAvatar.addEventListener('touchcancel', stopHold);
        this.userAvatar.addEventListener('touchmove', stopHold, { passive: false });
    }

    async registerChannel() {
        if (!this.userId) {
            this.showNotification('Пожалуйста, войдите через Telegram.');
            return;
        }

        if (this.channels[this.userId]?.link) {
            this.showNotification('Канал уже зарегистрирован!');
            if (this.tg?.isVersionGte('6.0')) {
                this.tg.openTelegramLink(this.channels[this.userId].link);
            } else {
                window.open(this.channels[this.userId].link, '_blank');
            }
            return;
        }

        const channelLink = prompt('Введите ссылку на ваш Telegram-канал (например, https://t.me/yourchannel):');
        if (channelLink && channelLink.match(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/)) {
            this.channels[this.userId] = { videos: [], link: channelLink };
            localStorage.setItem('channels', JSON.stringify(this.channels));
            try {
                await supabase.from('users').upsert({ telegram_id: this.userId, channel_link: channelLink });
                this.showNotification('Канал успешно зарегистрирован!');
                if (this.authScreen.style.display !== 'none') this.showPlayer();
            } catch (error) {
                console.error('Ошибка регистрации канала:', error);
                this.showNotification('Ошибка при регистрации канала!');
            }
        } else {
            this.showNotification('Введите корректную ссылку на Telegram-канал.');
        }
    }

    initializePlayer() {
        this.isSubmenuOpen = false;
        this.isProgressBarActivated = false;
        this.lastTime = 0;
        this.hasViewed = false;
        this.isSwiping = false;

        if (this.userAvatar) {
            if (this.tg?.initDataUnsafe?.user?.photo_url) {
                console.log('Загружаем аватар из Telegram:', this.tg.initDataUnsafe.user.photo_url);
                this.userAvatar.src = this.tg.initDataUnsafe.user.photo_url;
            } else {
                console.log('Аватар из Telegram недоступен, используем заглушку');
                this.userAvatar.src = 'https://placehold.co/30';
            }
        } else {
            console.error('Элемент #userAvatar не найден');
        }

        this.initializeTheme();
        this.initializeTooltips();
        console.log('Плеер инициализирован');
    }

    async loadInitialVideos() {
        try {
            const { data, error } = await supabase
                .from('publicVideos')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.videoPlaylist = [];
            this.videoDataStore = [];

            if (data && data.length) {
                data.forEach(video => {
                    this.videoPlaylist.push(video.url);
                    this.videoDataStore.push({
                        views: new Set(video.views || []),
                        likes: video.likes || 0,
                        dislikes: video.dislikes || 0,
                        userLikes: new Set(video.user_likes || []),
                        userDislikes: new Set(video.user_dislikes || []),
                        comments: video.comments || [],
                        shares: video.shares || 0,
                        viewTime: video.view_time || 0,
                        replays: video.replays || 0,
                        duration: video.duration || 0,
                        authorId: video.author_id,
                        lastPosition: video.last_position || 0,
                        chatMessages: video.chat_messages || [],
                        description: video.description || ''
                    });
                });
            } else {
                this.videoPlaylist = [
                    "https://www.w3schools.com/html/mov_bbb.mp4",
                    "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
                    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"
                ];
                this.videoDataStore = this.videoPlaylist.map(() => ({
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
                }));
            }
            this.loadVideo();
            console.log('Видео загружены:', this.videoPlaylist);
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.showNotification(`Не удалось загрузить видео: ${error.message}`);
        }
    }

    handleLoadedMetadata() {
        this.video.muted = true;
        this.video.play().then(() => {
            this.video.pause();
            this.video.muted = false;
        }).catch(err => console.error('Unlock error:', err));
        const videoData = this.videoDataStore[this.currentVideoIndex];
        videoData.duration = this.video.duration;
        this.progressRange.max = this.video.duration;
        this.progressRange.value = videoData.lastPosition || 0;
        this.updateVideoCache(this.currentVideoIndex);
        this.updateRating();
    }

    handlePlay() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (!this.hasViewed && this.userId) {
            videoData.views.add(this.userId);
            this.hasViewed = true;
            this.updateCounters();
        }
        if (this.isProgressBarActivated) this.progressBar.classList.remove('visible');
        this.isProgressBarActivated = false;
        this.commentsWindow.classList.remove('visible');
        this.preloadNextVideo();
    }

    handlePause() {
        if (!this.isProgressBarActivated) {
            this.isProgressBarActivated = true;
            this.progressBar.classList.add('visible');
        }
        this.videoDataStore[this.currentVideoIndex].lastPosition = this.video.currentTime;
        this.updateVideoCache(this.currentVideoIndex);
    }

    handleEnded() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (this.video.currentTime >= this.video.duration * 0.9) videoData.replays++;
        videoData.lastPosition = 0;
        this.updateVideoCache(this.currentVideoIndex);
        this.playNextVideo();
    }

    handleTimeUpdate() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        videoData.viewTime += this.video.currentTime - this.lastTime;
        videoData.lastPosition = this.video.currentTime;
        this.lastTime = this.video.currentTime;
        this.progressRange.value = this.video.currentTime;
        this.updateVideoCache(this.currentVideoIndex);
        this.updateRating();
    }

    handleProgressInput(e) {
        this.video.currentTime = e.target.value;
        this.videoDataStore[this.currentVideoIndex].lastPosition = this.video.currentTime;
        this.updateVideoCache(this.currentVideoIndex);
    }

    setupSwipeAndMouseEvents() {
        this.swipeArea.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.swipeArea.addEventListener('touchmove', this.throttle((e) => this.handleTouchMove(e), 16), { passive: false });
        this.swipeArea.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        this.swipeArea.addEventListener('mousedown', (e) => this.handleMouseStart(e));
        this.swipeArea.addEventListener('mousemove', this.throttle((e) => this.handleMouseMove(e), 16));
        this.swipeArea.addEventListener('mouseup', (e) => this.handleMouseEnd(e));
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
        this.isSwiping = false;
    }

    handleTouchMove(e) {
        this.endX = e.touches[0].clientX;
        this.endY = e.touches[0].clientY;
        const deltaX = this.endX - this.startX;
        const deltaY = this.endY - this.startY;

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
            this.isSwiping = true;
        }
    }

    handleTouchEnd(e) {
        const deltaX = this.endX - this.startX;
        const deltaY = this.endY - this.startY;
        const swipeThresholdHorizontal = 50;
        const swipeThresholdVertical = 50;

        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            this.isSwiping = false;
            return;
        }

        if (this.touchTimeout) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
        }

        if (!this.userId) {
            this.showNotification('Войдите, чтобы ставить реакции');
            this.isSwiping = false;
            return;
        }

        if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
            console.log('Горизонтальный свайп:', deltaX > 0 ? 'вправо' : 'влево');
            if (deltaX > 0) this.playNextVideo();
            else this.playPreviousVideo();
            if (this.isProgressBarActivated) this.progressBar.classList.remove('visible');
            this.isProgressBarActivated = false;
        } else if (Math.abs(deltaY) > swipeThresholdVertical) {
            console.log('Вертикальный свайп:', deltaY < 0 ? 'вверх' : 'вниз');
            if (deltaY < 0) { // Свайп вверх = лайк
                this.handleReaction('like');
                this.showFloatingReaction('like', this.endX, this.startY);
            } else { // Свайп вниз = дизлайк
                this.handleReaction('dislike');
                this.showFloatingReaction('dislike', this.endX, this.startY);
            }
        }
        this.isSwiping = false;
    }

    handleMouseStart(e) {
        e.preventDefault();
        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
        this.isSwiping = false;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        this.endX = e.clientX;
        this.endY = e.clientY;
        const deltaX = this.endX - this.startX;
        const deltaY = this.endY - this.startY;
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
                this.touchTimeout = null;
            }
            this.isSwiping = true;
        }
    }

    handleMouseEnd(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        const deltaX = this.endX - this.startX;
        const deltaY = this.endY - this.startY;
        const swipeThresholdHorizontal = 50;
        const swipeThresholdVertical = 50;

        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            this.isSwiping = false;
            return;
        }

        if (this.touchTimeout) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
        }

        if (!this.userId) {
            this.showNotification('Войдите, чтобы ставить реакции');
            this.isSwiping = false;
            return;
        }

        if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
            console.log('Горизонтальный свайп:', deltaX > 0 ? 'вправо' : 'влево');
            if (deltaX > 0) this.playNextVideo();
            else this.playPreviousVideo();
            if (this.isProgressBarActivated) this.progressBar.classList.remove('visible');
            this.isProgressBarActivated = false;
        } else if (Math.abs(deltaY) > swipeThresholdVertical) {
            console.log('Вертикальный свайп:', deltaY < 0 ? 'вверх' : 'вниз');
            if (deltaY < 0) { // Свайп вверх = лайк
                this.handleReaction('like');
                this.showFloatingReaction('like', this.endX, this.startY);
            } else { // Свайп вниз = дизлайк
                this.handleReaction('dislike');
                this.showFloatingReaction('dislike', this.endX, this.startY);
            }
        }
        this.isSwiping = false;
    }

    showFloatingReaction(type, x, y) {
        const reaction = document.createElement('div');
        reaction.className = `floating-reaction ${type}`;
        reaction.innerHTML = type === 'like' ? '👍' : '👎';
        reaction.style.left = `${x}px`;
        reaction.style.top = `${y}px`;
        document.body.appendChild(reaction);
        setTimeout(() => reaction.remove(), 1500);
    }

    playNextVideo() {
        this.recommendNextVideo();
        this.loadVideo('left');
        this.hasViewed = false;
    }

    playPreviousVideo() {
        this.currentVideoIndex = (this.currentVideoIndex - 1 + this.videoPlaylist.length) % this.videoPlaylist.length;
        this.loadVideo('right');
        this.hasViewed = false;
    }

    loadVideo(direction = 'left') {
        const fadeOutClass = direction === 'left' ? 'fade-out-left' : 'fade-out-right';
        this.video.classList.remove('fade-in');
        this.video.classList.add(fadeOutClass);
        this.video.pause();
        setTimeout(() => {
            this.videoSource.src = this.videoPlaylist[this.currentVideoIndex];
            this.video.load();
            const timeout = setTimeout(() => {
                if (!this.video.readyState) {
                    this.showNotification('Ошибка загрузки видео!');
                    this.playNextVideo();
                }
            }, 5000);
            this.video.addEventListener('canplay', () => {
                clearTimeout(timeout);
                const lastPosition = this.videoDataStore[this.currentVideoIndex].lastPosition;
                this.video.classList.remove('fade-out-left', 'fade-out-right');
                this.video.classList.add('fade-in');
                if (lastPosition > 0 && lastPosition < this.video.duration) {
                    this.showResumePrompt(lastPosition);
                } else {
                    this.video.play().catch(err => console.log("Ошибка воспроизведения:", err));
                }
            }, { once: true });
            this.updateCounters();
            this.updateComments();
            this.updateRating();
            this.updateDescription();
            this.preloadNextVideo();
        }, 300);
    }

    showResumePrompt(lastPosition) {
        const resumePrompt = document.createElement('div');
        resumePrompt.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--notification-bg); color: var(--notification-text);
            padding: 20px; border-radius: 10px; z-index: 100; text-align: center;
        `;
        resumePrompt.innerHTML = `
            <p>Продолжить с ${this.formatTime(lastPosition)}?</p>
            <button id="resumeYes">Да</button>
            <button id="resumeNo">Нет</button>
        `;
        document.body.appendChild(resumePrompt);

        document.getElementById('resumeYes').addEventListener('click', () => {
            this.video.currentTime = lastPosition;
            this.video.play();
            document.body.removeChild(resumePrompt);
        });

        document.getElementById('resumeNo').addEventListener('click', () => {
            this.video.currentTime = 0;
            this.video.play();
            document.body.removeChild(resumePrompt);
        });
    }

    async addComment() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const text = this.commentInput.value.trim();
        if (text && this.userId) {
            const newComment = {
                userId: this.userId,
                text: text,
                replyTo: this.commentInput.dataset.replyTo || null
            };
            videoData.comments.push(newComment);
            this.commentInput.value = '';
            this.commentInput.dataset.replyTo = '';
            this.commentInput.placeholder = 'Введите комментарий';
            this.updateComments();
            this.updateCounters();
            await this.updateVideoCache(this.currentVideoIndex);
        }
    }

    updateComments() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        this.commentsList.innerHTML = '';
        videoData.comments.forEach((comment, idx) => {
            const userPhoto = (this.tg?.initDataUnsafe?.user?.id === comment.userId && this.tg?.initDataUnsafe?.user?.photo_url) 
                ? this.tg.initDataUnsafe.user.photo_url 
                : 'https://placehold.co/30';
            const username = (this.tg?.initDataUnsafe?.user?.id === comment.userId && this.tg?.initDataUnsafe?.user?.username) 
                ? `@${this.tg.initDataUnsafe.user.username}` 
                : `User_${comment.userId.slice(0, 5)}`;
            const isOwnComment = comment.userId === this.userId;
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.innerHTML = `
                <img src="${userPhoto}" alt="User Avatar" class="comment-avatar" data-user-id="${comment.userId}">
                <div class="comment-content">
                    <span class="comment-username">${username}</span>
                    <div class="comment-text">${comment.text}${comment.replyTo !== null && videoData.comments[comment.replyTo] ? `<blockquote>Цитата: ${videoData.comments[comment.replyTo].text}</blockquote>` : ''}</div>
                </div>
                <button class="reply-btn" data-index="${idx}">Ответить</button>
                ${isOwnComment ? `<button class="delete-comment-btn" data-index="${idx}">Удалить</button>` : ''}
            `;
            this.commentsList.appendChild(commentEl);
            commentEl.querySelector('.reply-btn').addEventListener('click', () => this.replyToComment(idx));
            if (isOwnComment) {
                commentEl.querySelector('.delete-comment-btn').addEventListener('click', () => this.deleteComment(idx));
            }
            commentEl.querySelector('.comment-avatar').addEventListener('click', () => {
                const channel = this.channels[comment.userId];
                if (channel && channel.link) {
                    if (this.tg?.isVersionGte('6.0')) {
                        this.tg.openTelegramLink(channel.link);
                    } else {
                        window.open(channel.link, '_blank');
                    }
                } else {
                    this.showNotification('Канал не зарегистрирован');
                }
            });
        });
        this.commentsList.scrollTop = this.commentsList.scrollHeight;
    }

    replyToComment(index) {
        this.commentInput.dataset.replyTo = index;
        this.commentInput.placeholder = `Ответ на: "${this.videoDataStore[this.currentVideoIndex].comments[index].text.slice(0, 20)}..."`;
        this.commentInput.focus();
    }

    async deleteComment(index) {
        if (confirm('Удалить этот комментарий?')) {
            this.videoDataStore[this.currentVideoIndex].comments.splice(index, 1);
            this.updateComments();
            this.updateCounters();
            await this.updateVideoCache(this.currentVideoIndex);
            this.showNotification('Комментарий удалён');
        }
    }

    updateDescription() {
        let descriptionEl = document.getElementById('videoDescriptionDisplay');
        if (!descriptionEl) {
            descriptionEl = document.createElement('div');
            descriptionEl.id = 'videoDescriptionDisplay';
            const videoWrapper = document.querySelector('.video-wrapper');
            if (videoWrapper) videoWrapper.insertAdjacentElement('afterend', descriptionEl);
        }
        descriptionEl.textContent = this.videoDataStore[this.currentVideoIndex].description || 'Описание отсутствует';
    }

    updateChat() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        this.chatMessages.innerHTML = '';
        videoData.chatMessages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.sender === this.userId ? 'sent' : 'received'}`;
            messageEl.textContent = msg.text;
            this.chatMessages.appendChild(messageEl);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async sendChat() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const text = this.chatInput.value.trim();
        if (text) {
            videoData.chatMessages.push({ sender: this.userId, text });
            this.chatInput.value = '';
            this.updateChat();
            await this.updateVideoCache(this.currentVideoIndex);
            setTimeout(() => {
                videoData.chatMessages.push({ sender: videoData.authorId, text: "Спасибо за сообщение!" });
                this.updateChat();
                this.updateVideoCache(this.currentVideoIndex);
            }, 1000);
        }
    }

    handleSubmenuChat(e) {
        e.stopPropagation();
        this.chatModal.classList.add('visible');
        this.updateChat();
        this.toggleSubmenu();
    }

    shareViaTelegram() {
        const videoUrl = this.videoPlaylist[this.currentVideoIndex];
        const description = this.videoDataStore[this.currentVideoIndex].description || 'Смотри это крутое видео!';
        const text = `${description}\n${videoUrl}`;
        if (this.tg?.isVersionGte('6.2')) {
            this.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(description)}`);
        } else {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Ссылка скопирована! Вставьте её в Telegram.');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                this.showNotification('Не удалось скопировать ссылку');
            });
        }
        this.shareModal.classList.remove('visible');
        this.videoDataStore[this.currentVideoIndex].shares++;
        this.updateCounters();
        this.updateVideoCache(this.currentVideoIndex);
    }

    copyVideoLink() {
        const videoUrl = this.videoPlaylist[this.currentVideoIndex];
        navigator.clipboard.writeText(videoUrl).then(() => {
            this.showNotification('Ссылка скопирована!');
            this.shareModal.classList.remove('visible');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            this.showNotification('Не удалось скопировать ссылку');
        });
    }

    async handleVideoUpload(e) {
        this.uploadedFile = e.target.files[0];
        if (!this.uploadedFile) return;

        const maxSize = 100 * 1024 * 1024;
        const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

        if (this.uploadedFile.size > maxSize) {
            this.showNotification('Файл слишком большой! Максимум 100 МБ.');
            return;
        }

        if (!validTypes.includes(this.uploadedFile.type)) {
            this.showNotification('Неподдерживаемый формат! Используйте MP4, MOV или WebM.');
            return;
        }

        this.uploadModal.classList.add('visible');
        this.uploadProgress.style.width = '0%';
        this.uploadPreview.style.display = 'none';
        this.publishBtn.disabled = true;

        const videoDescriptionInput = document.getElementById('videoDescription');
        if (videoDescriptionInput) videoDescriptionInput.value = '';

        this.uploadPreview.src = URL.createObjectURL(this.uploadedFile);
        this.uploadPreview.style.display = 'block';
        this.publishBtn.disabled = false;

        this.uploadPreview.onloadedmetadata = () => {
            const duration = this.uploadPreview.duration;
            this.uploadPreview.onloadedmetadata = null;
        };
    }

    async publishVideo() {
        if (!this.uploadedFile) return;
        const file = this.uploadedFile;
        const fileName = `${this.userId}/${Date.now()}_${file.name}`;
        const description = document.getElementById('videoDescription')?.value || '';

        const { data: storageData, error: uploadError } = await supabase.storage
            .from('videos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                metadata: { authorId: this.userId }
            });
        if (uploadError) {
            console.error('Ошибка загрузки в Storage:', uploadError.message);
            this.showNotification(`Ошибка загрузки: ${uploadError.message}`);
            return;
        }

        this.uploadedFileUrl = `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
        const videoData = {
            url: this.uploadedFileUrl,
            author_id: this.userId,
            description,
            timestamp: new Date().toISOString(),
            views: [],
            likes: 0,
            dislikes: 0,
            user_likes: [],
            user_dislikes: [],
            comments: [],
            shares: 0,
            view_time: 0,
            replays: 0,
            duration: this.uploadPreview?.duration || 0,
            last_position: 0,
            chat_messages: []
        };

        const { data, error: insertError } = await supabase
            .from('publicVideos')
            .insert(videoData)
            .select();
        if (insertError) {
            console.error('Ошибка вставки в базу:', insertError.message);
            this.showNotification(`Ошибка: ${insertError.message}`);
            await supabase.storage.from('videos').remove([fileName]);
            return;
        }

        this.showNotification('Видео успешно опубликовано!');
        this.uploadModal.classList.remove('visible');
        this.uploadedFile = null;
        this.currentVideoIndex = this.videoPlaylist.length;
        this.videoPlaylist.push(this.uploadedFileUrl);
        this.videoDataStore.push({
            views: new Set(),
            likes: 0,
            dislikes: 0,
            userLikes: new Set(),
            userDislikes: new Set(),
            comments: [],
            shares: 0,
            viewTime: 0,
            replays: 0,
            duration: videoData.duration,
            authorId: this.userId,
            lastPosition: 0,
            chatMessages: [],
            description: description
        });
        this.loadVideo();
    }

    cancelUpload() {
        this.uploadedFileUrl = null;
        this.uploadedFile = null;
        this.uploadModal.classList.remove('visible');
    }

    addVideoToManagementList(url, description) {
        const managementList = document.getElementById('videoManagementList') || this.createManagementList();
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.innerHTML = `
            <span>${description || 'Без описания'}</span>
            <button class="edit-btn" data-url="${url}">Редактировать</button>
            <button class="delete-btn" data-url="${url}">Удалить</button>
        `;
        managementList.appendChild(videoItem);

        videoItem.querySelector('.edit-btn').addEventListener('click', () => this.editVideo(url));
        videoItem.querySelector('.delete-btn').addEventListener('click', () => this.deleteVideo(url));
    }

    createManagementList() {
        const list = document.createElement('div');
        list.id = 'videoManagementList';
        list.style.cssText = 'position: absolute; bottom: 6vh; left: 2vw; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 10px; z-index: 100; display: none;';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-list-btn';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', () => list.classList.remove('visible'));
        list.appendChild(closeBtn);
        document.body.appendChild(list);
        return list;
    }

    editVideo(url) {
        const index = this.videoPlaylist.indexOf(url);
        if (index === -1) return;
        const newDescription = prompt('Введите новое описание:', this.videoDataStore[index].description);
        if (newDescription !== null) {
            this.videoDataStore[index].description = newDescription;
            this.updateVideoCache(index);
            document.querySelector(`.video-item [data-url="${url}"]`).parentElement.querySelector('span').textContent = newDescription || 'Без описания';
            this.showNotification('Описание обновлено!');
            if (this.currentVideoIndex === index) this.updateDescription();
        }
    }

    async deleteVideo(url) {
        const { error: deleteDbError } = await supabase
            .from('publicVideos')
            .delete()
            .eq('url', url)
            .eq('author_id', this.userId);
        if (deleteDbError) {
            console.error('Ошибка удаления из базы:', deleteDbError.message);
            this.showNotification(`Ошибка: ${deleteDbError.message}`);
            throw deleteDbError;
        }

        const fileName = url.split('/videos/')[1];
        const { error: deleteStorageError } = await supabase.storage
            .from('videos')
            .remove([fileName]);
        if (deleteStorageError) {
            console.error('Ошибка удаления из Storage:', deleteStorageError.message);
            this.showNotification(`Ошибка: ${deleteStorageError.message}`);
            throw deleteStorageError;
        }

        this.showNotification('Видео успешно удалено!');
        const index = this.videoPlaylist.indexOf(url);
        if (index !== -1) {
            this.videoPlaylist.splice(index, 1);
            this.videoDataStore.splice(index, 1);
            localStorage.removeItem(`videoData_${url}`);
            document.querySelector(`.video-item [data-url="${url}"]`)?.parentElement.remove();
            if (this.currentVideoIndex === index) {
                this.currentVideoIndex = Math.min(this.currentVideoIndex, this.videoPlaylist.length - 1);
                this.loadVideo();
            }
        }
    }

    showVideoManagementList() {
        const list = document.getElementById('videoManagementList');
        list.classList.toggle('visible');
    }

    hideManagementListOnClickOutside(e) {
        const list = document.getElementById('videoManagementList');
        if (list && list.classList.contains('visible') && !list.contains(e.target) && e.target !== this.userAvatar) {
            list.classList.remove('visible');
        }
    }

    updateCounters() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (this.viewCountSpan) this.viewCountSpan.textContent = videoData.views.size;
        if (this.likeCountEl) this.likeCountEl.textContent = videoData.likes;
        if (this.dislikeCountEl) this.dislikeCountEl.textContent = videoData.dislikes;
        if (this.commentCountEl) this.commentCountEl.textContent = videoData.comments.length;
        if (this.shareCountEl) this.shareCountEl.textContent = videoData.shares;
        this.updateRating();
    }

    calculateVideoScore(videoData, duration) {
        const avgViewTimePerView = videoData.viewTime / (videoData.views.size || 1);
        let viewTimeRatio = avgViewTimePerView / duration;
        if (viewTimeRatio > 1) viewTimeRatio = 1 + (videoData.replays / (videoData.views.size || 1));
        const rawScore = (videoData.likes * 5.0) + (videoData.comments.length * 10.0) + (videoData.shares * 15.0) + (videoData.viewTime * 0.1) + (videoData.replays * 20.0) * (1 + viewTimeRatio);
        const maxPossibleScore = 50;
        const normalizedScore = Math.max(0, Math.min(5, (rawScore / maxPossibleScore) * 5));
        return normalizedScore;
    }

    updateRating() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const duration = videoData.duration || 300;
        const score = this.calculateVideoScore(videoData, duration);
        const fullStars = Math.floor(score);
        const halfStar = score % 1 >= 0.5 ? 1 : 0;
        const emptyStars = Math.max(0, 5 - fullStars - halfStar);
        if (this.ratingEl) this.ratingEl.innerHTML = '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    recommendNextVideo() {
        const scores = this.videoPlaylist.map((src, index) => {
            const data = this.videoDataStore[index];
            const duration = data.duration || 300;
            return { index, score: this.calculateVideoScore(data, duration) };
        });
        scores.sort((a, b) => b.score - a.score);
        const nextVideo = scores.find(item => item.index !== this.currentVideoIndex) || scores[0];
        this.currentVideoIndex = nextVideo.index;
    }

    preloadNextVideo() {
        this.cleanPreloadedVideos();
        const nextIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
        if (!this.preloadedVideos[nextIndex]) {
            const preloadVideo = document.createElement('video');
            preloadVideo.src = this.videoPlaylist[nextIndex];
            preloadVideo.preload = 'auto';
            this.preloadedVideos[nextIndex] = preloadVideo;
        }
        const prevIndex = (this.currentVideoIndex - 1 + this.videoPlaylist.length) % this.videoPlaylist.length;
        if (!this.preloadedVideos[prevIndex]) {
            const preloadVideo = document.createElement('video');
            preloadVideo.src = this.videoPlaylist[prevIndex];
            preloadVideo.preload = 'auto';
            this.preloadedVideos[prevIndex] = preloadVideo;
        }
    }

    cleanPreloadedVideos() {
        const keys = Object.keys(this.preloadedVideos).map(Number);
        const keep = [this.currentVideoIndex, (this.currentVideoIndex + 1) % this.videoPlaylist.length, (this.currentVideoIndex - 1 + this.videoPlaylist.length) % this.videoPlaylist.length];
        keys.forEach(key => {
            if (!keep.includes(key)) {
                const videoEl = this.preloadedVideos[key];
                if (videoEl && videoEl.src) URL.revokeObjectURL(videoEl.src);
                delete this.preloadedVideos[key];
            }
        });
    }

    cleanVideoPlaylist() {
        if (this.videoPlaylist.length > this.MAX_PLAYLIST_SIZE) {
            const removeCount = this.videoPlaylist.length - this.MAX_PLAYLIST_SIZE;
            for (let i = 0; i < removeCount; i++) {
                const url = this.videoPlaylist[i];
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                localStorage.removeItem(`videoData_${url}`);
            }
            this.videoPlaylist.splice(0, removeCount);
            this.videoDataStore.splice(0, removeCount);
            this.currentVideoIndex -= removeCount;
            if (this.currentVideoIndex < 0) this.currentVideoIndex = 0;
        }
    }

    async updateVideoCache(index) {
        const videoData = this.videoDataStore[index];
        const url = this.videoPlaylist[index];
        const cacheData = {
            duration: videoData.duration,
            last_position: videoData.lastPosition,
            user_likes: Array.from(videoData.userLikes),
            user_dislikes: Array.from(videoData.userDislikes),
            comments: videoData.comments,
            chat_messages: videoData.chatMessages,
            likes: videoData.likes,
            dislikes: videoData.dislikes,
            shares: videoData.shares,
            view_time: videoData.viewTime,
            replays: videoData.replays,
            views: Array.from(videoData.views),
            description: videoData.description
        };
        localStorage.setItem(`videoData_${url}`, JSON.stringify(cacheData));

        try {
            const { data, error } = await supabase
                .from('publicVideos')
                .update(cacheData)
                .eq('url', url);
            if (error) throw error;
            console.log('Данные сохранены в Supabase');
        } catch (error) {
            console.error('Ошибка обновления Supabase:', error);
            this.showNotification('Не удалось сохранить данные!');
        }
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
            this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark');
            this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    toggleTheme() {
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.add('dark');
            this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
    }

    initializeTooltips() {
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

    showNotification(message) {
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

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    toggleVideoPlayback() {
        if (this.video.paused) {
            this.video.play().catch(err => console.error('Play error:', err));
        } else {
            this.video.pause();
        }
    }

    handleReaction(type, e) {
        if (e) e.stopPropagation();
        if (!this.userId) {
            this.showNotification('Войдите, чтобы ставить реакции');
            return;
        }
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (type === 'like') {
            if (videoData.userLikes.has(this.userId)) {
                videoData.userLikes.delete(this.userId);
                videoData.likes--;
            } else {
                if (videoData.userDislikes.has(this.userId)) {
                    videoData.userDislikes.delete(this.userId);
                    videoData.dislikes--;
                }
                videoData.userLikes.add(this.userId);
                videoData.likes++;
                this.showReaction('like');
            }
        } else if (type === 'dislike') {
            if (videoData.userDislikes.has(this.userId)) {
                videoData.userDislikes.delete(this.userId);
                videoData.dislikes--;
            } else {
                if (videoData.userLikes.has(this.userId)) {
                    videoData.userLikes.delete(this.userId);
                    videoData.likes--;
                }
                videoData.userDislikes.add(this.userId);
                videoData.dislikes++;
                this.showReaction('dislike');
            }
        } else if (type === 'comment') {
            this.commentsWindow.classList.toggle('visible');
            if (this.commentsWindow.classList.contains('visible')) this.commentInput.focus();
        } else if (type === 'share') {
            this.shareModal.classList.add('visible');
        }
        this.updateCounters();
        this.updateVideoCache(this.currentVideoIndex);
    }

    showReaction(type) {
        this.reactionAnimation.innerHTML = type === 'like' ? '<i class="fas fa-thumbs-up"></i>' : '<i class="fas fa-thumbs-down"></i>';
        this.reactionAnimation.classList.add('show');
        setTimeout(() => this.reactionAnimation.classList.remove('show'), 2000);
    }

    toggleSubmenu(e) {
        e.stopPropagation();
        this.isSubmenuOpen = !this.isSubmenuOpen;
        this.submenuUpload.classList.toggle('active', this.isSubmenuOpen);
        this.submenuChat.classList.toggle('active', this.isSubmenuOpen);
    }

    toggleReactionBarVisibility(e) {
        e.stopPropagation();
        if (this.reactionBar.classList.contains('visible')) {
            this.reactionBar.classList.remove('visible');
            this.toggleReactionBar.classList.remove('active');
            this.toggleReactionBar.innerHTML = '<i class="fas fa-arrow-right"></i>';
        } else {
            this.reactionBar.classList.add('visible');
            this.toggleReactionBar.classList.add('active');
            this.toggleReactionBar.innerHTML = '<i class="fas fa-arrow-left"></i>';
            setTimeout(() => {
                if (this.reactionBar.classList.contains('visible')) {
                    this.reactionBar.classList.remove('visible');
                    this.toggleReactionBar.classList.remove('active');
                    this.toggleReactionBar.innerHTML = '<i class="fas fa-arrow-right"></i>';
                }
            }, 15000);
        }
    }

    async downloadCurrentVideo(e) {
        e.stopPropagation();
        const videoUrl = this.videoPlaylist[this.currentVideoIndex];
        if (!videoUrl) {
            this.showNotification('Нет видео для загрузки!');
            return;
        }

        this.uploadBtn.classList.add('downloading');
        this.uploadBtn.style.setProperty('--progress', '0%');

        try {
            const response = await fetch(videoUrl);
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
                            const progress = total ? (loaded / total) * 100 : this.simulateProgress();
                            this.uploadBtn.style.setProperty('--progress', `${progress}%`);
                            controller.enqueue(value);
                            push();
                        });
                    }
                    push();
                }
            });

            const blob = await new Response(stream).blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setTimeout(() => {
                this.uploadBtn.classList.remove('downloading');
                this.uploadBtn.style.setProperty('--progress', '0%');
            }, 500);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
            this.showNotification('Не удалось скачать видео!');
            this.uploadBtn.classList.remove('downloading');
            this.uploadBtn.style.setProperty('--progress', '0%');
        }
    }

    simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress >= 100) clearInterval(interval);
            this.uploadBtn.style.setProperty('--progress', `${progress}%`);
        }, 200);
        return progress;
    }

    startDragging(e) {
        e.preventDefault();
        let startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        let isDragging = true;

        const onMove = (e) => {
            if (!isDragging) return;
            const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 50) {
                this.commentsWindow.classList.remove('visible');
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
            }
        };

        const onEnd = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    handleSubmenuUpload(e) {
        e.stopPropagation();
        e.preventDefault();
        this.videoUpload.click();
        this.toggleSubmenu();
    }

    toggleFullscreen(e) {
        e.stopPropagation();
        e.preventDefault();
        if (this.tg) {
            if (this.tg.isVersionGte('6.1') && this.tg.requestFullscreen) {
                this.tg.requestFullscreen().catch(() => {
                    this.tg.expand();
                    this.showNotification('Полноэкранный режим не поддерживается');
                });
                document.body.classList.add('telegram-fullscreen');
            } else {
                this.tg.expand();
                this.showNotification('Полноэкранный режим не доступен в этой версии Telegram');
            }
        } else {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error('Ошибка:', err));
            } else {
                document.exitFullscreen().catch(err => console.error('Ошибка:', err));
                document.body.classList.remove('telegram-fullscreen');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const videoManager = new VideoManager();
    try {
        await videoManager.init();
        console.log('VideoManager успешно инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации VideoManager:', error);
    }
});
