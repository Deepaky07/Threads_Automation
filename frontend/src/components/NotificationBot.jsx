import React, { useState } from 'react';
import { 
  startNotificationBot, 
  stopNotificationBot, 
  getNotificationStatus 
} from '../services/notificationService';

const NotificationBot = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    checkIntervalMinutes: 10
  });
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStart = async () => {
    try {
      setStatus('starting');
      const response = await startNotificationBot(formData);
      setSessionId(response.sessionId);
      setStatus('running');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const handleStop = async () => {
    try {
      setStatus('stopping');
      await stopNotificationBot(sessionId);
      setStatus('stopped');
      setSessionId(null);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const handleCheckStatus = async () => {
    try {
      const response = await getNotificationStatus(sessionId);
      setStatus(response.status);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div>
      <h2>Notification Bot</h2>
      
      {!sessionId ? (
        <div>
          <input 
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Username"
          />
          <input 
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
          />
          <input 
            name="checkIntervalMinutes"
            type="number"
            value={formData.checkIntervalMinutes}
            onChange={handleChange}
            placeholder="Check Interval (minutes)"
          />
          <button onClick={handleStart} disabled={status === 'starting'}>
            Start Bot
          </button>
        </div>
      ) : (
        <div>
          <p>Bot Session: {sessionId}</p>
          <p>Status: {status}</p>
          <button onClick={handleStop} disabled={status === 'stopping'}>
            Stop Bot
          </button>
          <button onClick={handleCheckStatus}>
            Check Status
          </button>
        </div>
      )}
      
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default NotificationBot;
