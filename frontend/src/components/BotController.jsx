import React, { useState } from 'react';
import {
  startSearchBot,
  startNotificationBot,
  createPost,
  createBatchPosts,
  getSessionStatus,
  stopBotSession,
  getActiveSessions
} from '../services/api';

const BotController = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [status, setStatus] = useState('');
  const [config, setConfig] = useState({
    username: '',
    password: '',
    searchQuery: '',
    postText: '',
    topic: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleStartSearch = async () => {
    try {
      setStatus('Starting search bot...');
      const { sessionId } = await startSearchBot({
        username: config.username,
        password: config.password,
        searchQuery: config.searchQuery,
        numPosts: 10
      });
      setActiveSessions(prev => [...prev, { id: sessionId, type: 'search' }]);
      setStatus(`Search bot started (ID: ${sessionId})`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleStartNotifications = async () => {
    try {
      setStatus('Starting notification bot...');
      const { sessionId } = await startNotificationBot({
        username: config.username,
        password: config.password,
        checkIntervalMinutes: 10
      });
      setActiveSessions(prev => [...prev, { id: sessionId, type: 'notification' }]);
      setStatus(`Notification bot started (ID: ${sessionId})`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleCreatePost = async () => {
    try {
      setStatus('Creating post...');
      const { sessionId } = await createPost({
        username: config.username,
        password: config.password,
        postText: config.postText,
        topic: config.topic
      });
      setStatus(`Post created (ID: ${sessionId})`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleStopSession = async (sessionId) => {
    try {
      setStatus(`Stopping session ${sessionId}...`);
      await stopBotSession(sessionId);
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
      setStatus(`Session ${sessionId} stopped`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="bot-controller">
      <h2>Threads Bot Controller</h2>
      
      <div className="input-section">
        <input 
          name="username" 
          placeholder="Username" 
          value={config.username}
          onChange={handleInputChange}
        />
        <input 
          name="password" 
          type="password" 
          placeholder="Password" 
          value={config.password}
          onChange={handleInputChange}
        />
      </div>

      <div className="bot-actions">
        <div>
          <input 
            name="searchQuery" 
            placeholder="Search query" 
            value={config.searchQuery}
            onChange={handleInputChange}
          />
          <button onClick={handleStartSearch}>Start Search Bot</button>
        </div>

        <button onClick={handleStartNotifications}>Start Notification Bot</button>

        <div>
          <textarea 
            name="postText" 
            placeholder="Post text" 
            value={config.postText}
            onChange={handleInputChange}
          />
          <input 
            name="topic" 
            placeholder="Or topic" 
            value={config.topic}
            onChange={handleInputChange}
          />
          <button onClick={handleCreatePost}>Create Post</button>
        </div>
      </div>

      <div className="active-sessions">
        <h3>Active Sessions</h3>
        {activeSessions.map(session => (
          <div key={session.id}>
            {session.type} - {session.id}
            <button onClick={() => handleStopSession(session.id)}>Stop</button>
          </div>
        ))}
      </div>

      <div className="status">{status}</div>
    </div>
  );
};

export default BotController;
