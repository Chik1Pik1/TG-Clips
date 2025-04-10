// Инициализация Supabase (без ключа на фронтенде, предполагается серверная авторизация)
const supabaseUrl = 'https://seckthcbnslsropswpik.supabase.co';
const supabase = window.supabase.createClient(supabaseUrl, null, {
    auth: { autoRefreshToken: false, persistSession: false }
});

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

        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
            console.log('Telegram Web App инициализирован:', this.tg.initDataUnsafe);
        } else {
            console.warn('Telegram Web App SDK не загружен. Работа в режиме браузера.');
        }
    }

    async init() {
        console.log('Скрипт обновлён, версия 8');
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
    }

    bindEvents() {
        this.authBtn?.addEventListener('click', () => this.handleAuth());
        this.registerChannelBtn?.addEventListener('click', () => this.registerChannel());
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
        this.bindUserAvatar();
    }

    // Исправленный метод handleAuth
    handleAuth() {
        if (this.tg?.initDataUnsafe?.user) {
            this.state.userId = String(this.tg.initDataUnsafe.user.id);
            this.showNotification('Вход выполнен: ' + this.state.userId);
            this.showPlayer();
        } else {
            this.state.userId = 'browserUser_' + Date.now();
            this.showNotification('Режим браузера: тестовый ID');
            this.showPlayer();
        }
    }

    showPlayer() {
        if (this.authScreen && this.playerContainer) {
            this.authScreen.style.display = 'none';
            this.playerContainer.style.display = 'flex';
            this.initializePlayer();
        } else {
            console.error('Ошибка: authScreen или playerContainer не найдены');
        }
    }

    // Исправленный метод bindUserAvatar
    bindUserAvatar() {
        if (!this.userAvatar) return;

        this.userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            const channel = this.state.channels[this.state.userId];
            if (channel?.link) {
                if (this.tg?.isVersionGte('6.0')) {
                    this.tg.openTelegramLink(channel.link);
                } else {
                    window.open(channel.link, '_blank');
                }
            } else {
                this.showNotification('Канал не зарегистрирован');
            }
        });

        // Остальной код для удержания
        const holdDuration = 2000;
        const startHold = (e) => {
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

        if (this.state.channels[this.state.userId]?.link) {
            this.showNotification('Канал уже зарегистрирован!');
            if (this.tg?.isVersionGte('6.0')) {
                this.tg.openTelegramLink(this.state.channels[this.state.userId].link);
            } else {
                window.open(this.state.channels[this.state.userId].link, '_blank');
            }
            return;
        }

        const channelLink = prompt('Введите ссылку на ваш Telegram-канал (например, https://t.me/yourchannel):');
        if (channelLink && channelLink.match(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/)) {
            this.state.channels[this.state.userId] = { videos: [], link: channelLink };
            localStorage.setItem('channels', JSON.stringify(this.state.channels));
            try {
                await supabase.from('users').upsert({ telegram_id: this.state.userId, channel_link: channelLink });
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
        if (this.userAvatar && this.tg?.initDataUnsafe?.user?.photo_url) {
            this.userAvatar.src = this.tg.initDataUnsafe.user.photo_url;
        } else {
            this.userAvatar.src = 'https://placehold.co/30';
        }
        this.initializeTheme();
        this.initializeTooltips();
    }

    async loadInitialVideos() {
        try {
            const { data, error } = await supabase
                .from('publicVideos')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (error) throw error;

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
            })) || [
                { url: "https://www.w3schools.com/html/mov_bbb.mp4", data: this.createEmptyVideoData('testAuthor123') },
                { url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4", data: this.createEmptyVideoData('testAuthor123') },
                { url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", data: this.createEmptyVideoData('testAuthor123') }
            ];
            this.loadVideo();
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            this.showNotification(`Не удалось загрузить видео: ${error.message}`);
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
    }

    handlePlay() {
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
    }

    handlePause() {
        if (!this.state.isProgressBarActivated) {
            this.state.isProgressBarActivated = true;
            this.progressBar.classList.add('visible');
        }
        this.state.playlist[this.state.currentIndex].data.lastPosition = this.video.currentTime;
        this.updateVideoCache(this.state.currentIndex);
    }

    handleEnded() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        if (this.video.currentTime >= this.video.duration * 0.9) videoData.replays++;
        videoData.lastPosition = 0;
        this.updateVideoCache(this.state.currentIndex);
        this.playNextVideo();
    }

    handleTimeUpdate() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        videoData.viewTime += this.video.currentTime - this.state.lastTime;
        videoData.lastPosition = this.video.currentTime;
        this.state.lastTime = this.video.currentTime;
        this.progressRange.value = this.video.currentTime;
        this.updateVideoCache(this.state.currentIndex);
        this.updateRating();
    }

    handleProgressInput(e) {
        this.video.currentTime = e.target.value;
        this.state.playlist[this.state.currentIndex].data.lastPosition = this.video.currentTime;
        this.updateVideoCache(this.state.currentIndex);
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
        this.state.startX = e.touches[0].clientX;
        this.state.startY = e.touches[0].clientY;
        this.state.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
        this.state.isSwiping = false;
    }

    handleTouchMove(e) {
        this.state.endX = e.touches[0].clientX;
        this.state.endY = e.touches[0].clientY;
        const deltaX = this.state.endX - this.state.startX;
        const deltaY = this.state.endY - this.state.startY;

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            clearTimeout(this.state.touchTimeout);
            this.state.touchTimeout = null;
            this.state.isSwiping = true;
        }
    }

    handleTouchEnd(e) {
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
    }

    handleMouseStart(e) {
        e.preventDefault();
        this.state.isDragging = true;
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.state.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
        this.state.isSwiping = false;
    }

    handleMouseMove(e) {
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
    }

    handleMouseEnd(e) {
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
    }

    showFloatingReaction(type, x, y) {
        const reaction = document.createElement('div');
        reaction.className = `floating-reaction ${type}`;
        reaction.textContent = type === 'like' ? '👍' : '👎';
        reaction.style.left = `${x}px`;
        reaction.style.top = `${y}px`;
        document.body.appendChild(reaction);
        setTimeout(() => reaction.remove(), 1500);
    }

    playNextVideo() {
        this.recommendNextVideo();
        this.loadVideo('left');
        this.state.hasViewed = false;
    }

    playPreviousVideo() {
        this.state.currentIndex = (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length;
        this.loadVideo('right');
        this.state.hasViewed = false;
    }

    loadVideo(direction = 'left') {
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
            this.video.addEventListener('canplay', () => {
                clearTimeout(timeout);
                const lastPosition = this.state.playlist[this.state.currentIndex].data.lastPosition;
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
    }

    updateComments() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        this.commentsList.innerHTML = '';
        videoData.comments.forEach((comment, idx) => {
            const userPhoto = (this.tg?.initDataUnsafe?.user?.id === comment.userId && this.tg?.initDataUnsafe?.user?.photo_url)
                ? this.tg.initDataUnsafe.user.photo_url
                : 'https://placehold.co/30';
            const username = (this.tg?.initDataUnsafe?.user?.id === comment.userId && this.tg?.initDataUnsafe?.user?.username)
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
                commentEl.querySelector('.delete-comment-btn').addEventListener('click', () => this.deleteComment(idx));
            }
            commentEl.querySelector('.comment-avatar').addEventListener('click', () => this.handleAvatarClick(comment.userId));
        });
        this.commentsList.scrollTop = this.commentsList.scrollHeight;
    }

    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    replyToComment(index) {
        this.commentInput.dataset.replyTo = index;
        this.commentInput.placeholder = `Ответ на: "${this.state.playlist[this.state.currentIndex].data.comments[index].text.slice(0, 20)}..."`;
        this.commentInput.focus();
    }

    async deleteComment(index) {
        if (confirm('Удалить этот комментарий?')) {
            this.state.playlist[this.state.currentIndex].data.comments.splice(index, 1);
            this.updateComments();
            this.updateCounters();
            await this.updateVideoCache(this.state.currentIndex);
            this.showNotification('Комментарий удалён');
        }
    }

    handleAvatarClick(userId) {
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
    }

    updateDescription() {
        let descriptionEl = document.getElementById('videoDescriptionDisplay');
        if (!descriptionEl) {
            descriptionEl = document.createElement('div');
            descriptionEl.id = 'videoDescriptionDisplay';
            document.querySelector('.video-wrapper')?.insertAdjacentElement('afterend', descriptionEl);
        }
        descriptionEl.textContent = this.state.playlist[this.state.currentIndex].data.description || 'Описание отсутствует';
    }

    updateChat() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        this.chatMessages.innerHTML = '';
        videoData.chatMessages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.sender === this.state.userId ? 'sent' : 'received'}`;
            messageEl.textContent = msg.text;
            this.chatMessages.appendChild(messageEl);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async sendChat() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const text = this.chatInput.value.trim();
        if (text) {
            videoData.chatMessages.push({ sender: this.state.userId, text });
            this.chatInput.value = '';
            this.updateChat();
            await this.updateVideoCache(this.state.currentIndex);
            setTimeout(() => {
                videoData.chatMessages.push({ sender: videoData.authorId, text: "Спасибо за сообщение!" });
                this.updateChat();
                this.updateVideoCache(this.state.currentIndex);
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
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        const description = this.state.playlist[this.state.currentIndex].data.description || 'Смотри это крутое видео!';
        const text = `${description}\n${videoUrl}`;
        if (this.tg?.isVersionGte('6.2')) {
            this.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(description)}`);
        } else {
            navigator.clipboard.writeText(text)
                .then(() => this.showNotification('Ссылка скопирована! Вставьте её в Telegram.'))
                .catch(err => this.showNotification('Не удалось скопировать ссылку'));
        }
        this.shareModal.classList.remove('visible');
        this.state.playlist[this.state.currentIndex].data.shares++;
        this.updateCounters();
        this.updateVideoCache(this.state.currentIndex);
    }

    copyVideoLink() {
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        navigator.clipboard.writeText(videoUrl)
            .then(() => {
                this.showNotification('Ссылка скопирована!');
                this.shareModal.classList.remove('visible');
            })
            .catch(err => this.showNotification('Не удалось скопировать ссылку'));
    }

    async handleVideoUpload(e) {
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
    }

    // Исправленный метод publishVideo с обработкой ошибок
    async publishVideo() {
        if (!this.state.uploadedFile) return;

        const file = this.state.uploadedFile;
        const fileName = `${this.state.userId}/${Date.now()}_${file.name}`;
        const description = document.getElementById('videoDescription')?.value || '';

        try {
            const { data: storageData, error: uploadError } = await supabase.storage
                .from('videos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type
                });

            if (uploadError) throw uploadError;

            this.state.uploadedFileUrl = supabase.storage.from('videos').getPublicUrl(fileName).data.publicUrl;

            const videoData = {
                url: this.state.uploadedFileUrl,
                author_id: this.state.userId,
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

            if (insertError) throw insertError;

            this.showNotification('Видео успешно опубликовано!');
            this.uploadModal.classList.remove('visible');
            this.state.uploadedFile = null;

            this.state.playlist.unshift({ url: this.state.uploadedFileUrl, data: this.createEmptyVideoData(this.state.userId) });
            this.state.currentIndex = 0;
            this.loadVideo();
        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification(`Ошибка: ${error.message}`);
        }
    }

    cancelUpload() {
        this.state.uploadedFileUrl = null;
        this.state.uploadedFile = null;
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
        const index = this.state.playlist.findIndex(v => v.url === url);
        if (index === -1) return;
        const newDescription = prompt('Введите новое описание:', this.state.playlist[index].data.description);
        if (newDescription !== null) {
            this.state.playlist[index].data.description = newDescription;
            this.updateVideoCache(index);
            document.querySelector(`.video-item [data-url="${url}"]`).parentElement.querySelector('span').textContent = newDescription || 'Без описания';
            this.showNotification('Описание обновлено!');
            if (this.state.currentIndex === index) this.updateDescription();
        }
    }

    async deleteVideo(url) {
        const { error: deleteDbError } = await supabase
            .from('publicVideos')
            .delete()
            .eq('url', url)
            .eq('author_id', this.state.userId);
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
        const index = this.state.playlist.findIndex(v => v.url === url);
        if (index !== -1) {
            this.state.playlist.splice(index, 1);
            if (this.state.currentIndex === index) {
                this.state.currentIndex = Math.min(this.state.currentIndex, this.state.playlist.length - 1);
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
        const videoData = this.state.playlist[this.state.currentIndex].data;
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
        return Math.max(0, Math.min(5, (rawScore / maxPossibleScore) * 5));
    }

    updateRating() {
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const duration = videoData.duration || 300;
        const score = this.calculateVideoScore(videoData, duration);
        const fullStars = Math.floor(score);
        const halfStar = score % 1 >= 0.5 ? 1 : 0;
        const emptyStars = Math.max(0, 5 - fullStars - halfStar);
        if (this.ratingEl) this.ratingEl.innerHTML = '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    recommendNextVideo() {
        const scores = this.state.playlist.map((video, index) => ({
            index,
            score: this.calculateVideoScore(video.data, video.data.duration || 300)
        }));
        scores.sort((a, b) => b.score - a.score);
        const nextVideo = scores.find(item => item.index !== this.state.currentIndex) || scores[0];
        this.state.currentIndex = nextVideo.index;
    }

    preloadNextVideo() {
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
    }

    cleanPreloadedVideos() {
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
    }

    async updateVideoCache(index) {
        const videoData = this.state.playlist[index].data;
        const url = this.state.playlist[index].url;
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
            const { error } = await supabase
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
    }

    showReaction(type) {
        this.reactionAnimation.innerHTML = type === 'like' ? '<i class="fas fa-thumbs-up"></i>' : '<i class="fas fa-thumbs-down"></i>';
        this.reactionAnimation.classList.add('show');
        setTimeout(() => this.reactionAnimation.classList.remove('show'), 2000);
    }

    toggleSubmenu(e) {
        e.stopPropagation();
        this.state.isSubmenuOpen = !this.state.isSubmenuOpen;
        this.submenuUpload.classList.toggle('active', this.state.isSubmenuOpen);
        this.submenuChat.classList.toggle('active', this.state.isSubmenuOpen);
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
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        if (!videoUrl) {
            this.showNotification('Нет видео для скачивания!');
            return;
        }

        this.uploadBtn.classList.add('downloading');
        this.uploadBtn.style.setProperty('--progress', '0%');

        try {
            const response = await fetch(videoUrl, { mode: 'cors' });
            if (!response.ok) throw new Error('Ошибка загрузки видео');

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
        return Math.min(100, (loaded / (1024 * 1024)) * 10); // 10% за каждый MB
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

    // Исправленный метод toggleFullscreen
    toggleFullscreen(e) {
        e.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            if (this.tg?.isVersionGte('6.1')) {
                this.tg.requestFullscreen()
                    .then(() => {
                        document.body.classList.add('telegram-fullscreen');
                    })
                    .catch(() => {
                        document.documentElement.requestFullscreen()
                            .catch(err => console.error('Fullscreen error:', err));
                    });
            } else {
                document.documentElement.requestFullscreen()
                    .catch(err => console.error('Fullscreen error:', err));
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
