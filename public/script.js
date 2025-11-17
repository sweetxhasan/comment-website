class CommentApp {
    constructor() {
        this.comments = [];
        this.init();
    }

    async init() {
        await this.loadComments();
        this.setupEventListeners();
        this.startRealTimeUpdates();
    }

    async loadComments() {
        try {
            const response = await fetch('/api/comments');
            this.comments = await response.json();
            this.renderComments();
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Error loading comments:', error);
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
    }

    async postComment() {
        const nameInput = document.getElementById('name');
        const commentInput = document.getElementById('comment');

        const commentData = {
            name: nameInput.value,
            comment: commentInput.value
        };

        try {
            const response = await fetch('/api/comments', {
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
                await this.loadComments(); // Reload comments
            } else {
                alert('Error posting comment: ' + result.error);
            }
        } catch (error) {
            console.error('Error posting comment:', error);
            alert('Error posting comment');
        }
    }

    async postReply() {
        const parentId = document.getElementById('replyParentId').value;
        const nameInput = document.getElementById('replyName');
        const commentInput = document.getElementById('replyComment');

        const replyData = {
            name: nameInput.value,
            comment: commentInput.value,
            parentId: parentId
        };

        try {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(replyData)
            });

            const result = await response.json();

            if (result.success) {
                this.closeReplyModal();
                await this.loadComments(); // Reload comments
            } else {
                alert('Error posting reply: ' + result.error);
            }
        } catch (error) {
            console.error('Error posting reply:', error);
            alert('Error posting reply');
        }
    }

    async handleReaction(commentId, type) {
        try {
            const response = await fetch(`/api/comments/${commentId}/reaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type })
            });

            const result = await response.json();

            if (result.success) {
                await this.loadComments(); // Reload to get updated counts
            }
        } catch (error) {
            console.error('Error updating reaction:', error);
        }
    }

    openReplyModal(parentId) {
        document.getElementById('replyParentId').value = parentId;
        document.getElementById('replyModal').classList.remove('hidden');
        document.getElementById('replyModal').classList.add('flex');
    }

    closeReplyModal() {
        document.getElementById('replyModal').classList.add('hidden');
        document.getElementById('replyModal').classList.remove('flex');
        document.getElementById('replyName').value = '';
        document.getElementById('replyComment').value = '';
    }

    renderComments() {
        const container = document.getElementById('commentsContainer');
        container.innerHTML = '';

        if (this.comments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="ri-chat-3-line text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">No comments yet. Be the first to comment!</p>
                </div>
            `;
            return;
        }

        this.comments.forEach(comment => {
            container.appendChild(this.createCommentElement(comment));
        });
    }

    createCommentElement(comment, isReply = false) {
        const commentDiv = document.createElement('div');
        commentDiv.className = isReply ? 'ml-8 mt-4' : 'bg-white p-6 shadow-lg';

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
                    
                    <div class="flex items-center space-x-4">
                        <button onclick="app.handleReaction('${comment.id}', 'like')" 
                                class="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors">
                            <i class="ri-thumb-up-line"></i>
                            <span>${comment.likes}</span>
                        </button>
                        <button onclick="app.handleReaction('${comment.id}', 'dislike')" 
                                class="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors">
                            <i class="ri-thumb-down-line"></i>
                            <span>${comment.dislikes}</span>
                        </button>
                        <button onclick="app.openReplyModal('${comment.id}')" 
                                class="flex items-center space-x-1 text-gray-600 hover:text-green-600 transition-colors">
                            <i class="ri-reply-line"></i>
                            <span>Reply</span>
                        </button>
                    </div>

                    ${comment.replies && comment.replies.length > 0 ? `
                        <div class="mt-4 space-y-4 border-l-2 border-gray-200 pl-4">
                            ${comment.replies.map(reply => this.createCommentElement(reply, true).outerHTML).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        return commentDiv;
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
        // Simple polling for real-time updates
        setInterval(async () => {
            await this.loadComments();
        }, 5000); // Update every 5 seconds
    }
}

// Global functions for modal
function closeReplyModal() {
    app.closeReplyModal();
}

// Initialize app
const app = new CommentApp();
