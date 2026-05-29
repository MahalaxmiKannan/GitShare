import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  username: {
    type: String,
    required: true
  },
  lineNumber: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Comment = mongoose.model('Comment', CommentSchema);
export default Comment;
