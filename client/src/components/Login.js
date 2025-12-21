import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

function Login({ setIsAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('/api/login', { username, password });
      if (response.data.success) {
        localStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Manufacturing Process</h1>
        <h2>Production Authenticity System</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button">Login</button>
        </form>
        <div className="production-options">
          <h3>Select Production Type:</h3>
          <div className="options-grid">
            <button
              type="button"
              className="option-button"
              onClick={() => {
                if (localStorage.getItem('isAuthenticated') === 'true') {
                  navigate('/production/liquid');
                } else {
                  setError('Please login first');
                }
              }}
            >
              Production Liquid
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => {
                if (localStorage.getItem('isAuthenticated') === 'true') {
                  navigate('/production/device');
                } else {
                  setError('Please login first');
                }
              }}
            >
              Production Device
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => {
                if (localStorage.getItem('isAuthenticated') === 'true') {
                  navigate('/production/cartridge');
                } else {
                  setError('Please login first');
                }
              }}
            >
              Production Cartridge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

