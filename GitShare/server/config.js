import dotenv from 'dotenv';

dotenv.config();

const normalizeUrl = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.replace(/\/+$/, '');
};

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || 5000;
export const CLIENT_URL = normalizeUrl(process.env.CLIENT_URL, 'http://localhost:5173');
export const MONGO_URI = process.env.MONGO_URI || '';
export const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || '';
export const JWT_SECRET = process.env.JWT_SECRET || '';
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
export const GITHUB_CALLBACK_URL = normalizeUrl(
  process.env.GITHUB_CALLBACK_URL,
  'https://gitshare-fjyv.onrender.com/auth/github/callback'
);