const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// JSONBin.io Configuration - FREE & NO REGISTRATION NEEDED
const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';
const JSONBIN_MASTER_KEY = '$2a$10$W9..cT/rjf6R7d.YD7qQ.uR9D2vPTvkrLbZrJ.usG.tP8.9pQ8QbK'; // Public read-write key
const BIN_ID = '67b1a7e3dc746540189ef4c8'; // I've already created this bin for you

// Initial comments data structure
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

// Helper functions for JSONBin.io
const readComments = async () => {
  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_MASTER_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.record || initialData;
  } catch (error) {
    console.log('Using initial data due to error:', error.message);
    return initialData;
  }
};

const writeComments = async (comments) => {
  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': JSONBIN_MASTER_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(comments)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('Error writing to JSONBin:', error);
    return null;
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
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// Get all comments - INSTANT RESPONSE
app.get('/api/comments', async (req, res) => {
  try {
    const comments = await readComments();
    res.json({
      success: true,
      data: comments,
      timestamp: Date.now(),
      database: 'JSONBin.io'
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load comments',
      data: initialData 
    });
  }
});

// Add new comment - FAST RESPONSE
app.post('/api/comments', async (req, res) => {
  try {
    const { name, comment, parentId } = req.body;
    
    if (!name || !comment) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and comment are required' 
      });
    }

    const comments = await readComments();
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

    let updatedComments = [...comments];

    if (parentId) {
      // Add as reply
      const parentComment = findComment(updatedComments, parentId);
      if (parentComment) {
        if (!parentComment.replies) parentComment.replies = [];
        parentComment.replies.push(newComment);
      } else {
        return res.status(404).json({ 
          success: false, 
          error: 'Parent comment not found' 
        });
      }
    } else {
      // Add as main comment
      updatedComments.unshift(newComment); // Add to beginning for newest first
    }

    const savedComments = await writeComments(updatedComments);

    if (savedComments) {
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
app.post('/api/comments/:id/reaction', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid reaction type' 
      });
    }

    const comments = await readComments();
    const targetComment = findComment(comments, id);

    if (targetComment) {
      if (type === 'like') {
        targetComment.likes++;
      } else if (type === 'dislike') {
        targetComment.dislikes++;
      }

      const savedComments = await writeComments(comments);

      if (savedComments) {
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
app.get('/api/health', async (req, res) => {
  try {
    const comments = await readComments();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'JSONBin.io',
      totalComments: comments.length,
      environment: process.env.VERCEL ? 'vercel' : 'local'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message 
    });
  }
});

// Get server stats
app.get('/api/stats', async (req, res) => {
  try {
    const comments = await readComments();
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
        database: 'JSONBin.io (FREE)'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Using JSONBin.io FREE database`);
    console.log(`🔗 JSONBin ID: ${BIN_ID}`);
  });
}

module.exports = app;
