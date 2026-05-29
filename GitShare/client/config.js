const normalizeUrl = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.replace(/\/+$/, '');
};

const isProduction = import.meta.env.PROD;
const defaultApiUrl = isProduction ? '' : 'http://localhost:5000';

export const API_URL = normalizeUrl(import.meta.env.VITE_API_URL, defaultApiUrl);
export const SOCKET_URL = normalizeUrl(import.meta.env.VITE_SOCKET_URL, API_URL);
export const BACKEND_URL = API_URL;