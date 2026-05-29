import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String
  },
  accessToken: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);
export default User;
