const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Database setup - Vercel compatible
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel ? '/tmp/database' : path.join(__dirname, 'database');
const commentsFile = path.join(dbPath, 'comments.json');

// Ensure database directory exists
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

// Initialize with sample data if empty
if (!fs.existsSync(commentsFile)) {
    const initialData = [
        {
            id: "1",
            name: "Admin",
            comment: "Welcome to our comment section! Feel free to share your thoughts.",
            avatar: "https://ui-avatars.com/api/?name=Admin&background=667eea&color=fff&size=64&bold=true",
            timestamp: new Date().toISOString(),
            likes: 5,
            dislikes: 0,
            parentId: null,
            replies: []
        }
    ];
    fs.writeFileSync(commentsFile, JSON.stringify(initialData));
    console.log('Initialized database with sample data');
}

// Cache for instant responses
let commentsCache = null;
let lastUpdate = 0;

// Helper functions
const readComments = () => {
    // Return cache if recent (1 second)
    if (commentsCache && Date.now() - lastUpdate < 1000) {
        return commentsCache;
    }
    
    try {
        const data = fs.readFileSync(commentsFile, 'utf8');
        commentsCache = JSON.parse(data);
        lastUpdate = Date.now();
        return commentsCache;
    } catch (error) {
        console.error('Error reading comments:', error);
        return [];
    }
};

const writeComments = (comments) => {
    try {
        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
        commentsCache = comments; // Update cache
        lastUpdate = Date.now();
        return true;
    } catch (error) {
        console.error('Error writing comments:', error);
        return false;
    }
};

// Generate avatar URL
const generateAvatar = (name) => {
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8', 'F7DC6F'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=64&bold=true&rounded=false`;
};

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

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all comments - INSTANT RESPONSE
app.get('/api/comments', (req, res) => {
    try {
        const comments = readComments();
        res.json({
            success: true,
            data: comments,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to load comments',
            data: [] 
        });
    }
});

// Add new comment - FAST RESPONSE
app.post('/api/comments', (req, res) => {
    try {
        const { name, comment, parentId } = req.body;
        
        if (!name || !comment) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name and comment are required' 
            });
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

        let success = false;

        if (parentId) {
            // Add as reply
            const parentComment = findComment(comments, parentId);
            if (parentComment) {
                parentComment.replies.push(newComment);
                success = writeComments(comments);
            } else {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Parent comment not found' 
                });
            }
        } else {
            // Add as main comment
            comments.unshift(newComment); // Add to beginning for newest first
            success = writeComments(comments);
        }

        if (success) {
            res.json({ 
                success: true, 
                comment: newComment,
                message: 'Comment posted successfully!' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to save comment' 
            });
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Like/Dislike comment - INSTANT
app.post('/api/comments/:id/reaction', (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        if (!['like', 'dislike'].includes(type)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid reaction type' 
            });
        }

        const comments = readComments();
        const targetComment = findComment(comments, id);

        if (targetComment) {
            if (type === 'like') {
                targetComment.likes++;
            } else if (type === 'dislike') {
                targetComment.dislikes++;
            }

            if (writeComments(comments)) {
                res.json({ 
                    success: true, 
                    likes: targetComment.likes, 
                    dislikes: targetComment.dislikes,
                    message: 'Reaction updated!'
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update reaction' 
                });
            }
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Comment not found' 
            });
        }
    } catch (error) {
        console.error('Error handling reaction:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: isVercel ? 'vercel' : 'local'
    });
});

// Get server stats
app.get('/api/stats', (req, res) => {
    const comments = readComments();
    let totalComments = comments.length;
    let totalReplies = 0;

    comments.forEach(comment => {
        totalReplies += comment.replies ? comment.replies.length : 0;
    });

    res.json({
        success: true,
        stats: {
            totalComments: totalComments + totalReplies,
            mainComments: totalComments,
            replies: totalReplies,
            lastUpdate: lastUpdate
        }
    });
});

const PORT = process.env.PORT || 3000;

if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Database path: ${dbPath}`);
    });
}

module.exports = app;
