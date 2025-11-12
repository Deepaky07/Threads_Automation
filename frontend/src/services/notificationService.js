import api from './api';

export const startNotificationBot = async ({ username, password, checkIntervalMinutes }) => {
  try {
    const response = await api.post('/notification/start', {
      username,
      password,
      checkIntervalMinutes
    });
    return response;
  } catch (error) {
    console.error('Error starting notification bot:', error);
    throw error;
  }
};

export const stopNotificationBot = async (sessionId) => {
  try {
    const response = await api.post('/notification/stop', { sessionId });
    return response;
  } catch (error) {
    console.error('Error stopping notification bot:', error);
    throw error;
  }
};

export const getNotificationStatus = async (sessionId) => {
  try {
    const response = await api.get(`/notification/status/${sessionId}`);
    return response;
  } catch (error) {
    console.error('Error getting notification status:', error);
    throw error;
  }
};
