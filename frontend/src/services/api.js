import axios from 'axios';

const API_BASE = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Bot Operations
export const createPost = (postData) => api.post('/api/posts/create', postData);
export const autoCreatePost = (config) => api.post('/api/posts/auto', config);
export const startSearch = (config) => api.post('/api/search', config);
export const startNotifications = (config) => api.post('/api/notifications', config);

// Utility
export const getApiStatus = () => api.get('/');

export default api;