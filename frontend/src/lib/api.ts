const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = {
  async getStatus() {
    const response = await fetch(`${API_BASE_URL}/api/status`);
    if (!response.ok) throw new Error("Failed to fetch status");
    return response.json();
  },

  async getSession(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/status/${sessionId}`);
    if (!response.ok) throw new Error("Session not found");
    return response.json();
  },

  async startSearch(config) {
    const response = await fetch(`${API_BASE_URL}/api/search/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Failed to start search bot");
    return response.json();
  },

  async startNotifications(config) {
    const response = await fetch(`${API_BASE_URL}/api/notifications/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Failed to start notification bot");
    return response.json();
  },

  async createPost(config) {
    const response = await fetch(`${API_BASE_URL}/api/post/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Failed to create post");
    return response.json();
  },

  async stopSession(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/stop/${sessionId}`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to stop session");
    return response.json();
  },
};
