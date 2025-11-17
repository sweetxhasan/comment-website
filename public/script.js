class CommentApp {
    constructor() {
        this.comments = [];
        this.baseUrl = window.location.origin;
        this.init();
    }

    async init() {
        await this.loadComments();
        this.setupEventListeners();
        this.startRealTimeUpdates();
    }

    async loadComments() {
        try {
            const response = await fetch(`${this.baseUrl}/api/comments`);
            if (!response.ok) throw new Error('Failed to fetch comments');
            
            this.comments = await response.json();
            this.renderComments();
            
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Error loading comments:', error);
            document.getElementById('loading').innerHTML = `
                <div class="text-center text-red-600">
                    <i class="ri-error-warning-line text-4xl mb-2"></i>
                    <p>Failed to load comments. Please refresh the page.</p>
                </div>
            `;
        }
    }

    setupEventListeners() {
        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.postComment();
        });

        document.getElementById('replyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.postReply();
        });

        // Close modal when clicking outside
        document.getElementById('replyModal').addEventListener('click', (e) => {
            if (e.target.id === 'replyModal') {
                this.closeReplyModal();
            }
        });
    }

    async postComment() {
        const nameInput = document.getElementById('name');
        const commentInput = document.getElementById('comment');
        const submitBtn = document.querySelector('#commentForm button[type="submit"]');

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin mr-2"></i>Posting...';
        submitBtn.disabled = true;

        const commentData = {
            name: nameInput.value,
            comment: commentInput.value
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commentData)
            });

            const result = await response.json();

            if (result.success) {
                nameInput.value = '';
                commentInput.value = '';
                await this.loadComments();
                this.showNotification('Comment posted successfully!', 'success');
            } else {
                this.showNotification('Error: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error posting comment:', error);
            this.showNotification('Failed to post comment. Please try again.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async postReply() {
        const parentId = document.getElementById('replyParentId').value;
        const nameInput = document.getElementById('replyName');
        const commentInput = document.getElementById('replyComment');
        const submitBtn = document.querySelector('#replyForm button[type="submit"]');

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin mr-2"></i>Posting...';
        submitBtn.disabled = true;

        const replyData = {
            name: nameInput.value,
            comment: commentInput.value,
            parentId: parentId
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(replyData)
            });

            const result = await response.json();

            if (result.success) {
                this.closeReplyModal();
                await this.loadComments();
                this.showNotification('Reply posted successfully!', 'success');
            } else {
                this.showNotification('Error: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error posting reply:', error);
            this.showNotification('Failed to post reply. Please try again.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
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
                await this.loadComments();
            } else {
                this.showNotification('Failed to update reaction', 'error');
            }
        } catch (error) {
            console.error('Error updating reaction:', error);
            this.showNotification('Failed to update reaction', 'error');
        }
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
        const loading = document.getElementById('loading');

        loading.style.display = 'none';

        if (this.comments.length === 0) {
            container.innerHTML = '';
            noComments.classList.remove('hidden');
            return;
        }

        noComments.classList.add('hidden');
        container.innerHTML = '';

        this.comments.forEach(comment => {
            container.appendChild(this.createCommentElement(comment));
        });
    }

    createCommentElement(comment, isReply = false) {
        const commentDiv = document.createElement('div');
        commentDiv.className = isReply ? 'ml-8 mt-4' : 'bg-white p-6 shadow-lg border border-gray-200';

        const time = new Date(comment.timestamp).toLocaleString();

        commentDiv.innerHTML = `
            <div class="flex space-x-4">
                <img src="${comment.avatar}" alt="${comment.name}" class="w-12 h-12">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <h4 class="font-semibold text-gray-900">${this.escapeHtml(comment.name)}</h4>
                            <p class="text-gray-500 text-sm">${time}</p>
                        </div>
                    </div>
                    <p class="text-gray-700 mb-4">${this.escapeHtml(comment.comment)}</p>
                    
                    <div class="flex items-center space-x-6">
                        <button onclick="app.handleReaction('${comment.id}', 'like')" 
                                class="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-200">
                            <i class="ri-thumb-up-line ${comment.likes > 0 ? 'text-blue-600' : ''}"></i>
                            <span>${comment.likes}</span>
                        </button>
                        <button onclick="app.handleReaction('${comment.id}', 'dislike')" 
                                class="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200">
                            <i class="ri-thumb-down-line ${comment.dislikes > 0 ? 'text-red-600' : ''}"></i>
                            <span>${comment.dislikes}</span>
                        </button>
                        <button onclick="app.openReplyModal('${comment.id}')" 
                                class="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors duration-200">
                            <i class="ri-reply-line"></i>
                            <span>Reply</span>
                        </button>
                    </div>

                    ${comment.replies && comment.replies.length > 0 ? `
                        <div class="mt-6 space-y-4 border-l-2 border-gray-200 pl-4">
                            ${comment.replies.map(reply => this.createCommentElement(reply, true).outerHTML).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        return commentDiv;
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existingNotification = document.getElementById('notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = `fixed top-4 right-4 p-4 text-white font-semibold shadow-lg border-0 transform transition-transform duration-300 ${
            type === 'success' ? 'gradient-success' : 
            type === 'error' ? 'gradient-danger' : 'gradient-primary'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('translate-x-0');
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                notification.remove();
            }, 300);
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

    startRealTimeUpdates() {
        // Real-time updates every 5 seconds
        setInterval(async () => {
            await this.loadComments();
        }, 5000);
    }
}

// Global functions for modal
function closeReplyModal() {
    app.closeReplyModal();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CommentApp();
});
