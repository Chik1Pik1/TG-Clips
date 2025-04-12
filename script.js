class VideoManager {
    constructor() {
        this.state = {
            currentVideo: null,
            playlist: [],
            preloaded: new Map(),
            currentIndex: 0,
            userId: null,
            uploadedFile: null,
            uploadedFileUrl: null,
            channels: JSON.parse(localStorage.getItem('channels')) || {},
            isSubmenuOpen: false,
            isProgressBarActivated: false,
            hasViewed: false,
            isSwiping: false,
            isDragging: false,
            isHolding: false,
            lastTime: 0,
            touchTimeout: null,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };
        this.tg = window.Telegram?.WebApp;
        this.MAX_PRELOAD_SIZE = 3;
        this.MAX_PLAYLIST_SIZE = 10;
        this.updateVideoCache = this.debounce(this._updateVideoCache.bind(this), 1000); // Debounce для ограничения запросов

        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
            console.log('Telegram Web App инициализирован:', this.tg.initDataUnsafe);
        } else {
            console.warn('Telegram Web App SDK не загружен. Работа в режиме браузера.');
        }

        if (window.tronWeb) {
            console.log('TronWeb обнаружен:', window.tronWeb);
        }
    }

    async init() {
        console.log('Скрипт обновлён, версия 11');
        try {
            if (this.tg?.initDataUnsafe?.user) {
                this.state.userId = String(this.tg.initDataUnsafe.user.id);
                console.log('Telegram инициализирован, userId:', this.state.userId);
            } else {
                this.state.userId = 'testUser_' + Date.now();
                console.log('Тестовый userId:', this.state.userId);
            }
            console.log('Зарегистрированные каналы:', this.state.channels);

            this.bindElements();
            this.bindEvents();
            await this.loadInitialVideos();
            this.showPlayer();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showNotification('Ошибка инициализации приложения');
        }
    }

    bindElements() {
        this.authScreen = document.getElementById('authScreen');
        this.playerContainer = document.getElementById('playerContainer');
        this.authBtn = document.getElementById('authBtn');
        this.registerChannelBtn = document.getElementById('registerChannelBtn');
        this.userAvatar = document.getElementById('userAvatar');
        this.video = document.getElementById('videoPlayer');
        this.videoSource = document.getElementById('videoSource');
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

        if (!this.authBtn) console.error('#authBtn не найден');
        if (!this.registerChannelBtn) console.error('#registerChannelBtn не найден');
    }

    bindEvents() {
        const bindButton = (btn, handler, name) => {
            if (btn) {
                btn.addEventListener('click', handler);
                console.log(`${name} привязан`);
            } else {
                console.error(`${name} не найден`);
            }
        };

        bindButton(this.authBtn, () => {
            console.log('Кнопка authBtn нажата');
            this.handleAuth();
        }, '#authBtn');
        bindButton(this.registerChannelBtn, () => {
            console.log('Кнопка registerChannelBtn нажата');
            this.registerChannel();
        }, '#registerChannelBtn');

        this.reactionButtons.forEach(btn =>
            btn.addEventListener('click', e => this.handleReaction(btn.dataset.type, e))
        );
        bindButton(this.plusBtn, e => this.toggleSubmenu(e), '.plus-btn');
        bindButton(this.uploadBtn, e => this.downloadCurrentVideo(e), '.upload-btn');
        bindButton(this.toggleReactionBar, e => this.toggleReactionBarVisibility(e), '.toggle-reaction-bar');
        this.video?.addEventListener('loadedmetadata', () => this.handleLoadedMetadata(), { once: true });
        this.video?.addEventListener('play', () => this.handlePlay());
        this.video?.addEventListener('pause', () => this.handlePause());
        this.video?.addEventListener('ended', () => this.handleEnded());
        this.video?.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.progressRange?.addEventListener('input', e => this.handleProgressInput(e));
        this.setupSwipeAndMouseEvents();
        bindButton(this.sendCommentBtn, () => this.addComment(), '#sendComment');
        this.commentInput?.addEventListener('keypress', e => e.key === 'Enter' && this.addComment());
        bindButton(this.submenuUpload, e => this.handleSubmenuUpload(e), '#uploadVideo');
        this.videoUpload?.addEventListener('change', e => this.handleVideoUpload(e));
        bindButton(this.publishBtn, () => this.publishVideo(), '#publishBtn');
        bindButton(this.cancelBtn, () => this.cancelUpload(), '#cancelBtn');
        bindButton(this.submenuChat, e => this.handleSubmenuChat(e), '#chatAuthor');
        bindButton(this.sendChatMessage, () => this.sendChat(), '#sendChatMessage');
        this.chatInput?.addEventListener('keypress', e => e.key === 'Enter' && this.sendChat());
        bindButton(this.closeChat, () => this.chatModal.classList.remove('visible'), '#closeChat');
        bindButton(this.shareTelegram, () => this.shareViaTelegram(), '#shareTelegram');
        bindButton(this.copyLink, () => this.copyVideoLink(), '#copyLink');
        bindButton(this.closeShare, () => this.shareModal.classList.remove('visible'), '#closeShare');
        bindButton(this.themeToggle, () => this.toggleTheme(), '.theme-toggle');
        document
            .querySelector('.drag-handle')
            ?.addEventListener('mousedown', e => this.startDragging(e));
        document
            .querySelector('.drag-handle')
            ?.addEventListener('touchstart', e => this.startDragging(e), { passive: false });
        document
            .querySelector('.fullscreen-btn')
            ?.addEventListener('click', e => this.toggleFullscreen(e));
        document.addEventListener('click', e => this.hideManagementListOnClickOutside(e));
        this.bindUserAvatar();
    }

    handleAuth() {
        try {
            if (this.tg?.initDataUnsafe?.user) {
                this.state.userId = String(this.tg.initDataUnsafe.user.id);
                this.showNotification('Вход успешен: ' + this.state.userId);
            } else {
                this.state.userId = 'browserTestUser_' + Date.now();
                this.showNotification('Имитация входа: ' + this.state.userId);
            }
            this.showPlayer();
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            this.showNotification('Ошибка авторизации');
        }
    }

    showPlayer() {
        if (this.authScreen && this.playerContainer) {
            this.authScreen.style.display = 'none';
            this.playerContainer.style.display = 'flex';
            this.initializePlayer();
        } else {
            console.error('Ошибка: authScreen или playerContainer не найдены');
            this.showNotification('Ошибка интерфейса');
        }
    }

    bindUserAvatar() {
        if (!this.userAvatar) {
            console.error('Элемент #userAvatar не найден!');
            return;
        }

        this.userAvatar.addEventListener('click', e => {
            e.stopPropagation();
            if (!this.state.isHolding) {
                const channel = this.state.channels[this.state.userId];
                if (channel?.link) {
                    console.log('Переход на канал:', channel.link);
                    if (this.tg?.isVersionGte('6.0')) {
                        this.tg.openTelegramLink(channel.link);
                    } else {
                        window.open(channel.link, '_blank');
                    }
                } else {
                    this.showNotification('Канал не зарегистрирован. Зарегистрируйте его!');
                    this.registerChannel();
                }
            }
        });

        const holdDuration = 2000;
        const startHold = e => {
            e.preventDefault();
            if (this.state.touchTimeout || this.state.isHolding) return;
            this.state.isHolding = true;
            this.userAvatar.classList.add('holding');
            this.state.touchTimeout = setTimeout(() => {
                this.showVideoManagementList();
                this.state.isHolding = false;
                this.userAvatar.classList.remove('holding');
                this.state.touchTimeout = null;
            }, holdDuration);
        };

        const stopHold = () => {
            if (this.state.touchTimeout) {
                clearTimeout(this.state.touchTimeout);
                this.state.touchTimeout = null;
            }
            this.state.isHolding = false;
            this.userAvatar.classList.remove('holding');
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
        if (!this.state.userId) {
            this.showNotification('Пожалуйста, войдите через Telegram.');
            return;
        }
        const channelLink = prompt(
            'Введите ссылку на ваш Telegram-канал (например, https://t.me/yourchannel):'
        );
        if (channelLink && channelLink.match(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/)) {
            try {
                const response = await fetch('http://localhost:3000/api/register-channel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ telegram_id: this.state.userId, channel_link: channelLink })
                });
                if (!response.ok) {
                    throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                }
                const result = await response.json();
                this.state.channels[this.state.userId] = { videos: [], link: channelLink };
                localStorage.setItem('channels', JSON.stringify(this.state.channels));
                this.showNotification('Канал успешно зарегистрирован!');
                this.showPlayer();
            } catch (error) {
                console.error('Ошибка регистрации канала:', error);
                this.showNotification(`Ошибка: ${error.message}`);
            }
        } else {
            this.showNotification('Введите корректную ссылку на Telegram-канал.');
        }
    }

    initializePlayer() {
        try {
            if (this.userAvatar && this.tg?.initDataUnsafe?.user?.photo_url) {
                this.userAvatar.src = this.tg.initDataUnsafe.user.photo_url;
            } else {
                this.userAvatar.src = 'https://placehold.co/30';
            }
            this.initializeTheme();
            this.initializeTooltips();
        } catch (error) {
            console.error('Ошибка инициализации плеера:', error);
            this.showNotification('Ошибка плеера');
        }
    }

    async loadInitialVideos() {
        try {
            const response = await fetch('http://localhost:3000/api/public-videos', {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
            const data = await response.json();
            this.state.playlist = data?.map(video => ({
                url: video.url,
                data: {
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
                }
            })) || [];
            if (!this.state.playlist.length) throw new Error('Плейлист пуст');
            this.loadVideo();
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.showNotification(`Не удалось загрузить видео: ${error.message}`);
            this.state.playlist = [
                {
                    url: '/assets/sample-video.mp4', // Локальный fallback
                    data: this.createEmptyVideoData('testAuthor123')
                }
            ];
            this.loadVideo();
        }
    }

    createEmptyVideoData(authorId) {
        return {
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
            authorId,
            lastPosition: 0,
            chatMessages: [],
            description: ''
        };
    }

    handleLoadedMetadata() {
        try {
            this.video.muted = true;
            this.video.play().then(() => {
                this.video.pause();
                this.video.muted = false;
            }).catch(err => console.error('Unlock error:', err));
            const videoData = this.state.playlist[this.state.currentIndex].data;
            videoData.duration = this.video.duration;
            this.progressRange.max = this.video.duration;
            this.progressRange.value = videoData.lastPosition || 0;
            this.updateVideoCache(this.state.currentIndex);
            this.updateRating();
        } catch (error) {
            console.error('Ошибка обработки метаданных:', error);
        }
    }

    handlePlay() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            if (!this.state.hasViewed && this.state.userId) {
                videoData.views.add(this.state.userId);
                this.state.hasViewed = true;
                this.updateCounters();
            }
            if (this.state.isProgressBarActivated) this.progressBar.classList.remove('visible');
            this.state.isProgressBarActivated = false;
            this.commentsWindow.classList.remove('visible');
            this.preloadNextVideo();
        } catch (error) {
            console.error('Ошибка воспроизведения:', error);
        }
    }

    handlePause() {
        try {
            if (!this.state.isProgressBarActivated) {
                this.state.isProgressBarActivated = true;
                this.progressBar.classList.add('visible');
            }
            this.state.playlist[this.state.currentIndex].data.lastPosition = this.video.currentTime;
            this.updateVideoCache(this.state.currentIndex);
        } catch (error) {
            console.error('Ошибка паузы:', error);
        }
    }

    handleEnded() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            if (this.video.currentTime >= this.video.duration * 0.9) videoData.replays++;
            videoData.lastPosition = 0;
            this.updateVideoCache(this.state.currentIndex);
            this.playNextVideo();
        } catch (error) {
            console.error('Ошибка завершения видео:', error);
        }
    }

    handleTimeUpdate() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            videoData.viewTime += this.video.currentTime - this.state.lastTime;
            videoData.lastPosition = this.video.currentTime;
            this.state.lastTime = this.video.currentTime;
            this.progressRange.value = this.video.currentTime;
            this.updateVideoCache(this.state.currentIndex);
            this.updateRating();
        } catch (error) {
            console.error('Ошибка обновления времени:', error);
        }
    }

    handleProgressInput(e) {
        try {
            this.video.currentTime = e.target.value;
            this.state.playlist[this.state.currentIndex].data.lastPosition = this.video.currentTime;
            this.updateVideoCache(this.state.currentIndex);
        } catch (error) {
            console.error('Ошибка прогресса:', error);
        }
    }

    setupSwipeAndMouseEvents() {
        this.swipeArea.addEventListener('touchstart', e => this.handleTouchStart(e), { passive: false });
        this.swipeArea.addEventListener('touchmove', this.throttle(e => this.handleTouchMove(e), 16), {
            passive: false
        });
        this.swipeArea.addEventListener('touchend', e => this.handleTouchEnd(e));
        this.swipeArea.addEventListener('mousedown', e => this.handleMouseStart(e));
        this.swipeArea.addEventListener('mousemove', this.throttle(e => this.handleMouseMove(e), 16));
        this.swipeArea.addEventListener('mouseup', e => this.handleMouseEnd(e));
    }

    handleTouchStart(e) {
        try {
            e.preventDefault();
            this.state.startX = e.touches[0].clientX;
            this.state.startY = e.touches[0].clientY;
            this.state.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
            this.state.isSwiping = false;
        } catch (error) {
            console.error('Ошибка touch start:', error);
        }
    }

    handleTouchMove(e) {
        try {
            this.state.endX = e.touches[0].clientX;
            this.state.endY = e.touches[0].clientY;
            const deltaX = this.state.endX - this.state.startX;
            const deltaY = this.state.endY - this.state.startY;

            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(this.state.touchTimeout);
                this.state.touchTimeout = null;
                this.state.isSwiping = true;
            }
        } catch (error) {
            console.error('Ошибка touch move:', error);
        }
    }

    handleTouchEnd(e) {
        try {
            const deltaX = this.state.endX - this.state.startX;
            const deltaY = this.state.endY - this.state.startY;
            const swipeThresholdHorizontal = 50;
            const swipeThresholdVertical = 50;

            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

            if (this.state.touchTimeout) {
                clearTimeout(this.state.touchTimeout);
                this.state.touchTimeout = null;
            }

            if (!this.state.userId) {
                this.showNotification('Войдите, чтобы ставить реакции');
                return;
            }

            if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) this.playNextVideo();
                else this.playPreviousVideo();
                if (this.state.isProgressBarActivated) this.progressBar.classList.remove('visible');
                this.state.isProgressBarActivated = false;
            } else if (Math.abs(deltaY) > swipeThresholdVertical) {
                if (deltaY < 0) {
                    this.handleReaction('like');
                    this.showFloatingReaction('like', this.state.endX, this.state.startY);
                } else {
                    this.handleReaction('dislike');
                    this.showFloatingReaction('dislike', this.state.endX, this.state.startY);
                }
            }
            this.state.isSwiping = false;
        } catch (error) {
            console.error('Ошибка touch end:', error);
        }
    }

    handleMouseStart(e) {
        try {
            e.preventDefault();
            this.state.isDragging = true;
            this.state.startX = e.clientX;
            this.state.startY = e.clientY;
            this.state.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
            this.state.isSwiping = false;
        } catch (error) {
            console.error('Ошибка mouse start:', error);
        }
    }

    handleMouseMove(e) {
        try {
            if (!this.state.isDragging) return;
            this.state.endX = e.clientX;
            this.state.endY = e.clientY;
            const deltaX = this.state.endX - this.state.startX;
            const deltaY = this.state.endY - this.state.startY;
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(this.state.touchTimeout);
                this.state.touchTimeout = null;
                this.state.isSwiping = true;
            }
        } catch (error) {
            console.error('Ошибка mouse move:', error);
        }
    }

    handleMouseEnd(e) {
        try {
            if (!this.state.isDragging) return;
            this.state.isDragging = false;
            const deltaX = this.state.endX - this.state.startX;
            const deltaY = this.state.endY - this.state.startY;
            const swipeThresholdHorizontal = 50;
            const swipeThresholdVertical = 50;

            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

            if (this.state.touchTimeout) {
                clearTimeout(this.state.touchTimeout);
                this.state.touchTimeout = null;
            }

            if (!this.state.userId) {
                this.showNotification('Войдите, чтобы ставить реакции');
                return;
            }

            if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) this.playNextVideo();
                else this.playPreviousVideo();
                if (this.state.isProgressBarActivated) this.progressBar.classList.remove('visible');
                this.state.isProgressBarActivated = false;
            } else if (Math.abs(deltaY) > swipeThresholdVertical) {
                if (deltaY < 0) {
                    this.handleReaction('like');
                    this.showFloatingReaction('like', this.state.endX, this.state.startY);
                } else {
                    this.handleReaction('dislike');
                    this.showFloatingReaction('dislike', this.state.endX, this.state.startY);
                }
            }
            this.state.isSwiping = false;
        } catch (error) {
            console.error('Ошибка mouse end:', error);
        }
    }

    showFloatingReaction(type, x, y) {
        try {
            const reaction = document.createElement('div');
            reaction.className = `floating-reaction ${type}`;
            reaction.textContent = type === 'like' ? '👍' : '👎';
            reaction.style.left = `${x}px`;
            reaction.style.top = `${y}px`;
            document.body.appendChild(reaction);
            setTimeout(() => reaction.remove(), 1500);
        } catch (error) {
            console.error('Ошибка плавающей реакции:', error);
        }
    }

    playNextVideo() {
        try {
            this.recommendNextVideo();
            this.loadVideo('left');
            this.state.hasViewed = false;
        } catch (error) {
            console.error('Ошибка перехода к следующему видео:', error);
        }
    }

    playPreviousVideo() {
        try {
            this.state.currentIndex = (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length;
            this.loadVideo('right');
            this.state.hasViewed = false;
        } catch (error) {
            console.error('Ошибка перехода к предыдущему видео:', error);
        }
    }

    loadVideo(direction = 'left') {
        try {
            const fadeOutClass = direction === 'left' ? 'fade-out-left' : 'fade-out-right';
            this.video.classList.remove('fade-in');
            this.video.classList.add(fadeOutClass);
            this.video.pause();
            setTimeout(() => {
                this.videoSource.src = this.state.playlist[this.state.currentIndex].url;
                this.video.load();
                const timeout = setTimeout(() => {
                    if (!this.video.readyState) {
                        this.showNotification('Ошибка загрузки видео!');
                        this.playNextVideo();
                    }
                }, 5000);
                this.video.addEventListener(
                    'canplay',
                    () => {
                        clearTimeout(timeout);
                        const lastPosition = this.state.playlist[this.state.currentIndex].data.lastPosition;
                        this.video.classList.remove('fade-out-left', 'fade-out-right');
                        this.video.classList.add('fade-in');
                        if (lastPosition > 0 && lastPosition < this.video.duration) {
                            this.showResumePrompt(lastPosition);
                        } else {
                            this.video.play().catch(err => console.log('Ошибка воспроизведения:', err));
                        }
                    },
                    { once: true }
                );
                this.updateCounters();
                this.updateComments();
                this.updateRating();
                this.updateDescription();
                this.preloadNextVideo();
            }, 300);
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.showNotification('Ошибка видео');
        }
    }

    showResumePrompt(lastPosition) {
        try {
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
        } catch (error) {
            console.error('Ошибка возобновления:', error);
        }
    }

    async addComment() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            const text = this.commentInput.value.trim();
            if (text && this.state.userId) {
                const newComment = {
                    userId: this.state.userId,
                    text: text,
                    replyTo: this.commentInput.dataset.replyTo || null
                };
                videoData.comments.push(newComment);
                this.commentInput.value = '';
                this.commentInput.dataset.replyTo = '';
                this.commentInput.placeholder = 'Напишите комментарий...';
                this.updateComments();
                this.updateCounters();
                await this.updateVideoCache(this.state.currentIndex);
            }
        } catch (error) {
            console.error('Ошибка добавления комментария:', error);
            this.showNotification('Ошибка комментария');
        }
    }

    updateComments() {
        try {
            console.log('Начало updateComments');
            const videoData = this.state.playlist[this.state.currentIndex]?.data;
            if (!videoData) {
                console.error('videoData не найдено');
                this.commentsList.innerHTML = '';
                return;
            }
            console.log('videoData:', videoData);
            if (!Array.isArray(videoData.comments)) {
                console.error('videoData.comments не массив:', videoData.comments);
                videoData.comments = [];
            }
            this.commentsList.innerHTML = '';
            videoData.comments.forEach((comment, idx) => {
                console.log('Обрабатываю комментарий:', idx, comment);
                const userPhoto = this.tg?.initDataUnsafe?.user?.id === comment.userId &&
                    this.tg?.initDataUnsafe?.user?.photo_url
                    ? this.tg.initDataUnsafe.user.photo_url
                    : 'https://placehold.co/30';
                const username = this.tg?.initDataUnsafe?.user?.id === comment.userId &&
                    this.tg?.initDataUnsafe?.user?.username
                    ? `@${this.tg.initDataUnsafe.user.username}`
                    : `User_${comment.userId.slice(0, 5)}`;
                const isOwnComment = comment.userId === this.state.userId;
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                commentEl.innerHTML = `
                    <img src="${userPhoto}" alt="User Avatar" class="comment-avatar" data-user-id="${comment.userId}">
                    <div class="comment-content">
                        <span class="comment-username">${username}</span>
                        <div class="comment-text">${this.sanitize(comment.text)}${comment.replyTo !== null && videoData.comments[comment.replyTo] ? `<blockquote>Цитата: ${this.sanitize(videoData.comments[comment.replyTo].text)}</blockquote>` : ''}</div>
                    </div>
                    <button class="reply-btn" data-index="${idx}">Ответить</button>
                    ${isOwnComment ? `<button class="delete-comment-btn" data-index="${idx}">Удалить</button>` : ''}
                `;
                this.commentsList.appendChild(commentEl);
                commentEl.querySelector('.reply-btn').addEventListener('click', () => this.replyToComment(idx));
                if (isOwnComment) {
                    commentEl.querySelector('.delete-comment-btn').addEventListener('click', () =>
                        this.deleteComment(idx)
                    );
                }
                commentEl
                    .querySelector('.comment-avatar')
                    .addEventListener('click', () => this.handleAvatarClick(comment.userId));
            });
            this.commentsList.scrollTop = this.commentsList.scrollHeight;
        } catch (error) {
            console.error('Ошибка обновления комментариев:', error);
            this.showNotification('Ошибка комментариев');
            this.commentsList.innerHTML = '';
        }
    }

    sanitize(text) {
        try {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (error) {
            console.error('Ошибка санитизации:', error);
            return '';
        }
    }

    replyToComment(index) {
        try {
            this.commentInput.dataset.replyTo = index;
            this.commentInput.placeholder = `Ответ на: "${this.state.playlist[this.state.currentIndex].data.comments[index].text.slice(0, 20)}..."`;
            this.commentInput.focus();
        } catch (error) {
            console.error('Ошибка ответа на комментарий:', error);
        }
    }

    async deleteComment(index) {
        try {
            if (confirm('Удалить этот комментарий?')) {
                this.state.playlist[this.state.currentIndex].data.comments.splice(index, 1);
                this.updateComments();
                this.updateCounters();
                await this.updateVideoCache(this.state.currentIndex);
                this.showNotification('Комментарий удалён');
            }
        } catch (error) {
            console.error('Ошибка удаления комментария:', error);
            this.showNotification('Ошибка удаления');
        }
    }

    handleAvatarClick(userId) {
        try {
            const channel = this.state.channels[userId];
            if (channel?.link) {
                if (this.tg?.isVersionGte('6.0')) {
                    this.tg.openTelegramLink(channel.link);
                } else {
                    window.open(channel.link, '_blank');
                }
            } else {
                this.showNotification('Канал не зарегистрирован');
            }
        } catch (error) {
            console.error('Ошибка клика по аватару:', error);
        }
    }

    updateDescription() {
        try {
            let descriptionEl = document.getElementById('videoDescriptionDisplay');
            if (!descriptionEl) {
                descriptionEl = document.createElement('div');
                descriptionEl.id = 'videoDescriptionDisplay';
                document.querySelector('.video-wrapper')?.insertAdjacentElement('afterend', descriptionEl);
            }
            descriptionEl.textContent =
                this.state.playlist[this.state.currentIndex].data.description || 'Описание отсутствует';
        } catch (error) {
            console.error('Ошибка обновления описания:', error);
        }
    }

    updateChat() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            this.chatMessages.innerHTML = '';
            videoData.chatMessages.forEach(msg => {
                const messageEl = document.createElement('div');
                messageEl.className = `message ${msg.sender === this.state.userId ? 'sent' : 'received'}`;
                messageEl.textContent = msg.text;
                this.chatMessages.appendChild(messageEl);
            });
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        } catch (error) {
            console.error('Ошибка обновления чата:', error);
        }
    }

    async sendChat() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            const text = this.chatInput.value.trim();
            if (text) {
                videoData.chatMessages.push({ sender: this.state.userId, text });
                this.chatInput.value = '';
                this.updateChat();
                await this.updateVideoCache(this.state.currentIndex);
                setTimeout(() => {
                    videoData.chatMessages.push({ sender: videoData.authorId, text: 'Спасибо за сообщение!' });
                    this.updateChat();
                    this.updateVideoCache(this.state.currentIndex);
                }, 1000);
            }
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            this.showNotification('Ошибка чата');
        }
    }

    handleSubmenuChat(e) {
        try {
            e.stopPropagation();
            this.chatModal.classList.add('visible');
            this.updateChat();
            this.toggleSubmenu();
        } catch (error) {
            console.error('Ошибка открытия чата:', error);
        }
    }

    shareViaTelegram() {
        try {
            const videoUrl = this.state.playlist[this.state.currentIndex].url;
            const description =
                this.state.playlist[this.state.currentIndex].data.description || 'Смотри это крутое видео!';
            const text = `${description}\n${videoUrl}`;
            if (this.tg?.isVersionGte('6.2')) {
                this.tg.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(description)}`
                );
            } else {
                navigator.clipboard
                    .writeText(text)
                    .then(() => this.showNotification('Ссылка скопирована! Вставьте её в Telegram.'))
                    .catch(err => this.showNotification('Не удалось скопировать ссылку'));
            }
            this.shareModal.classList.remove('visible');
            this.state.playlist[this.state.currentIndex].data.shares++;
            this.updateCounters();
            this.updateVideoCache(this.state.currentIndex);
        } catch (error) {
            console.error('Ошибка шаринга в Telegram:', error);
        }
    }

    copyVideoLink() {
        try {
            const videoUrl = this.state.playlist[this.state.currentIndex].url;
            navigator.clipboard
                .writeText(videoUrl)
                .then(() => {
                    this.showNotification('Ссылка скопирована!');
                    this.shareModal.classList.remove('visible');
                })
                .catch(err => this.showNotification('Не удалось скопировать ссылку'));
        } catch (error) {
            console.error('Ошибка копирования ссылки:', error);
        }
    }

    async handleVideoUpload(e) {
        try {
            this.state.uploadedFile = e.target.files[0];
            if (!this.state.uploadedFile) return;

            const maxSize = 100 * 1024 * 1024;
            const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

            if (this.state.uploadedFile.size > maxSize) {
                this.showNotification('Файл слишком большой! Максимум 100 МБ.');
                return;
            }

            if (!validTypes.includes(this.state.uploadedFile.type)) {
                this.showNotification('Неподдерживаемый формат! Используйте MP4, MOV или WebM.');
                return;
            }

            this.uploadModal.classList.add('visible');
            this.uploadProgress.style.width = '0%';
            this.uploadPreview.style.display = 'none';
            this.publishBtn.disabled = true;

            const videoDescriptionInput = document.getElementById('videoDescription');
            if (videoDescriptionInput) videoDescriptionInput.value = '';

            this.uploadPreview.src = URL.createObjectURL(this.state.uploadedFile);
            this.uploadPreview.style.display = 'block';
            this.publishBtn.disabled = false;

            this.uploadPreview.onloadedmetadata = () => {
                this.state.playlist[this.state.currentIndex].data.duration = this.uploadPreview.duration;
                this.uploadPreview.onloadedmetadata = null;
            };
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.showNotification('Ошибка загрузки файла');
        }
    }

    async publishVideo() {
        try {
            if (!this.state.uploadedFile) return;

            const file = this.state.uploadedFile;
            const description = document.getElementById('videoDescription')?.value || '';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('telegram_id', this.state.userId);
            formData.append('description', description);

            const response = await fetch('http://localhost:3000/api/upload-video', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error(`Ошибка загрузки видео: ${response.status}`);
            const { url } = await response.json();

            this.showNotification('Видео успешно опубликовано!');
            this.uploadModal.classList.remove('visible');
            this.state.uploadedFile = null;

            this.state.playlist.unshift({ url, data: this.createEmptyVideoData(this.state.userId) });
            this.state.currentIndex = 0;
            this.loadVideo();
        } catch (error) {
            console.error('Ошибка публикации видео:', error);
            this.showNotification(`Ошибка: ${error.message}`);
        }
    }

    cancelUpload() {
        try {
            this.state.uploadedFileUrl = null;
            this.state.uploadedFile = null;
            this.uploadModal.classList.remove('visible');
        } catch (error) {
            console.error('Ошибка отмены загрузки:', error);
        }
    }

    addVideoToManagementList(url, description) {
        try {
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
        } catch (error) {
            console.error('Ошибка добавления видео в список:', error);
        }
    }

    createManagementList() {
        try {
            const list = document.createElement('div');
            list.id = 'videoManagementList';
            list.style.cssText =
                'position: absolute; bottom: 6vh; left: 2vw; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 10px; z-index: 100; display: none;';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-list-btn';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.addEventListener('click', () => list.classList.remove('visible'));
            list.appendChild(closeBtn);
            document.body.appendChild(list);
            return list;
        } catch (error) {
            console.error('Ошибка создания списка:', error);
            return document.createElement('div');
        }
    }

    editVideo(url) {
        try {
            const index = this.state.playlist.findIndex(v => v.url === url);
            if (index === -1) return;
            const newDescription = prompt(
                'Введите новое описание:',
                this.state.playlist[index].data.description
            );
            if (newDescription !== null) {
                this.state.playlist[index].data.description = newDescription;
                this.updateVideoCache(index);
                document.querySelector(`.video-item [data-url="${url}"]`).parentElement.querySelector(
                    'span'
                ).textContent = newDescription || 'Без описания';
                this.showNotification('Описание обновлено!');
                if (this.state.currentIndex === index) this.updateDescription();
            }
        } catch (error) {
            console.error('Ошибка редактирования видео:', error);
        }
    }

    async deleteVideo(url) {
        try {
            const response = await fetch('http://localhost:3000/api/delete-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, telegram_id: this.state.userId })
            });
            if (!response.ok) throw new Error(`Ошибка удаления видео: ${response.status}`);
            this.showNotification('Видео успешно удалено!');
            const index = this.state.playlist.findIndex(v => v.url === url);
            if (index !== -1) {
                this.state.playlist.splice(index, 1);
                if (this.state.currentIndex === index) {
                    this.state.currentIndex = Math.min(this.state.currentIndex, this.state.playlist.length - 1);
                    this.loadVideo();
                }
            }
        } catch (error) {
            console.error('Ошибка удаления видео:', error);
            this.showNotification(`Ошибка: ${error.message}`);
        }
    }

    showVideoManagementList() {
        try {
            const list = document.getElementById('videoManagementList');
            list.classList.toggle('visible');
        } catch (error) {
            console.error('Ошибка показа списка:', error);
        }
    }

    hideManagementListOnClickOutside(e) {
        try {
            const list = document.getElementById('videoManagementList');
            if (
                list &&
                list.classList.contains('visible') &&
                !list.contains(e.target) &&
                e.target !== this.userAvatar
            ) {
                list.classList.remove('visible');
            }
        } catch (error) {
            console.error('Ошибка скрытия списка:', error);
        }
    }

    updateCounters() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            if (this.viewCountSpan) this.viewCountSpan.textContent = videoData.views.size;
            if (this.likeCountEl) this.likeCountEl.textContent = videoData.likes;
            if (this.dislikeCountEl) this.dislikeCountEl.textContent = videoData.dislikes;
            if (this.commentCountEl) this.commentCountEl.textContent = videoData.comments.length;
            if (this.shareCountEl) this.shareCountEl.textContent = videoData.shares;
            this.updateRating();
        } catch (error) {
            console.error('Ошибка обновления счётчиков:', error);
        }
    }

    calculateVideoScore(videoData, duration) {
        try {
            const avgViewTimePerView = videoData.viewTime / (videoData.views.size || 1);
            let viewTimeRatio = avgViewTimePerView / duration;
            if (viewTimeRatio > 1) viewTimeRatio = 1 + videoData.replays / (videoData.views.size || 1);
            const rawScore =
                videoData.likes * 5.0 +
                videoData.comments.length * 10.0 +
                videoData.shares * 15.0 +
                videoData.viewTime * 0.1 +
                videoData.replays * 20.0 * (1 + viewTimeRatio);
            const maxPossibleScore = 50;
            return Math.max(0, Math.min(5, (rawScore / maxPossibleScore) * 5));
        } catch (error) {
            console.error('Ошибка расчёта рейтинга:', error);
            return 0;
        }
    }

    updateRating() {
        try {
            const videoData = this.state.playlist[this.state.currentIndex].data;
            const duration = videoData.duration || 300;
            const score = this.calculateVideoScore(videoData, duration);
            const fullStars = Math.floor(score);
            const halfStar = score % 1 >= 0.5 ? 1 : 0;
            const emptyStars = Math.max(0, 5 - fullStars - halfStar);
            if (this.ratingEl)
                this.ratingEl.innerHTML = '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
        } catch (error) {
            console.error('Ошибка обновления рейтинга:', error);
        }
    }

    recommendNextVideo() {
        try {
            const scores = this.state.playlist.map((video, index) => ({
                index,
                score: this.calculateVideoScore(video.data, video.data.duration || 300)
            }));
            scores.sort((a, b) => b.score - a.score);
            const nextVideo = scores.find(item => item.index !== this.state.currentIndex) || scores[0];
            this.state.currentIndex = nextVideo.index;
        } catch (error) {
            console.error('Ошибка рекомендации видео:', error);
        }
    }

    preloadNextVideo() {
        try {
            this.cleanPreloadedVideos();
            const nextIndex = (this.state.currentIndex + 1) % this.state.playlist.length;
            if (!this.state.preloaded.has(nextIndex)) {
                const preloadVideo = document.createElement('video');
                preloadVideo.src = this.state.playlist[nextIndex].url;
                preloadVideo.preload = 'auto';
                this.state.preloaded.set(nextIndex, preloadVideo);
            }
            const prevIndex = (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length;
            if (!this.state.preloaded.has(prevIndex)) {
                const preloadVideo = document.createElement('video');
                preloadVideo.src = this.state.playlist[prevIndex].url;
                preloadVideo.preload = 'auto';
                this.state.preloaded.set(prevIndex, preloadVideo);
            }
        } catch (error) {
            console.error('Ошибка предзагрузки видео:', error);
        }
    }

    cleanPreloadedVideos() {
        try {
            const keep = [
                this.state.currentIndex,
                (this.state.currentIndex + 1) % this.state.playlist.length,
                (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length
            ];
            for (const [key, video] of this.state.preloaded) {
                if (!keep.includes(Number(key))) {
                    if (video.src) URL.revokeObjectURL(video.src);
                    this.state.preloaded.delete(key);
                }
            }
        } catch (error) {
            console.error('Ошибка очистки предзагрузки:', error);
        }
    }

    async _updateVideoCache(index) {
        try {
            const videoData = this.state.playlist[index].data;
            const url = this.state.playlist[index].url;
            const cacheData = {
                url,
                views: Array.from(videoData.views),
                likes: videoData.likes,
                dislikes: videoData.dislikes,
                user_likes: Array.from(videoData.userLikes),
                user_dislikes: Array.from(videoData.userDislikes),
                comments: videoData.comments,
                shares: videoData.shares,
                view_time: videoData.viewTime,
                replays: videoData.replays,
                duration: videoData.duration,
                last_position: videoData.lastPosition,
                chat_messages: videoData.chatMessages,
                description: videoData.description
            };
            localStorage.setItem(`videoData_${url}`, JSON.stringify(cacheData));

            const response = await fetch('http://localhost:3000/api/update-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(cacheData)
            });
            if (!response.ok) throw new Error(`Ошибка обновления данных: ${response.status}`);
            console.log('Данные сохранены на сервере');
        } catch (error) {
            console.error('Ошибка обновления данных:', error);
            localStorage.setItem(`videoData_${this.state.playlist[index].url}_offline`, JSON.stringify(cacheData));
            console.log('Данные сохранены локально из-за ошибки сети');
        }
    }

    initializeTheme() {
        try {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            if (savedTheme === 'dark') {
                document.body.classList.add('dark');
                this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.body.classList.remove('dark');
                this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        } catch (error) {
            console.error('Ошибка инициализации темы:', error);
        }
    }

    toggleTheme() {
        try {
            if (document.body.classList.contains('dark')) {
                document.body.classList.remove('dark');
                this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.add('dark');
                this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                localStorage.setItem('theme', 'dark');
            }
        } catch (error) {
            console.error('Ошибка переключения темы:', error);
        }
    }

    initializeTooltips() {
        try {
            const tooltips = document.querySelectorAll('.tooltip');
            const isFirstVisit = !localStorage.getItem('hasSeenTooltips');
            if (isFirstVisit) {
                tooltips.forEach(tooltip => {
                    tooltip.classList.add('visible');
                    setTimeout(() => tooltip.classList.remove('visible'), 5000);
                });
                localStorage.setItem('hasSeenTooltips', 'true');
            }
        } catch (error) {
            console.error('Ошибка инициализации подсказок:', error);
        }
    }

    showNotification(message) {
        try {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
                background: var(--notification-bg); color: var(--notification-text);
                padding: 10px 20px; border-radius: 5px; z-index: 1000;
                opacity: 0; transition: opacity 0.3s ease;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => (notification.style.opacity = '1'), 10);
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => document.body.removeChild(notification), 300);
            }, 3000);
        } catch (error) {
            console.error('Ошибка уведомления:', error);
        }
    }

    formatTime(seconds) {
        try {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        } catch (error) {
            console.error('Ошибка форматирования времени:', error);
            return '0:00';
        }
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    toggleVideoPlayback() {
        try {
            if (this.video.paused) {
                this.video.play().catch(err => console.error('Play error:', err));
            } else {
                this.video.pause();
            }
        } catch (error) {
            console.error('Ошибка переключения воспроизведения:', error);
        }
    }

    handleReaction(type, e) {
        try {
            if (e) e.stopPropagation();
            if (!this.state.userId) {
                this.showNotification('Войдите, чтобы ставить реакции');
                return;
            }
            const videoData = this.state.playlist[this.state.currentIndex].data;
            if (type === 'like') {
                if (videoData.userLikes.has(this.state.userId)) {
                    videoData.userLikes.delete(this.state.userId);
                    videoData.likes--;
                } else {
                    if (videoData.userDislikes.has(this.state.userId)) {
                        videoData.userDislikes.delete(this.state.userId);
                        videoData.dislikes--;
                    }
                    videoData.userLikes.add(this.state.userId);
                    videoData.likes++;
                    this.showReaction('like');
                }
            } else if (type === 'dislike') {
                if (videoData.userDislikes.has(this.state.userId)) {
                    videoData.userDislikes.delete(this.state.userId);
                    videoData.dislikes--;
                } else {
                    if (videoData.userLikes.has(this.state.userId)) {
                        videoData.userLikes.delete(this.state.userId);
                        videoData.likes--;
                    }
                    videoData.userDislikes.add(this.state.userId);
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
            this.updateVideoCache(this.state.currentIndex);
        } catch (error) {
            console.error('Ошибка реакции:', error);
            this.showNotification('Ошибка реакции');
        }
    }

    showReaction(type) {
        try {
            this.reactionAnimation.innerHTML =
                type === 'like' ? '<i class="fas fa-thumbs-up"></i>' : '<i class="fas fa-thumbs-down"></i>';
            this.reactionAnimation.classList.add('show');
            setTimeout(() => this.reactionAnimation.classList.remove('show'), 2000);
        } catch (error) {
            console.error('Ошибка показа реакции:', error);
        }
    }

    toggleSubmenu(e) {
        try {
            e.stopPropagation();
            this.state.isSubmenuOpen = !this.state.isSubmenuOpen;
            this.submenuUpload.classList.toggle('active', this.state.isSubmenuOpen);
            this.submenuChat.classList.toggle('active', this.state.isSubmenuOpen);
        } catch (error) {
            console.error('Ошибка переключения подменю:', error);
        }
    }

    toggleReactionBarVisibility(e) {
        try {
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
        } catch (error) {
            console.error('Ошибка переключения панели реакций:', error);
        }
    }

    async downloadCurrentVideo(e) {
        try {
            e.stopPropagation();
            const videoUrl = this.state.playlist[this.state.currentIndex].url;
            if (!videoUrl) {
                this.showNotification('Нет видео для скачивания!');
                return;
            }

            this.uploadBtn.classList.add('downloading');
            this.uploadBtn.style.setProperty('--progress', '0%');

            const response = await fetch(videoUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`Ошибка загрузки видео: ${response.status}`);

            const total = Number(response.headers.get('content-length')) || 0;
            let loaded = 0;
            const chunks = [];

            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                const progress = total ? (loaded / total) * 100 : this.simulateProgress(loaded);
                this.uploadBtn.style.setProperty('--progress', `${progress}%`);
            }

            const blob = new Blob(chunks, { type: 'video/mp4' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('Видео успешно скачано!');
        } catch (err) {
            console.error('Ошибка скачивания:', err);
            this.showNotification('Не удалось скачать видео!');
        } finally {
            this.uploadBtn.classList.remove('downloading');
            this.uploadBtn.style.setProperty('--progress', '0%');
        }
    }

    simulateProgress(loaded) {
        try {
            return Math.min(100, (loaded / (1024 * 1024)) * 10);
        } catch (error) {
            console.error('Ошибка симуляции прогресса:', error);
            return 0;
        }
    }

    startDragging(e) {
        try {
            e.preventDefault();
            let startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
            let isDragging = true;

            const onMove = e => {
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
        } catch (error) {
            console.error('Ошибка перетаскивания:', error);
        }
    }

    handleSubmenuUpload(e) {
        try {
            e.stopPropagation();
            e.preventDefault();
            this.videoUpload.click();
            this.toggleSubmenu();
        } catch (error) {
            console.error('Ошибка загрузки через подменю:', error);
        }
    }

    toggleFullscreen(e) {
        try {
            e.stopPropagation();
            e.preventDefault();

            if (this.tg && this.tg.isVersionGte('6.1')) {
                // Попробуем Telegram fullscreen
                this.tg.requestFullscreen().then(() => {
                    document.body.classList.add('telegram-fullscreen');
                    this.showNotification('Полноэкранный режим включён');
                }).catch(err => {
                    console.error('Ошибка Telegram fullscreen:', err);
                    // Fallback на браузерный fullscreen
                    this.tryBrowserFullscreen();
                });
            } else {
                this.tryBrowserFullscreen();
            }
        } catch (error) {
            console.error('Ошибка полноэкранного режима:', error);
            this.showNotification('Не удалось включить полноэкранный режим');
        }
    }

    tryBrowserFullscreen() {
        try {
            if (!document.fullscreenElement) {
                const element = this.playerContainer || document.documentElement;
                element.requestFullscreen().then(() => {
                    document.body.classList.add('fullscreen-mode');
                    this.showNotification('Полноэкранный режим включён');
                }).catch(err => {
                    console.error('Ошибка браузерного fullscreen:', err);
                    this.showNotification('Полноэкранный режим не поддерживается');
                });
            } else {
                document.exitFullscreen().then(() => {
                    document.body.classList.remove('fullscreen-mode');
                    this.showNotification('Полноэкранный режим выключен');
                }).catch(err => {
                    console.error('Ошибка выхода из fullscreen:', err);
                    this.showNotification('Не удалось выйти из полноэкранного режима');
                });
            }
        } catch (error) {
            console.error('Ошибка попытки браузерного fullscreen:', error);
            this.showNotification('Ошибка полноэкранного режима');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded');
    if (window.tronWeb) {
        console.log('TronWeb обнаружен при загрузке:', Object.keys(window.tronWeb));
    }
    const videoManager = new VideoManager();
    try {
        await videoManager.init();
        console.log('VideoManager успешно инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации VideoManager:', error);
        videoManager.showNotification('Критическая ошибка приложения');
    }
});
