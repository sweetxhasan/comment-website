class CommentApp {
    constructor() {
        this.comments = [];
        this.baseUrl = window.location.origin;
        this.isLoading = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadComments();
        this.startRealTimeUpdates();
        this.updateStats();
    }

    async loadComments() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.baseUrl}/api/comments`);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            const loadTime = Date.now() - startTime;
            
            if (result.success) {
                this.comments = result.data || [];
                this.renderComments();
                console.log(`✅ Comments loaded from JSONBin.io in ${loadTime}ms`);
                
                // Update database status
                document.getElementById('databaseStatus').textContent = '🟢 JSONBin.io Connected';
                document.getElementById('databaseStatus').className = 'text-green-600';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error loading comments:', error);
            this.showError('Failed to load comments. Please refresh the page.');
            
            // Update database status
            document.getElementById('databaseStatus').textContent = '🔴 JSONBin.io Offline';
            document.getElementById('databaseStatus').className = 'text-red-600';
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    setupEventListeners() {
        // Comment form
        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.postComment();
        });

        // Reply form
        document.getElementById('replyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.postReply();
        });

        // Character count
        document.getElementById('comment').addEventListener('input', (e) => {
            document.getElementById('charCount').textContent = e.target.value.length;
        });

        // Close modal when clicking outside
        document.getElementById('replyModal').addEventListener('click', (e) => {
            if (e.target.id === 'replyModal') {
                this.closeReplyModal();
            }
        });

        // Enter key to submit
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                if (document.getElementById('replyModal').classList.contains('flex')) {
                    document.getElementById('replyForm').requestSubmit();
                } else {
                    document.getElementById('commentForm').requestSubmit();
                }
            }
        });
    }

    async postComment() {
        const nameInput = document.getElementById('name');
        const commentInput = document.getElementById('comment');
        const submitBtn = document.getElementById('submitBtn');

        const name = nameInput.value.trim();
        const comment = commentInput.value.trim();

        if (!name || !comment) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const originalText = submitBtn.innerHTML;
        this.setButtonLoading(submitBtn, 'Posting...');

        try {
            const startTime = Date.now();
            const response = await fetch(`${this.baseUrl}/api/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, comment })
            });

            const result = await response.json();
            const responseTime = Date.now() - startTime;

            if (result.success) {
                nameInput.value = '';
                commentInput.value = '';
                document.getElementById('charCount').textContent = '0';
                
                await this.loadComments(); // Reload comments instantly
                this.showNotification(result.message || 'Comment posted successfully!', 'success');
                console.log(`✅ Comment saved to JSONBin.io in ${responseTime}ms`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error posting comment:', error);
            this.showNotification('Failed to post comment: ' + error.message, 'error');
        } finally {
            this.setButtonNormal(submitBtn, originalText);
        }
    }

    async postReply() {
        const parentId = document.getElementById('replyParentId').value;
        const nameInput = document.getElementById('replyName');
        const commentInput = document.getElementById('replyComment');
        const submitBtn = document.getElementById('replySubmitBtn');

        const name = nameInput.value.trim();
        const comment = commentInput.value.trim();

        if (!name || !comment) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const originalText = submitBtn.innerHTML;
        this.setButtonLoading(submitBtn, 'Posting...');

        try {
            const response = await fetch(`${this.baseUrl}/api/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, comment, parentId })
            });

            const result = await response.json();

            if (result.success) {
                this.closeReplyModal();
                await this.loadComments(); // Reload comments instantly
                this.showNotification(result.message || 'Reply posted successfully!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error posting reply:', error);
            this.showNotification('Failed to post reply: ' + error.message, 'error');
        } finally {
            this.setButtonNormal(submitBtn, originalText);
        }
    }

    async handleReaction(commentId, type) {
        try {
            const response = await fetch(`${this.baseUrl}/api/comments/${commentId}/reaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type })
            });

            const result = await response.json();

            if (result.success) {
                // Update instantly without full reload
                const comment = this.findCommentById(commentId);
                if (comment) {
                    if (type === 'like') {
                        comment.likes++;
                    } else {
                        comment.dislikes++;
                    }
                    this.renderComments();
                }
                this.showNotification('Reaction updated!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error updating reaction:', error);
            this.showNotification('Failed to update reaction', 'error');
        }
    }

    findCommentById(id, comments = this.comments) {
        for (let comment of comments) {
            if (comment.id === id) return comment;
            if (comment.replies && comment.replies.length > 0) {
                const found = this.findCommentById(id, comment.replies);
                if (found) return found;
            }
        }
        return null;
    }

    openReplyModal(parentId) {
        document.getElementById('replyParentId').value = parentId;
        document.getElementById('replyModal').classList.remove('hidden');
        document.getElementById('replyModal').classList.add('flex');
        document.getElementById('replyName').focus();
    }

    closeReplyModal() {
        document.getElementById('replyModal').classList.add('hidden');
        document.getElementById('replyModal').classList.remove('flex');
        document.getElementById('replyName').value = '';
        document.getElementById('replyComment').value = '';
    }

    renderComments() {
        const container = document.getElementById('commentsContainer');
        const noComments = document.getElementById('noComments');

        if (this.comments.length === 0) {
            container.innerHTML = '';
            noComments.classList.remove('hidden');
            return;
        }

        noComments.classList.add('hidden');
        
        // Sort comments by timestamp (newest first)
        const sortedComments = [...this.comments].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        container.innerHTML = sortedComments.map(comment => 
            this.createCommentElement(comment)
        ).join('');
    }

    createCommentElement(comment, isReply = false) {
        const time = new Date(comment.timestamp).toLocaleString();
        const repliesCount = comment.replies ? comment.replies.length : 0;

        return `
            <div class="bg-white p-5 shadow-lg border border-gray-200 fade-in ${isReply ? 'ml-8 mt-4' : ''}">
                <div class="flex space-x-4">
                    <img src="${comment.avatar}" alt="${comment.name}" 
                         class="w-12 h-12 flex-shrink-0" 
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(comment.name)}&background=667eea&color=fff&size=64'">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                            <div class="flex items-center space-x-2 mb-2 sm:mb-0">
                                <h4 class="font-semibold text-gray-900 text-lg">${this.escapeHtml(comment.name)}</h4>
                                <span class="text-xs gradient-primary text-white px-2 py-1">User</span>
                            </div>
                            <span class="text-gray-500 text-sm">${time}</span>
                        </div>
                        
                        <p class="text-gray-700 mb-4 text-base leading-relaxed">${this.escapeHtml(comment.comment)}</p>
                        
                        <div class="flex items-center space-x-6">
                            <button onclick="app.handleReaction('${comment.id}', 'like')" 
                                    class="flex items-center space-x-2 transition-all duration-200 group">
                                <i class="ri-thumb-up-line text-gray-600 group-hover:text-blue-600 ${comment.likes > 0 ? 'text-blue-600' : ''}"></i>
                                <span class="text-gray-700 font-medium">${comment.likes}</span>
                            </button>
                            <button onclick="app.handleReaction('${comment.id}', 'dislike')" 
                                    class="flex items-center space-x-2 transition-all duration-200 group">
                                <i class="ri-thumb-down-line text-gray-600 group-hover:text-red-600 ${comment.dislikes > 0 ? 'text-red-600' : ''}"></i>
                                <span class="text-gray-700 font-medium">${comment.dislikes}</span>
                            </button>
                            <button onclick="app.openReplyModal('${comment.id}')" 
                                    class="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-all duration-200">
                                <i class="ri-reply-line"></i>
                                <span>Reply</span>
                            </button>
                            ${repliesCount > 0 ? `
                                <span class="text-gray-500 text-sm">
                                    <i class="ri-chat-3-line mr-1"></i>${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}
                                </span>
                            ` : ''}
                        </div>

                        ${comment.replies && comment.replies.length > 0 ? `
                            <div class="mt-6 space-y-4 border-l-2 border-blue-200 pl-4">
                                ${comment.replies.map(reply => this.createCommentElement(reply, true)).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('noComments').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const container = document.getElementById('commentsContainer');
        container.innerHTML = `
            <div class="text-center py-8 fade-in">
                <i class="ri-error-warning-line text-4xl text-red-500 mb-3"></i>
                <p class="text-red-600 font-semibold mb-2">${message}</p>
                <button onclick="app.loadComments()" class="gradient-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-all duration-200">
                    <i class="ri-refresh-line mr-1"></i>Try Again
                </button>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existingNotification = document.getElementById('notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = `fixed top-4 right-4 p-4 text-white font-semibold shadow-lg border-0 transform transition-transform duration-300 translate-x-full z-50 ${
            type === 'success' ? 'gradient-success' : 
            type === 'error' ? 'gradient-danger' : 
            type === 'warning' ? 'gradient-warning' : 'gradient-primary'
        }`;
        notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="ri-${type === 'success' ? 'check-line' : type === 'error' ? 'error-warning-line' : 'information-line'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    setButtonLoading(button, text) {
        button.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2"></i>${text}`;
        button.disabled = true;
    }

    setButtonNormal(button, html) {
        button.innerHTML = html;
        button.disabled = false;
    }

    async updateStats() {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats`);
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('totalComments').textContent = 
                    `${result.stats.totalComments} comments • ${result.stats.database}`;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    startRealTimeUpdates() {
        // Real-time updates every 3 seconds
        setInterval(async () => {
            await this.loadComments();
            await this.updateStats();
        }, 3000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Global functions
function closeReplyModal() {
    app.closeReplyModal();
}

function loadComments() {
    app.loadComments();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CommentApp();
});
