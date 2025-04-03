const supabaseUrl = 'https://seckthcbnslsropswpik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2t0aGNibnNsc3JvcHN3cGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNzU3ODMsImV4cCI6MjA1ODc1MTc4M30.JoI03vFuRd-7sApD4dZ-zeBfUQlZrzRg7jtz0HgnJyI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const DEBUG = true;

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
        this.touchTimeout = null;
        this.uploadedFile = null;
        this.channels = JSON.parse(localStorage.getItem('channels')) || {};
    }

    async init() {
        if (DEBUG) console.log('Скрипт обновлён, версия 7');
        if (this.tg) {
            this.tg.ready();
            if (DEBUG) console.log('Полные данные initDataUnsafe:', this.tg.initDataUnsafe);
            if (this.tg.initDataUnsafe?.user) {
                this.userId = String(this.tg.initDataUnsafe.user.id);
                if (DEBUG) console.log('Telegram инициализирован, userId:', this.userId);
            } else {
                this.userId = 'testUser_' + Date.now();
                if (DEBUG) console.log('Тестовый userId:', this.userId);
            }
        } else {
            this.userId = 'testUser_' + Date.now();
            this.showNotification('Работа в режиме браузера');
            if (DEBUG) console.log('Тестовый userId:', this.userId);
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
        this.videoDescription = document.getElementById('videoDescription');
        this.videoDescriptionDisplay = document.getElementById('videoDescriptionDisplay');
        this.videoUpload = document.createElement('input');
        this.videoUpload.type = 'file';
        this.videoUpload.accept = 'video/mp4,video/quicktime,video/webm';
        this.videoUpload.style.display = 'none';
        document.body.appendChild(this.videoUpload);
    }

    bindEvents() {
        if (this.authBtn) this.authBtn.addEventListener('click', () => this.handleAuth());
        if (this.registerChannelBtn) this.registerChannelBtn.addEventListener('click', () => this.registerChannel());
        this.reactionButtons.forEach(btn => btn.addEventListener('click', (e) => this.handleReaction(btn.dataset.type, e)));
        this.plusBtn.addEventListener('click', (e) => this.toggleSubmenu(e));
        this.uploadBtn.addEventListener('click', (e) => this.downloadCurrentVideo(e));
        this.toggleReactionBar.addEventListener('click', () => this.toggleReactionBarVisibility());
        this.video.addEventListener('loadedmetadata', () => this.handleLoadedMetadata(), { once: true });
        this.video.addEventListener('play', () => this.handlePlay());
        this.video.addEventListener('pause', () => this.handlePause());
        this.video.addEventListener('ended', () => this.handleEnded());
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.progressRange.addEventListener('input', (e) => this.handleProgressInput(e));
        this.setupSwipeAndMouseEvents();
        this.sendCommentBtn.addEventListener('click', () => this.addComment());
        this.commentInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.addComment());
        this.submenuUpload.addEventListener('click', () => this.handleSubmenuUpload());
        this.videoUpload.addEventListener('change', (e) => this.handleVideoUpload(e));
        this.publishBtn.addEventListener('click', () => this.publishVideo());
        this.cancelBtn.addEventListener('click', () => this.cancelUpload());
        this.submenuChat.addEventListener('click', () => this.handleSubmenuChat());
        this.sendChatMessage.addEventListener('click', () => this.sendChat());
        this.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.sendChat());
        this.closeChat.addEventListener('click', () => this.chatModal.classList.remove('visible'));
        this.shareTelegram.addEventListener('click', () => this.shareViaTelegram());
        this.copyLink.addEventListener('click', () => this.copyVideoLink());
        this.closeShare.addEventListener('click', () => this.shareModal.classList.remove('visible'));
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        document.querySelector('.drag-handle')?.addEventListener('mousedown', (e) => this.startDragging(e));
        document.querySelector('.drag-handle')?.addEventListener('touchstart', (e) => this.startDragging(e), { passive: false });
        document.addEventListener('click', (e) => this.hideManagementListOnClickOutside(e));
    }

    handleAuth() {
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
        this.authScreen.style.display = 'none';
        this.playerContainer.style.display = 'flex';
        this.initializePlayer();
        this.bindUserAvatar();
    }

    bindUserAvatar() {
        this.userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isHolding) {
                const channel = this.channels[this.userId];
                if (channel && channel.link) {
                    if (this.tg?.isVersionGte('6.0')) this.tg.openTelegramLink(channel.link);
                    else window.open(channel.link, '_blank');
                } else this.registerChannel();
            }
        });

        const holdDuration = 2000;
        this.isHolding = false;

        const startHold = (e) => {
            e.preventDefault();
            if (this.touchTimeout || this.isHolding) return;
            this.isHolding = true;
            this.userAvatar.classList.add('holding');
            this.touchTimeout = setTimeout(() => {
                this.showVideoManagementList();
                this.touchTimeout = null;
                this.isHolding = false;
                this.userAvatar.classList.remove('holding');
            }, holdDuration);
        };

        const stopHold = () => {
            if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
                this.touchTimeout = null;
            }
            this.isHolding = false;
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
        if (!this.userId) {
            this.showNotification('Пожалуйста, войдите через Telegram.');
            return;
        }
        if (this.channels[this.userId]?.link) {
            this.showNotification('Канал уже зарегистрирован!');
            if (this.tg?.isVersionGte('6.0')) this.tg.openTelegramLink(this.channels[this.userId].link);
            else window.open(this.channels[this.userId].link, '_blank');
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
                this.showNotification('Ошибка при регистрации канала: ' + error.message);
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
        if (this.tg?.initDataUnsafe?.user?.photo_url) this.userAvatar.src = this.tg.initDataUnsafe.user.photo_url;
        else this.userAvatar.src = 'https://placehold.co/30';
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
        } catch (error) {
            this.showNotification('Не удалось загрузить видео: ' + error.message);
        }
    }

    loadVideo() {
        this.video.classList.remove('fade-in');
        this.video.classList.add(this.currentVideoIndex > this.prevIndex ? 'fade-out-left' : 'fade-out-right');
        requestAnimationFrame(() => {
            this.videoSource.src = this.videoPlaylist[this.currentVideoIndex];
            this.video.load();
            this.video.classList.remove('fade-out-left', 'fade-out-right');
            this.video.classList.add('fade-in');
            this.video.addEventListener('loadedmetadata', () => this.handleLoadedMetadata(), { once: true });
            this.updateCounters();
            this.loadComments();
            this.loadChatMessages();
            this.updateDescription();
            this.prevIndex = this.currentVideoIndex;
        });
    }

    handleLoadedMetadata() {
        this.video.muted = true;
        this.video.play().then(() => {
            this.video.pause();
            this.video.muted = false;
        }).catch(err => if (DEBUG) console.error('Ошибка разблокировки:', err));
        const videoData = this.videoDataStore[this.currentVideoIndex];
        videoData.duration = this.video.duration;
        this.progressRange.max = videoData.duration;
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
        e.preventDefault();
        this.endX = e.touches[0].clientX;
        this.endY = e.touches[0].clientY;
        const diffX = this.endX - this.startX;
        const diffY = this.endY - this.startY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
                this.touchTimeout = null;
            }
            this.isSwiping = true;
        }
    }

    handleTouchEnd(e) {
        if (this.touchTimeout) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
        }
        if (this.isSwiping) {
            const diffX = this.endX - this.startX;
            if (diffX > 50) this.playPrevVideo();
            else if (diffX < -50) this.playNextVideo();
        }
        this.isSwiping = false;
    }

    handleMouseStart(e) {
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.touchTimeout = setTimeout(() => this.toggleVideoPlayback(), 200);
        this.isSwiping = false;
    }

    handleMouseMove(e) {
        if (!e.buttons) return;
        this.endX = e.clientX;
        this.endY = e.clientY;
        const diffX = this.endX - this.startX;
        const diffY = this.endY - this.startY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
                this.touchTimeout = null;
            }
            this.isSwiping = true;
        }
    }

    handleMouseEnd(e) {
        if (this.touchTimeout) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
        }
        if (this.isSwiping) {
            const diffX = this.endX - this.startX;
            if (diffX > 50) this.playPrevVideo();
            else if (diffX < -50) this.playNextVideo();
        }
        this.isSwiping = false;
    }

    toggleVideoPlayback() {
        if (this.video.paused) this.video.play();
        else this.video.pause();
    }

    playNextVideo() {
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
        this.loadVideo();
    }

    playPrevVideo() {
        this.currentVideoIndex = (this.currentVideoIndex - 1 + this.videoPlaylist.length) % this.videoPlaylist.length;
        this.loadVideo();
    }

    updateCounters() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        this.viewCountSpan.textContent = videoData.views.size;
        this.likeCountEl.textContent = videoData.likes;
        this.dislikeCountEl.textContent = videoData.dislikes;
        this.commentCountEl.textContent = videoData.comments.length;
        this.shareCountEl.textContent = videoData.shares;
        this.updateVideoCache(this.currentVideoIndex);
    }

    updateRating() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const score = this.calculateVideoScore(videoData);
        this.ratingEl.textContent = `★ ${score.toFixed(1)}`;
    }

    calculateVideoScore(videoData) {
        const views = videoData.views.size || 1;
        const likes = videoData.likes || 0;
        const dislikes = videoData.dislikes || 0;
        const comments = videoData.comments.length || 0;
        const shares = videoData.shares || 0;
        const viewTime = videoData.viewTime || 0;
        const replays = videoData.replays || 0;
        const duration = videoData.duration || 1;
        const engagement = (likes + dislikes + comments + shares + replays) / views;
        const watchRatio = viewTime / duration;
        return Math.min(5, (engagement * 2 + watchRatio * 3));
    }

    handleReaction(type, e) {
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
                this.showFloatingReaction('👍', e.clientX, e.clientY);
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
                this.showFloatingReaction('👎', e.clientX, e.clientY);
            }
        } else if (type === 'comment') {
            this.commentsWindow.classList.add('visible');
        } else if (type === 'share') {
            this.shareModal.classList.add('visible');
        }
        this.updateCounters();
        this.updateRating();
    }

    showFloatingReaction(emoji, x, y) {
        const reaction = document.createElement('div');
        reaction.textContent = emoji;
        reaction.className = `floating-reaction ${emoji === '👍' ? 'like' : 'dislike'}`;
        reaction.style.left = `${x}px`;
        reaction.style.top = `${y}px`;
        document.body.appendChild(reaction);
        reaction.addEventListener('animationend', () => reaction.remove());
    }

    toggleReactionBarVisibility() {
        this.reactionBar.classList.toggle('visible');
        this.toggleReactionBar.classList.toggle('active');
    }

    toggleSubmenu(e) {
        this.isSubmenuOpen = !this.isSubmenuOpen;
        this.submenuUpload.classList.toggle('active', this.isSubmenuOpen);
        this.submenuChat.classList.toggle('active', this.isSubmenuOpen);
    }

    handleSubmenuUpload() {
        this.videoUpload.click();
        this.toggleSubmenu();
    }

    handleSubmenuChat() {
        this.chatModal.classList.add('visible');
        this.toggleSubmenu();
    }

    handleVideoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.uploadedFile = file;
        this.uploadModal.classList.add('visible');
        this.uploadPreview.src = URL.createObjectURL(file);
        this.uploadPreview.style.display = 'block';
        this.uploadPreview.load();
    }

    async publishVideo() {
        if (!this.uploadedFile) return;
        const fileName = `${this.userId}/${Date.now()}_${this.uploadedFile.name}`;
        try {
            const { data: storageData, error: uploadError } = await supabase.storage
                .from('videos')
                .upload(fileName, this.uploadedFile);
            if (uploadError) throw uploadError;

            this.uploadedFileUrl = `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
            const videoData = {
                url: this.uploadedFileUrl,
                author_id: this.userId,
                timestamp: new Date().toISOString(),
                description: this.videoDescription.value || ''
            };
            const { data, error: insertError } = await supabase
                .from('publicVideos')
                .insert(videoData);
            if (insertError) {
                await supabase.storage.from('videos').remove([fileName]);
                throw insertError;
            }
            this.videoPlaylist.unshift(this.uploadedFileUrl);
            this.videoDataStore.unshift({
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
                authorId: this.userId,
                lastPosition: 0,
                chatMessages: [],
                description: this.videoDescription.value || ''
            });
            this.currentVideoIndex = 0;
            this.loadVideo();
            this.uploadModal.classList.remove('visible');
            this.uploadPreview.style.display = 'none';
            this.uploadedFile = null;
            this.videoDescription.value = '';
            this.showNotification('Видео успешно опубликовано!');
        } catch (error) {
            this.showNotification('Ошибка загрузки: ' + error.message);
        }
    }

    cancelUpload() {
        this.uploadModal.classList.remove('visible');
        this.uploadPreview.style.display = 'none';
        this.uploadedFile = null;
        this.videoDescription.value = '';
    }

    async downloadCurrentVideo(e) {
        const videoUrl = this.videoPlaylist[this.currentVideoIndex];
        this.uploadBtn.classList.add('downloading');
        this.uploadBtn.style.setProperty('--progress', '0');
        try {
            const response = await fetch(videoUrl);
            if (!response.ok) throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${this.currentVideoIndex}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.uploadBtn.classList.remove('downloading');
            this.showNotification('Видео скачано!');
        } catch (error) {
            this.uploadBtn.classList.remove('downloading');
            this.showNotification('Ошибка скачивания: ' + error.message);
        }
    }

    addComment() {
        const text = this.commentInput.value.trim();
        if (!text) return;
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const comment = { userId: this.userId, text, timestamp: new Date().toISOString() };
        videoData.comments.push(comment);
        this.renderComments();
        this.commentInput.value = '';
        this.updateCounters();
        this.updateVideoCache(this.currentVideoIndex);
    }

    renderComments() {
        this.commentsList.innerHTML = '';
        const comments = this.videoDataStore[this.currentVideoIndex].comments;
        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `
                <img src="${this.tg?.initDataUnsafe?.user?.photo_url || 'https://placehold.co/30'}" alt="User Avatar">
                <div class="comment-text">${comment.text}</div>
            `;
            this.commentsList.appendChild(div);
        });
    }

    loadComments() {
        this.renderComments();
    }

    sendChat() {
        const text = this.chatInput.value.trim();
        if (!text) return;
        const videoData = this.videoDataStore[this.currentVideoIndex];
        const message = { userId: this.userId, text, timestamp: new Date().toISOString() };
        videoData.chatMessages.push(message);
        this.renderChatMessages();
        this.chatInput.value = '';
        this.updateVideoCache(this.currentVideoIndex);
    }

    renderChatMessages() {
        this.chatMessages.innerHTML = '';
        const messages = this.videoDataStore[this.currentVideoIndex].chatMessages;
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.userId === this.userId ? 'sent' : 'received'}`;
            div.textContent = msg.text;
            this.chatMessages.appendChild(div);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    loadChatMessages() {
        this.renderChatMessages();
    }

    updateDescription() {
        const description = this.videoDataStore[this.currentVideoIndex].description;
        this.videoDescriptionDisplay.textContent = description || '';
    }

    shareViaTelegram() {
        const url = this.videoPlaylist[this.currentVideoIndex];
        if (this.tg) this.tg.sendData(JSON.stringify({ type: 'share', url }));
        else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, '_blank');
        this.videoDataStore[this.currentVideoIndex].shares++;
        this.updateCounters();
        this.shareModal.classList.remove('visible');
    }

    copyVideoLink() {
        const url = this.videoPlaylist[this.currentVideoIndex];
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('Ссылка скопирована!');
            this.videoDataStore[this.currentVideoIndex].shares++;
            this.updateCounters();
        });
        this.shareModal.classList.remove('visible');
    }

    toggleTheme() {
        document.body.classList.toggle('dark');
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }

    initializeTheme() {
        if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
    }

    initializeTooltips() {
        setTimeout(() => document.getElementById('tooltipSwipe').classList.add('visible'), 1000);
        setTimeout(() => document.getElementById('tooltipSwipe').classList.remove('visible'), 4000);
    }

    preloadNextVideo() {
        const nextIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
        if (!this.preloadedVideos[nextIndex]) {
            const videoEl = document.createElement('video');
            videoEl.src = this.videoPlaylist[nextIndex];
            videoEl.preload = 'auto';
            this.preloadedVideos[nextIndex] = videoEl;
            if (Object.keys(this.preloadedVideos).length > this.MAX_PRELOAD_SIZE) this.cleanPreloadedVideos();
        }
    }

    cleanPreloadedVideos() {
        Object.keys(this.preloadedVideos).forEach(key => {
            if (Math.abs(key - this.currentVideoIndex) > this.MAX_PRELOAD_SIZE) {
                const videoEl = this.preloadedVideos[key];
                if (videoEl && videoEl.src) {
                    videoEl.pause();
                    videoEl.src = '';
                    URL.revokeObjectURL(videoEl.src);
                }
                delete this.preloadedVideos[key];
            }
        });
    }

    updateVideoCache(index) {
        const videoData = this.videoDataStore[index];
        try {
            localStorage.setItem(`videoData_${this.videoPlaylist[index]}`, JSON.stringify({
                views: Array.from(videoData.views),
                likes: videoData.likes,
                dislikes: videoData.dislikes,
                userLikes: Array.from(videoData.userLikes),
                userDislikes: Array.from(videoData.userDislikes),
                comments: videoData.comments,
                shares: videoData.shares,
                viewTime: videoData.viewTime,
                replays: videoData.replays,
                duration: videoData.duration,
                authorId: videoData.authorId,
                lastPosition: videoData.lastPosition,
                chatMessages: videoData.chatMessages,
                description: videoData.description
            }));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.showNotification('Локальное хранилище заполнено!');
                localStorage.clear();
            }
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '10px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.background = 'var(--notification-bg)';
        notification.style.color = 'var(--notification-text)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    throttle(func, ms) {
        let isThrottled = false, savedArgs, savedThis;
        return function wrapper(...args) {
            if (isThrottled) {
                savedArgs = args;
                savedThis = this;
                return;
            }
            func.apply(this, args);
            isThrottled = true;
            setTimeout(() => {
                isThrottled = false;
                if (savedArgs) {
                    wrapper.apply(savedThis, savedArgs);
                    savedArgs = savedThis = null;
                }
            }, ms);
        };
    }

    startDragging(e) {
        let startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        const initialHeight = this.commentsWindow.offsetHeight;
        const moveHandler = (moveEvent) => {
            const currentY = moveEvent.type === 'mousemove' ? moveEvent.clientY : moveEvent.touches[0].clientY;
            const diff = startY - currentY;
            this.commentsWindow.style.height = `${Math.max(100, initialHeight + diff)}px`;
        };
        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', upHandler);
    }

    showVideoManagementList() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (videoData.authorId !== this.userId) return;
        const list = document.createElement('div');
        list.className = 'management-list';
        list.style.position = 'absolute';
        list.style.bottom = '15vh';
        list.style.left = '50%';
        list.style.transform = 'translateX(-50%)';
        list.style.background = 'rgba(0, 0, 0, 0.8)';
        list.style.color = '#fff';
        list.style.padding = '10px';
        list.style.borderRadius = '10px';
        list.style.zIndex = '100';
        list.innerHTML = '<button class="delete-btn">Удалить видео</button>';
        document.body.appendChild(list);
        list.querySelector('.delete-btn').addEventListener('click', () => this.deleteVideo());
        this.managementList = list;
    }

    hideManagementListOnClickOutside(e) {
        if (this.managementList && !this.managementList.contains(e.target) && !this.userAvatar.contains(e.target)) {
            this.managementList.remove();
            this.managementList = null;
        }
    }

    async deleteVideo() {
        const videoUrl = this.videoPlaylist[this.currentVideoIndex];
        try {
            const fileName = videoUrl.split('/').slice(-1)[0];
            const { error: deleteError } = await supabase.storage.from('videos').remove([`${this.userId}/${fileName}`]);
            if (deleteError) throw deleteError;
            const { error: dbError } = await supabase.from('publicVideos').delete().eq('url', videoUrl);
            if (dbError) throw dbError;
            this.videoPlaylist.splice(this.currentVideoIndex, 1);
            this.videoDataStore.splice(this.currentVideoIndex, 1);
            if (this.videoPlaylist.length === 0) {
                this.videoPlaylist.push("https://www.w3schools.com/html/mov_bbb.mp4");
                this.videoDataStore.push({
                    views: new Set(),
                    likes: 0,
                    dislikes: 0,
                    userLikes:
