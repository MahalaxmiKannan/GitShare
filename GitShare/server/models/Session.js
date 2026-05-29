import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    default: ''
  },
  activeUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Session = mongoose.model('Session', SessionSchema);
export default Session;
