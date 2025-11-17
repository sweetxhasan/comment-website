const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'database');
const commentsFile = path.join(dbPath, 'comments.json');

// Ensure database directory exists
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath);
}

// Initialize comments file if not exists
if (!fs.existsSync(commentsFile)) {
    fs.writeFileSync(commentsFile, JSON.stringify([]));
}

// Helper functions
const readComments = () => {
    try {
        const data = fs.readFileSync(commentsFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeComments = (comments) => {
    try {
        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
        return true;
    } catch (error) {
        return false;
    }
};

// Generate avatar URL
const generateAvatar = (name) => {
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8', 'F7DC6F'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=64&bold=true&rounded=false`;
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all comments
app.get('/api/comments', (req, res) => {
    const comments = readComments();
    res.json(comments);
});

// Add new comment
app.post('/api/comments', (req, res) => {
    const { name, comment, parentId } = req.body;
    
    if (!name || !comment) {
        return res.status(400).json({ error: 'Name and comment are required' });
    }

    const comments = readComments();
    const newComment = {
        id: Date.now().toString(),
        name: name.trim(),
        comment: comment.trim(),
        avatar: generateAvatar(name),
        timestamp: new Date().toISOString(),
        likes: 0,
        dislikes: 0,
        parentId: parentId || null,
        replies: []
    };

    if (parentId) {
        // Add as reply
        const parentComment = findComment(comments, parentId);
        if (parentComment) {
            parentComment.replies.push(newComment);
        }
    } else {
        // Add as main comment
        comments.push(newComment);
    }

    if (writeComments(comments)) {
        res.json({ success: true, comment: newComment });
    } else {
        res.status(500).json({ success: false, error: 'Failed to save comment' });
    }
});

// Like/Dislike comment
app.post('/api/comments/:id/reaction', (req, res) => {
    const { id } = req.params;
    const { type } = req.body; // 'like' or 'dislike'

    const comments = readComments();
    const targetComment = findComment(comments, id);

    if (targetComment) {
        if (type === 'like') {
            targetComment.likes++;
        } else if (type === 'dislike') {
            targetComment.dislikes++;
        }

        if (writeComments(comments)) {
            res.json({ success: true, likes: targetComment.likes, dislikes: targetComment.dislikes });
        } else {
            res.status(500).json({ success: false, error: 'Failed to update reaction' });
        }
    } else {
        res.status(404).json({ success: false, error: 'Comment not found' });
    }
});

// Helper function to find comment by ID
function findComment(comments, id) {
    for (let comment of comments) {
        if (comment.id === id) return comment;
        if (comment.replies && comment.replies.length > 0) {
            const found = findComment(comment.replies, id);
            if (found) return found;
        }
    }
    return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
