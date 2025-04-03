const supabaseUrl = 'https://seckthcbnslsropswpik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2t0aGNibnNsc3JvcHN3cGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNzU3ODMsImV4cCI6MjA1ODc1MTc4M30.JoI03vFuRd-7sApD4dZ-zeBfUQlZrzRg7jtz0HgnJyI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

class VideoManager {
    constructor() {
        this.videoPlaylist = [];
        this.videoDataStore = [];
        this.currentVideoIndex = 0;
        this.userId = null;
        this.tg = window.Telegram?.WebApp;
        this.channels = JSON.parse(localStorage.getItem('channels')) || {};
    }

    async init() {
        if (this.tg) {
            this.tg.ready();
            this.userId = this.tg.initDataUnsafe?.user?.id ? String(this.tg.initDataUnsafe.user.id) : 'testUser_' + Date.now();
        } else {
            this.userId = 'testUser_' + Date.now();
        }
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
        this.video = document.getElementById('videoPlayer');
        this.videoSource = document.getElementById('videoSource');
        this.ratingEl = document.getElementById('rating');
        this.viewCountEl = document.getElementById('viewCount');
        this.reactionBar = document.getElementById('reactionBar');
        this.reactionButtons = document.querySelectorAll('.reaction-btn');
        this.swipeArea = document.getElementById('swipeArea');
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
        document.body.appendChild(this.videoUpload);
    }

    bindEvents() {
        this.authBtn.addEventListener('click', () => this.handleAuth());
        this.registerChannelBtn.addEventListener('click', () => this.registerChannel());
        this.reactionButtons.forEach(btn => btn.addEventListener('click', (e) => this.handleReaction(btn.dataset.type, e)));
        this.swipeArea.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.swipeArea.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.swipeArea.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.video.addEventListener('play', () => this.handlePlay());
        this.video.addEventListener('pause', () => this.handlePause());
        this.video.addEventListener('ended', () => this.handleEnded());
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.progressRange.addEventListener('input', (e) => this.video.currentTime = e.target.value);
        this.sendCommentBtn.addEventListener('click', () => this.addComment());
        this.plusBtn.addEventListener('click', () => this.toggleSubmenu());
        this.uploadBtn.addEventListener('click', () => this.downloadCurrentVideo());
        this.submenuUpload.addEventListener('click', () => this.videoUpload.click());
        this.submenuChat.addEventListener('click', () => this.chatModal.classList.add('visible'));
        this.videoUpload.addEventListener('change', (e) => this.handleVideoUpload(e));
        this.publishBtn.addEventListener('click', () => this.publishVideo());
        this.cancelBtn.addEventListener('click', () => this.uploadModal.classList.remove('visible'));
        this.sendChatMessage.addEventListener('click', () => this.sendChat());
        this.closeChat.addEventListener('click', () => this.chatModal.classList.remove('visible'));
        this.shareTelegram.addEventListener('click', () => this.shareViaTelegram());
        this.copyLink.addEventListener('click', () => this.copyVideoLink());
        this.closeShare.addEventListener('click', () => this.shareModal.classList.remove('visible'));
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.toggleReactionBar.addEventListener('click', () => this.reactionBar.classList.toggle('visible'));
    }

    handleAuth() {
        this.showPlayer();
    }

    showPlayer() {
        this.authScreen.style.display = 'none';
        this.playerContainer.style.display = 'flex';
    }

    async registerChannel() {
        const channelLink = prompt('Введите ссылку на ваш Telegram-канал:');
        if (channelLink && channelLink.match(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/)) {
            this.channels[this.userId] = { link: channelLink, videos: [] };
            localStorage.setItem('channels', JSON.stringify(this.channels));
            await supabase.from('users').upsert({ telegram_id: this.userId, channel_link: channelLink });
            this.showNotification('Канал зарегистрирован!');
        } else {
            this.showNotification('Некорректная ссылка!');
        }
    }

    async loadInitialVideos() {
        const { data } = await supabase.from('publicVideos').select('*').limit(10);
        if (data?.length) {
            this.videoPlaylist = data.map(v => v.url);
            this.videoDataStore = data.map(v => ({
                views: new Set(v.views || []),
                likes: v.likes || 0,
                dislikes: v.dislikes || 0,
                comments: v.comments || [],
                shares: v.shares || 0,
                description: v.description || ''
            }));
        } else {
            this.videoPlaylist = ['https://www.w3schools.com/html/mov_bbb.mp4'];
            this.videoDataStore = [{ views: new Set(), likes: 0, dislikes: 0, comments: [], shares: 0, description: '' }];
        }
        this.loadVideo();
    }

    loadVideo() {
        this.videoSource.src = this.videoPlaylist[this.currentVideoIndex];
        this.video.load();
        this.video.play();
        this.updateCounters();
    }

    handlePlay() {
        this.progressBar.classList.remove('visible');
    }

    handlePause() {
        this.progressBar.classList.add('visible');
    }

    handleEnded() {
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
        this.loadVideo();
    }

    handleTimeUpdate() {
        this.progressRange.max = this.video.duration;
        this.progressRange.value = this.video.currentTime;
    }

    handleTouchStart(e) {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
        this.endX = e.touches[0].clientX;
        this.endY = e.touches[0].clientY;
    }

    handleTouchEnd() {
        const deltaX = this.endX - this.startX;
        const deltaY = this.endY - this.startY;
        if (Math.abs(deltaX) > 50) {
            if (deltaX > 0) this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
            else this.currentVideoIndex = (this.currentVideoIndex - 1 + this.videoPlaylist.length) % this.videoPlaylist.length;
            this.loadVideo();
        } else if (Math.abs(deltaY) > 50) {
            this.handleReaction(deltaY < 0 ? 'like' : 'dislike');
        }
    }

    handleReaction(type) {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        if (type === 'like') videoData.likes++;
        else if (type === 'dislike') videoData.dislikes++;
        else if (type === 'comment') this.commentsWindow.classList.toggle('visible');
        else if (type === 'share') this.shareModal.classList.add('visible');
        this.updateCounters();
    }

    async addComment() {
        const text = this.commentInput.value.trim();
        if (text) {
            this.videoDataStore[this.currentVideoIndex].comments.push({ userId: this.userId, text });
            this.commentInput.value = '';
            this.updateComments();
        }
    }

    updateComments() {
        this.commentsList.innerHTML = this.videoDataStore[this.currentVideoIndex].comments
            .map(c => `<div class="comment"><img src="https://placehold.co/30"><div class="comment-text">${c.text}</div></div>`).join('');
    }

    updateCounters() {
        const videoData = this.videoDataStore[this.currentVideoIndex];
        document.getElementById('likeCount').textContent = videoData.likes;
        document.getElementById('dislikeCount').textContent = videoData.dislikes;
        document.getElementById('commentCount').textContent = videoData.comments.length;
        document.getElementById('shareCount').textContent = videoData.shares;
        this.viewCountEl.textContent = videoData.views.size;
    }

    async handleVideoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.uploadModal.classList.add('visible');
            this.uploadPreview.src = URL.createObjectURL(file);
            this.uploadPreview.style.display = 'block';
            this.uploadedFile = file;
        }
    }

    async publishVideo() {
        const fileName = `${this.userId}/${Date.now()}_${this.uploadedFile.name}`;
        const { error } = await supabase.storage.from('videos').upload(fileName, this.uploadedFile);
        if (!error) {
            const url = `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
            const videoData = { url, author_id: this.userId, views: [], likes: 0, dislikes: 0, comments: [], shares: 0, description: document.getElementById('videoDescription').value };
            await supabase.from('publicVideos').insert(videoData);
            this.videoPlaylist.push(url);
            this.videoDataStore.push({ views: new Set(), likes: 0, dislikes: 0, comments: [], shares: 0, description: videoData.description });
            this.uploadModal.classList.remove('visible');
            this.loadVideo();
        }
    }

    async sendChat() {
        const text = this.chatInput.value.trim();
        if (text) {
            this.chatMessages.innerHTML += `<div class="message sent">${text}</div>`;
            this.chatInput.value = '';
        }
    }

    shareViaTelegram() {
        const url = this.videoPlaylist[this.currentVideoIndex];
        if (this.tg) this.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
        this.shareModal.classList.remove('visible');
    }

    copyVideoLink() {
        navigator.clipboard.writeText(this.videoPlaylist[this.currentVideoIndex]);
        this.shareModal.classList.remove('visible');
    }

    toggleTheme() {
        document.body.classList.toggle('dark');
        this.themeToggle.innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }

    toggleSubmenu() {
        this.submenuUpload.classList.toggle('active');
        this.submenuChat.classList.toggle('active');
    }

    async downloadCurrentVideo() {
        const url = this.videoPlaylist[this.currentVideoIndex];
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `video_${Date.now()}.mp4`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 10%; left: 50%; transform: translateX(-50%); background: var(--notification-bg); color: #fff; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new VideoManager().init());
