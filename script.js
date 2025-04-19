const SERVER_URL = 'https://tg-clips.andrej-vorontszov.workers.dev';

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
            channels: {},
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
            endY: 0,
            isUserInitiated: false
        };
        this.tg = window.Telegram?.WebApp;
        this.MAX_PRELOAD_SIZE = 3;
        this.MAX_PLAYLIST_SIZE = 10;

        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
            console.log('Telegram Web App initialized:', this.tg.initDataUnsafe);
            console.log('Telegram Web App version:', this.tg.version);
        } else {
            console.warn('Telegram Web App SDK not loaded. Running in browser mode.');
        }
    }

    async init() {
        console.log('Script updated, version 17');
        if (this.tg?.initDataUnsafe?.user) {
            this.state.userId = String(this.tg.initDataUnsafe.user.id);
            console.log('Telegram initialized, userId:', this.state.userId);
        } else {
            this.state.userId = 'testUser_' + Date.now();
            console.log('Test userId:', this.state.userId);
        }

        await this.loadChannels();
        console.log('Registered channels:', this.state.channels);

        this.bindElements();
        this.bindEvents();
        await this.loadInitialVideos();
        this.showPlayer();
    }

    async loadChannels() {
        try {
            const response = await this.retryFetch(`${SERVER_URL}/api/channels`, { method: 'GET' });
            console.log('Response /api/channels:', response.status);
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const channels = await response.json();
            this.state.channels = channels.reduce((acc, channel) => {
                acc[channel.user_id] = { link: channel.channel_name, videos: [] };
                return acc;
            }, {});
            console.log('Channels loaded from Supabase:', this.state.channels);
            localStorage.setItem('cachedChannels', JSON.stringify(this.state.channels));
        } catch (error) {
            console.error('Error loading channels:', error.message, error.stack);
            this.showNotification(`Failed to load channels: ${error.message}${this.tg ? '. Try refreshing.' : ''}`);
            const cachedChannels = localStorage.getItem('cachedChannels');
            this.state.channels = cachedChannels ? JSON.parse(cachedChannels) : {};
            console.log('Using cached channels:', this.state.channels);
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
    }

    bindEvents() {
        const bindButton = (btn, handler, name) => {
            if (btn) {
                btn.addEventListener('click', handler);
                console.log(`${name} bound`);
            } else {
                console.warn(`${name} not found`);
            }
        };

        bindButton(this.authBtn, () => this.handleAuth(), '#authBtn');
        bindButton(this.registerChannelBtn, () => this.registerChannel(), '#registerChannelBtn');

        this.reactionButtons.forEach(btn => btn.addEventListener('click', (e) => this.handleReaction(btn.dataset.type, e)));
        bindButton(this.plusBtn, (e) => this.toggleSubmenu(e), '.plus-btn');
        bindButton(this.uploadBtn, (e) => this.downloadCurrentVideo(e), '.upload-btn');
        bindButton(this.toggleReactionBar, (e) => this.toggleReactionBarVisibility(e), '.toggle-reaction-bar');
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => this.handleLoadedMetadata(), { once: true });
            this.video.addEventListener('play', () => this.handlePlay());
            this.video.addEventListener('pause', () => this.handlePause());
            this.video.addEventListener('ended', () => this.handleEnded());
            this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
            this.video.addEventListener('click', () => this.handleVideoClick());
        }
        bindButton(this.progressRange, (e) => this.handleProgressInput(e), '#progressRange');
        this.setupSwipeAndMouseEvents();
        bindButton(this.sendCommentBtn, () => this.addComment(), '#sendComment');
        if (this.commentInput) {
            this.commentInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.addComment());
        }
        bindButton(this.submenuUpload, (e) => this.handleSubmenuUpload(e), '#uploadVideo');
        if (this.videoUpload) {
            this.videoUpload.addEventListener('change', (e) => this.handleVideoUpload(e));
        }
        bindButton(this.publishBtn, () => this.publishVideo(), '#publishBtn');
        bindButton(this.cancelBtn, () => this.cancelUpload(), '#cancelBtn');
        bindButton(this.submenuChat, (e) => this.handleSubmenuChat(e), '#chatAuthor');
        bindButton(this.sendChatMessage, () => this.sendChat(), '#sendChatMessage');
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.sendChat());
        }
        bindButton(this.closeChat, () => this.chatModal.classList.remove('visible'), '#closeChat');
        bindButton(this.shareTelegram, () => this.shareViaTelegram(), '#shareTelegram');
        bindButton(this.copyLink, () => this.copyVideoLink(), '#copyLink');
        bindButton(this.closeShare, () => this.shareModal.classList.remove('visible'), '#closeShare');
        bindButton(this.themeToggle, () => this.toggleTheme(), '.theme-toggle');
        const dragHandle = document.querySelector('.drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => this.startDragging(e));
            dragHandle.addEventListener('touchstart', (e) => this.startDragging(e), { passive: false });
        }
        bindButton(document.querySelector('.fullscreen-btn'), (e) => this.toggleFullscreen(e), '.fullscreen-btn');
        document.addEventListener('click', (e) => this.hideManagementListOnClickOutside(e));
        window.addEventListener('beforeunload', () => {
            if (this.state.playlist && this.state.currentIndex >= 0) {
                this.updateVideoCache(this.state.currentIndex);
            }
        });
        this.bindUserAvatar();
    }

    async retryFetch(url, options, maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Accept': 'application/json'
                    }
                });
                if (response.ok) return response;
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            } catch (error) {
                attempt++;
                console.error(`Fetch attempt ${attempt}/${maxRetries} failed for ${url}:`, error.message, error.stack);
                if (attempt === maxRetries) {
                    throw new Error(`Failed to fetch ${url}: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    handleVideoClick() {
        this.state.isUserInitiated = true;
        if (this.video.paused) {
            this.video.play().catch(err => {
                console.error('Play error:', err.message, err.stack);
                this.showNotification(`Failed to play video: ${err.message}. Click the video to play.`);
            });
        }
    }

    handleAuth() {
        console.log('Handling auth click');
        if (this.tg?.initDataUnsafe?.user) {
            this.state.userId = String(this.tg.initDataUnsafe.user.id);
            this.showNotification('Login successful: ' + this.state.userId);
        } else {
            this.state.userId = 'browserTestUser_' + Date.now();
            this.showNotification('Simulated login: ' + this.state.userId);
        }
        this.showPlayer();
    }

    showPlayer() {
        if (this.authScreen && this.playerContainer) {
            this.authScreen.style.display = 'none';
            this.playerContainer.style.display = 'flex';
            this.initializePlayer();
        } else {
            console.error('Error: authScreen or playerContainer not found');
        }
    }

    bindUserAvatar() {
        if (!this.userAvatar) {
            console.error('Element #userAvatar not found!');
            return;
        }

        this.userAvatar.addEventListener('click', async (e) => {
            e.stopPropagation();
            console.log('Avatar click, userId:', this.state.userId);
            if (!this.state.isHolding) {
                const channel = this.state.channels[this.state.userId];
                if (channel?.link) {
                    console.log('Navigating to channel:', channel.link);
                    try {
                        if (this.tg && this.tg.openTelegramLink) {
                            this.tg.openTelegramLink(channel.link);
                        } else {
                            window.open(channel.link, '_blank');
                        }
                    } catch (error) {
                        console.error('Error navigating to channel:', error.message, error.stack);
                        this.showNotification('Failed to open channel!');
                    }
                } else {
                    this.showNotification('Channel not registered. Register it now!');
                    await this.registerChannel();
                }
            }
        });

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
            this.showNotification('Please log in via Telegram.');
            return;
        }
        const channelLink = prompt('Enter your Telegram channel link (e.g., https://t.me/yourchannel):');
        console.log('Entered link:', channelLink);
        if (channelLink && channelLink.match(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/)) {
            try {
                const response = await this.retryFetch(`${SERVER_URL}/api/register-channel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.state.userId, channelName: channelLink })
                });
                console.log('Response /api/register-channel:', response.status);
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                this.state.channels[this.state.userId] = { link: channelLink, videos: [] };
                console.log('Channels after registration:', this.state.channels);
                localStorage.setItem('cachedChannels', JSON.stringify(this.state.channels));
                this.showNotification('Channel successfully registered!');
                this.showPlayer();
            } catch (error) {
                console.error('Error registering channel:', error.message, error.stack);
                this.showNotification(`Error registering channel: ${error.message}${this.tg ? '. Try again.' : ''}`);
            }
        } else {
            this.showNotification('Enter a valid Telegram channel link.');
        }
    }

    initializePlayer() {
        if (this.userAvatar) {
            this.userAvatar.src = this.tg?.initDataUnsafe?.user?.photo_url || '/images/default-avatar.png';
        }
        this.initializeTheme();
        this.initializeTooltips();
    }

    async loadInitialVideos() {
        const stockVideos = [
            { url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4", data: this.createEmptyVideoData('testAuthor123') },
            { url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4", data: this.createEmptyVideoData('testAuthor123') },
            { url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4", data: this.createEmptyVideoData('testAuthor123') }
        ];

        try {
            console.log('Attempting to load videos from server...');
            const response = await this.retryFetch(`${SERVER_URL}/api/public-videos`, { method: 'GET' });
            console.log('Response /api/public-videos:', response.status);
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();
            console.log('Received data:', data);

            if (!data || !Array.isArray(data) || data.length === 0) {
                console.warn('Server returned empty or invalid response, using stock videos');
                this.state.playlist = stockVideos;
            } else {
                this.state.playlist = data.map(video => ({
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
                }));
            }
        } catch (error) {
            console.error('Error loading videos from server:', error.message, error.stack);
            this.showNotification(`Failed to load videos: ${error.message}${this.tg ? '. Using local videos.' : ''}`);
            const cachedVideos = localStorage.getItem('cachedVideos');
            if (cachedVideos) {
                this.state.playlist = JSON.parse(cachedVideos);
                console.log('Loaded cached videos:', this.state.playlist);
            } else {
                this.state.playlist = stockVideos;
                console.log('Using stock videos:', this.state.playlist);
            }
        }

        localStorage.setItem('cachedVideos', JSON.stringify(this.state.playlist));
        console.log('Final playlist:', this.state.playlist);
        if (this.state.playlist.length > 0) {
            this.state.currentIndex = 0;
            this.loadVideo();
        } else {
            console.error('Playlist empty after all attempts!');
            this.showNotification('No videos available!');
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
        if (!this.video) return;
        this.video.muted = true;
        this.video.load();
        const videoData = this.state.playlist[this.state.currentIndex]?.data;
        if (videoData) {
            videoData.duration = this.video.duration;
            this.progressRange.max = this.video.duration;
            this.progressRange.value = videoData.lastPosition || 0;
            this.updateVideoCache(this.state.currentIndex);
            this.updateRating();
        }
        this.showNotification('Click the video to start playback.');
    }

    handlePlay() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, playback handling impossible');
            return;
        }
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, pause handling impossible');
            return;
        }
        if (!this.state.isProgressBarActivated) {
            this.state.isProgressBarActivated = true;
            this.progressBar.classList.add('visible');
        }
        const videoData = this.state.playlist[this.state.currentIndex]?.data;
        if (videoData) {
            videoData.lastPosition = this.video.currentTime;
            this.updateVideoCache(this.state.currentIndex);
        }
    }

    handleEnded() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, end handling impossible');
            return;
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        if (this.video.currentTime >= this.video.duration * 0.9) videoData.replays++;
        videoData.lastPosition = 0;
        this.updateVideoCache(this.state.currentIndex);
        this.playNextVideo();
    }

    handleTimeUpdate() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, time update impossible');
            return;
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const currentTime = this.video.currentTime;
        const timeDiff = currentTime - this.state.lastTime;
        if (timeDiff >= 1) {
            videoData.viewTime += timeDiff;
            videoData.lastPosition = currentTime;
            this.state.lastTime = currentTime;
            this.progressRange.value = currentTime;
            this.updateVideoCache(this.state.currentIndex);
        }
        this.updateRating();
    }

    handleProgressInput(e) {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, progress handling impossible');
            return;
        }
        this.video.currentTime = e.target.value;
        const videoData = this.state.playlist[this.state.currentIndex]?.data;
        if (videoData) {
            videoData.lastPosition = this.video.currentTime;
            this.updateVideoCache(this.state.currentIndex);
        }
    }

    setupSwipeAndMouseEvents() {
        if (this.swipeArea) {
            this.swipeArea.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            this.swipeArea.addEventListener('touchmove', this.throttle((e) => this.handleTouchMove(e), 16), { passive: false });
            this.swipeArea.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            this.swipeArea.addEventListener('mousedown', (e) => this.handleMouseStart(e));
            this.swipeArea.addEventListener('mousemove', this.throttle((e) => this.handleMouseMove(e), 16));
            this.swipeArea.addEventListener('mouseup', (e) => this.handleMouseEnd(e));
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.state.startX = e.touches[0].clientX;
        this.state.startY = e.touches[0].clientY;
        this.state.isSwiping = false;
        if (!this.state.isHolding && !this.state.isDragging) {
            this.toggleVideoPlayback();
        }
    }

    handleTouchMove(e) {
        this.state.endX = e.touches[0].clientX;
        this.state.endY = e.touches[0].clientY;
        const deltaX = this.state.endX - this.state.startX;
        const deltaY = this.state.endY - this.state.startY;
        const minMovement = 10;
        if (Math.abs(deltaX) > minMovement || Math.abs(deltaY) > minMovement) {
            this.state.isSwiping = true;
        }
    }

    handleTouchEnd(e) {
        const deltaX = this.state.endX - this.state.startX;
        const deltaY = this.state.endY - this.state.startY;
        const swipeThresholdHorizontal = 50;
        const swipeThresholdVertical = 50;
        const minMovement = 10;

        if (Math.abs(deltaX) < minMovement && Math.abs(deltaY) < minMovement) {
            return;
        }

        if (!this.state.userId) {
            this.showNotification('Log in to react');
            return;
        }

        console.log('Swipe: deltaX=', deltaX, 'deltaY=', deltaY);
        if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) this.playNextVideo();
            else this.playPreviousVideo();
            if (this.state.isProgressBarActivated) this.progressBar.classList.remove('visible');
            this.state.isProgressBarActivated = false;
        } else if (Math.abs(deltaY) > swipeThresholdVertical && Math.abs(deltaY) > Math.abs(deltaX)) {
            if (deltaY < 0) {
                this.handleReaction('like');
                this.showFloatingReaction('like', this.state.endX, this.state.startY);
            } else if (deltaY > 0) {
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
        this.state.isSwiping = false;
        if (!this.state.isHolding) {
            this.toggleVideoPlayback();
        }
    }

    handleMouseMove(e) {
        if (!this.state.isDragging) return;
        this.state.endX = e.clientX;
        this.state.endY = e.clientY;
        const deltaX = this.state.endX - this.state.startX;
        const deltaY = this.state.endY - this.state.startY;
        const minMovement = 10;
        if (Math.abs(deltaX) > minMovement || Math.abs(deltaY) > minMovement) {
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
        const minMovement = 10;

        if (Math.abs(deltaX) < minMovement && Math.abs(deltaY) < minMovement) {
            return;
        }

        if (!this.state.userId) {
            this.showNotification('Log in to react');
            return;
        }

        console.log('Mouse swipe: deltaX=', deltaX, 'deltaY=', deltaY);
        if (Math.abs(deltaX) > swipeThresholdHorizontal && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) this.playNextVideo();
            else this.playPreviousVideo();
            if (this.state.isProgressBarActivated) this.progressBar.classList.remove('visible');
            this.state.isProgressBarActivated = false;
        } else if (Math.abs(deltaY) > swipeThresholdVertical && Math.abs(deltaY) > Math.abs(deltaX)) {
            if (deltaY < 0) {
                this.handleReaction('like');
                this.showFloatingReaction('like', this.state.endX, this.state.startY);
            } else if (deltaY > 0) {
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot go to next video');
            return;
        }
        this.recommendNextVideo();
        this.loadVideo('left');
        this.state.hasViewed = false;
        this.state.isUserInitiated = false;
    }

    playPreviousVideo() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot go to previous video');
            return;
        }
        this.state.currentIndex = (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length;
        this.loadVideo('right');
        this.state.hasViewed = false;
        this.state.isUserInitiated = false;
    }

    loadVideo(direction = 'left') {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot load video');
            this.showNotification('No videos to play!');
            return;
        }

        if (this.state.currentIndex < 0 || this.state.currentIndex >= this.state.playlist.length) {
            console.warn('Invalid index, resetting to 0');
            this.state.currentIndex = 0;
        }

        const fadeOutClass = direction === 'left' ? 'fade-out-left' : 'fade-out-right';
        this.video.classList.remove('fade-in');
        this.video.classList.add(fadeOutClass);
        this.video.pause();
        setTimeout(() => {
            this.videoSource.src = this.state.playlist[this.state.currentIndex].url;
            this.videoSource.setAttribute('cache-control', 'no-cache');
            this.video.load();
            const timeout = setTimeout(() => {
                if (!this.video.readyState) {
                    this.showNotification('Video load error!');
                    this.playNextVideo();
                }
            }, 5000);
            this.video.addEventListener('canplay', () => {
                clearTimeout(timeout);
                const lastPosition = this.state.playlist[this.state.currentIndex].data.lastPosition;
                this.video.classList.remove('fade-out-left', 'fade-out-right');
                this.video.classList.add('fade-in');
                if (lastPosition > 0 && lastPosition < this.video.duration) {
                    this.video.currentTime = lastPosition;
                }
                if (this.state.isUserInitiated) {
                    this.video.play().catch(err => {
                        console.error('Play error:', err.message, err.stack);
                        this.showNotification(`Failed to play video: ${err.message}. Click the video to play.`);
                    });
                } else {
                    this.showNotification('Click the video to start playback.');
                }
            }, { once: true });
            this.updateCounters();
            this.updateComments();
            this.updateRating();
            this.updateDescription();
            this.preloadNextVideo();
        }, 300);
    }

    async addComment() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot add comment');
            return;
        }
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
            this.commentInput.placeholder = 'Write a comment...';
            this.updateComments();
            this.updateCounters();
            await this.updateVideoCache(this.state.currentIndex);
        }
    }

    updateComments() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot update comments');
            return;
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        this.commentsList.innerHTML = '';
        videoData.comments.forEach((comment, idx) => {
            const userPhoto = (this.tg?.initDataUnsafe?.user?.id === comment.userId && this.tg?.initDataUnsafe?.user?.photo_url)
                ? this.tg.initDataUnsafe.user.photo_url
                : '/images/default-avatar.png';
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
                    <div class="comment-text">${this.sanitize(comment.text)}${comment.replyTo !== null && videoData.comments[comment.replyTo] ? `<blockquote>Quote: ${this.sanitize(videoData.comments[comment.replyTo].text)}</blockquote>` : ''}</div>
                </div>
                <button class="reply-btn" data-index="${idx}">Reply</button>
                ${isOwnComment ? `<button class="delete-comment-btn" data-index="${idx}">Delete</button>` : ''}
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
        this.commentInput.placeholder = `Replying to: "${this.state.playlist[this.state.currentIndex].data.comments[index].text.slice(0, 20)}..."`;
        this.commentInput.focus();
    }

    async deleteComment(index) {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot delete comment');
            return;
        }
        if (confirm('Delete this comment?')) {
            this.state.playlist[this.state.currentIndex].data.comments.splice(index, 1);
            this.updateComments();
            this.updateCounters();
            await this.updateVideoCache(this.state.currentIndex);
            this.showNotification('Comment deleted');
        }
    }

    async handleAvatarClick(userId) {
        console.log('Comment avatar click, userId:', userId);
        const channel = this.state.channels[userId];
        if (channel?.link) {
            console.log('Navigating to channel:', channel.link);
            try {
                if (this.tg && this.tg.openTelegramLink) {
                    this.tg.openTelegramLink(channel.link);
                } else {
                    window.open(channel.link, '_blank');
                }
            } catch (error) {
                console.error('Error navigating to channel:', error.message, error.stack);
                this.showNotification('Failed to open channel!');
            }
        } else {
            this.showNotification('Channel not registered');
        }
    }

    updateDescription() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot update description');
            return;
        }
        let descriptionEl = document.getElementById('videoDescriptionDisplay');
        if (!descriptionEl) {
            descriptionEl = document.createElement('div');
            descriptionEl.id = 'videoDescriptionDisplay';
            descriptionEl.style.cssText = 'margin-top: 10px; color: var(--text-color);';
            document.querySelector('.video-wrapper')?.insertAdjacentElement('afterend', descriptionEl);
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const description = videoData.description || 'No description';
        descriptionEl.innerHTML = this.sanitize(description);
        descriptionEl.style.display = description !== 'No description' ? 'block' : 'none';
    }

    updateChat() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot update chat');
            return;
        }
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot send chat message');
            return;
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const text = this.chatInput.value.trim();
        if (text) {
            videoData.chatMessages.push({ sender: this.state.userId, text });
            this.chatInput.value = '';
            this.updateChat();
            await this.updateVideoCache(this.state.currentIndex);
            setTimeout(() => {
                videoData.chatMessages.push({ sender: videoData.authorId, text: "Thanks for your message!" });
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot share');
            return;
        }
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        const description = this.state.playlist[this.state.currentIndex].data.description || 'Check out this cool video!';
        const text = `${description}\n${videoUrl}`;
        if (this.tg?.openTelegramLink) {
            this.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(description)}`);
        } else {
            navigator.clipboard.writeText(text)
                .then(() => this.showNotification('Link copied! Paste it in Telegram.'))
                .catch(err => this.showNotification('Failed to copy link'));
        }
        this.shareModal.classList.remove('visible');
        this.state.playlist[this.state.currentIndex].data.shares++;
        this.updateCounters();
        this.updateVideoCache(this.state.currentIndex);
    }

    copyVideoLink() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot copy link');
            return;
        }
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        navigator.clipboard.writeText(videoUrl)
            .then(() => {
                this.showNotification('Link copied!');
                this.shareModal.classList.remove('visible');
            })
            .catch(err => this.showNotification('Failed to copy link'));
    }

    async handleVideoUpload(e) {
        this.state.uploadedFile = e.target.files[0];
        if (!this.state.uploadedFile) {
            console.error('No file selected');
            this.showNotification('Select a video to upload!');
            return;
        }

        const maxSize = 100 * 1024 * 1024;
        const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

        console.log('Selected file:', this.state.uploadedFile.name, this.state.uploadedFile.size, this.state.uploadedFile.type);
        if (this.state.uploadedFile.size > maxSize) {
            this.showNotification('File too large! Max 100 MB.');
            this.state.uploadedFile = null;
            return;
        }

        if (!validTypes.includes(this.state.uploadedFile.type)) {
            this.showNotification('Unsupported format! Use MP4, MOV, or WebM.');
            this.state.uploadedFile = null;
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
            const videoData = this.state.playlist[this.state.currentIndex]?.data;
            if (videoData) {
                videoData.duration = this.uploadPreview.duration;
                this.updateVideoCache(this.state.currentIndex);
            }
            this.uploadPreview.onloadedmetadata = null;
        };
    }

    async publishVideo() {
        if (!this.state.uploadedFile) {
            console.error('No file to upload');
            this.showNotification('Select a video to upload!');
            return;
        }

        const file = this.state.uploadedFile;
        const description = document.getElementById('videoDescription')?.value || '';
        console.log('Uploading file:', file.name, file.type, file.size);
        console.log('userId:', this.state.userId, 'Description:', description);

        const formData = new FormData();
        formData.append('video', file);
        formData.append('userId', this.state.userId);
        formData.append('description', description);

        try {
            const response = await this.retryFetch(`${SERVER_URL}/api/upload-video`, { method: 'POST', body: formData });
            console.log('Response /api/upload-video:', response.status);
            if (!response.ok) throw new Error(`Video upload error: ${response.status}`);
            const { video } = await response.json();
            console.log('Received URL:', video.url);

            this.showNotification('Video successfully published!');
            this.uploadModal.classList.remove('visible');
            this.state.uploadedFile = null;
            if (this.uploadPreview.src) {
                URL.revokeObjectURL(this.uploadPreview.src);
                this.uploadPreview.src = '';
                this.uploadPreview.style.display = 'none';
            }

            const newVideoData = this.createEmptyVideoData(this.state.userId);
            newVideoData.description = description;
            this.state.playlist.unshift({ url: video.url, data: newVideoData });
            this.state.currentIndex = 0;
            this.loadVideo();
            this.addVideoToManagementList(video.url, description);
        } catch (error) {
            console.error('Error publishing video:', error.message, error.stack);
            this.showNotification(`Error: ${error.message}${this.tg ? '. Try again.' : ''}`);
        }
    }

    cancelUpload() {
        if (this.state.uploadedFileUrl) {
            URL.revokeObjectURL(this.state.uploadedFileUrl);
        }
        this.state.uploadedFileUrl = null;
        this.state.uploadedFile = null;
        this.uploadModal.classList.remove('visible');
        this.uploadPreview.src = '';
        this.uploadPreview.style.display = 'none';
    }

    addVideoToManagementList(url, description) {
        const managementList = document.getElementById('videoManagementList') || this.createManagementList();
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.innerHTML = `
            <span>${description || 'No description'}</span>
            <button class="edit-btn" data-url="${url}">Edit</button>
            <button class="delete-btn" data-url="${url}">Delete</button>
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
        const newDescription = prompt('Enter new description:', this.state.playlist[index].data.description);
        if (newDescription !== null) {
            this.state.playlist[index].data.description = newDescription;
            this.updateVideoCache(index);
            const videoItem = document.querySelector(`.video-item [data-url="${url}"]`).parentElement;
            videoItem.querySelector('span').textContent = newDescription || 'No description';
            this.showNotification('Description updated!');
            if (this.state.currentIndex === index) this.updateDescription();
        }
    }

    async deleteVideo(url) {
        try {
            const response = await this.retryFetch(`${SERVER_URL}/api/delete-video`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            console.log('Response /api/delete-video:', response.status);
            if (!response.ok) throw new Error(`Video deletion error: ${response.status}`);
            this.showNotification('Video successfully deleted!');
            const index = this.state.playlist.findIndex(v => v.url === url);
            if (index !== -1) {
                this.state.playlist.splice(index, 1);
                const videoItem = document.querySelector(`.video-item [data-url="${url}"]`);
                if (videoItem) videoItem.parentElement.remove();
                if (this.state.currentIndex === index) {
                    this.state.currentIndex = Math.min(this.state.currentIndex, this.state.playlist.length - 1);
                    this.loadVideo();
                }
            }
        } catch (error) {
            console.error('Error deleting video:', error.message, error.stack);
            this.showNotification(`Error: ${error.message}${this.tg ? '. Try again.' : ''}`);
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot update counters');
            return;
        }
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
        const rawScore = (videoData.likes * 5.0) + (videoData.comments.length * 10.0) + (videoData.shares * 15.0) + 
                        (videoData.viewTime * 0.1) + (videoData.replays * 20.0);
        const maxPossibleScore = 50;
        return Math.max(0, Math.min(5, (rawScore / maxPossibleScore) * 5));
    }

    updateRating() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot update rating');
            return;
        }
        const videoData = this.state.playlist[this.state.currentIndex].data;
        const duration = videoData.duration || 300;
        const score = this.calculateVideoScore(videoData, duration);
        const fullStars = Math.floor(score);
        const halfStar = score % 1 >= 0.5 ? 1 : 0;
        const emptyStars = Math.max(0, 5 - fullStars - halfStar);
        if (this.ratingEl) this.ratingEl.innerHTML = '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    recommendNextVideo() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot recommend');
            this.state.currentIndex = 0;
            return;
        }

        const scores = this.state.playlist.map((video, index) => ({
            index,
            score: this.calculateVideoScore(video.data, video.data.duration || 300)
        }));

        if (scores.length === 0) {
            console.warn('No videos for recommendation, resetting index');
            this.state.currentIndex = 0;
            return;
        }

        scores.sort((a, b) => b.score - a.score);
        const nextVideo = scores.find(item => item.index !== this.state.currentIndex) || scores[0];
        this.state.currentIndex = nextVideo.index;
    }

    preloadNextVideo() {
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot preload');
            return;
        }
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
        if (!this.state.playlist || this.state.playlist.length === 0 || index < 0 || index >= this.state.playlist.length) {
            console.error('Playlist empty or invalid index, cannot cache');
            return;
        }
        const videoData = this.state.playlist[index].data;
        const url = this.state.playlist[index].url;

        const maxComments = 100;
        const maxMessages = 50;
        const trimmedComments = videoData.comments.slice(-maxComments);
        const trimmedChatMessages = videoData.chatMessages.slice(-maxMessages);

        const cacheData = {
            url,
            views: Array.from(videoData.views),
            likes: videoData.likes,
            dislikes: videoData.dislikes,
            comments: trimmedComments,
            shares: videoData.shares,
            view_time: videoData.viewTime,
            replays: videoData.replays,
            last_position: videoData.lastPosition,
            chat_messages: trimmedChatMessages
        };
        localStorage.setItem(`videoData_${url}`, JSON.stringify(cacheData));

        if (!this.updateVideoCache.debounceTimer) {
            this.updateVideoCache.debounceTimer = setTimeout(async () => {
                try {
                    const response = await this.retryFetch(`${SERVER_URL}/api/update-video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cacheData)
                    });
                    console.log('Response /api/update-video:', response.status);
                    if (!response.ok) throw new Error(`Data update error: ${response.status}`);
                    console.log('Data saved to server');
                } catch (error) {
                    console.error('Error updating data:', error.message, error.stack);
                    this.showNotification(`Failed to save data: ${error.message}${this.tg ? '. Try again.' : ''}`);
                } finally {
                    this.updateVideoCache.debounceTimer = null;
                }
            }, 5000);
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
        console.log('Notification:', message);
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
        this.state.isUserInitiated = true;
        if (this.video.paused) {
            this.video.play().catch(err => {
                console.error('Play error:', err.message, err.stack);
                this.showNotification(`Failed to play video: ${err.message}. Click the video to play.`);
            });
        } else {
            this.video.pause();
        }
    }

    handleReaction(type, e) {
        if (e) e.stopPropagation();
        if (!this.state.userId) {
            this.showNotification('Log in to react');
            return;
        }
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot handle reaction');
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
        if (!this.reactionAnimation) return;
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
        if (!this.state.playlist || this.state.playlist.length === 0) {
            console.error('Playlist empty, cannot download');
            this.showNotification('No video to download!');
            return;
        }
        const videoUrl = this.state.playlist[this.state.currentIndex].url;
        if (!videoUrl) {
            console.error('Video URL missing');
            this.showNotification('No video to download!');
            return;
        }

        console.log('Attempting to download video:', videoUrl);
        this.uploadBtn.classList.add('downloading');
        this.uploadBtn.style.setProperty('--progress', '0%');

        try {
            const response = await this.retryFetch(`${SERVER_URL}/api/download-video?url=${encodeURIComponent(videoUrl)}`, { method: 'GET' });
            console.log('Response status:', response.status, response.statusText);
            if (!response.ok) throw new Error(`Download error: ${response.status} ${response.statusText}`);

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
                console.log('Progress:', progress);
                this.uploadBtn.style.setProperty('--progress', `${progress}%`);
            }

            const contentType = response.headers.get('content-type') || 'video/mp4';
            if (!contentType.startsWith('video/')) {
                throw new Error('Received invalid content type: ' + contentType);
            }

            const blob = new Blob(chunks, { type: contentType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('Video successfully downloaded!');
        } catch (err) {
            console.error('Download error:', err.message, err.stack);
            this.showNotification(`Failed to download video: ${err.message}${this.tg ? '. Try again.' : ''}`);
        } finally {
            this.uploadBtn.classList.remove('downloading');
            this.uploadBtn.style.setProperty('--progress', '0%');
        }
    }

    simulateProgress(loaded) {
        return Math.min(100, (loaded / (1024 * 1024)) * 10);
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

        if (this.tg && this.tg.requestFullscreen) {
            this.tg.requestFullscreen()
                .then(() => {
                    document.body.classList.add('telegram-fullscreen');
                    this.showNotification('Fullscreen mode enabled');
                })
                .catch((err) => {
                    console.error('Telegram fullscreen error:', err.message, err.stack);
                    this.tg.expand();
                    this.showNotification('Fullscreen mode unavailable, using expand');
                });
        } else {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen()
                    .then(() => {
                        document.body.classList.add('fullscreen-mode');
                        this.showNotification('Fullscreen mode enabled');
                    })
                    .catch(err => {
                        console.error('Fullscreen error:', err.message, err.stack);
                        this.showNotification('Failed to enable fullscreen mode');
                    });
            } else {
                document.exitFullscreen()
                    .then(() => {
                        document.body.classList.remove('fullscreen-mode');
                        this.showNotification('Fullscreen mode disabled');
                    })
                    .catch(err => {
                        console.error('Exit fullscreen error:', err.message, err.stack);
                        this.showNotification('Failed to exit fullscreen mode');
                    });
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const videoManager = new VideoManager();
    videoManager.init();
});
