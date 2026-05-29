import express from 'express';
import Comment from '../models/Comment.js';

const router = express.Router();

// @desc    Get comments for a room
// @route   GET /api/comments/:roomId
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const comments = await Comment.find({ roomId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// @desc    Add a comment to a room
// @route   POST /api/comments
router.post('/', async (req, res) => {
  try {
    const { roomId, userId, username, lineNumber, text, fileName } = req.body;
    
    if (!roomId || !username || !lineNumber || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newComment = new Comment({
      roomId,
      userId: userId || null, // Allow null for guests
      username,
      lineNumber: parseInt(lineNumber, 10),
      text,
      fileName: fileName || null
    });

    await newComment.save();
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error saving comment:', error);
    res.status(500).json({ error: 'Server error saving comment' });
  }
});

export default router;
