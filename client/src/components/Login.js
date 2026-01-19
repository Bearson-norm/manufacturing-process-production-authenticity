import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';
import logoFoom from '../assets/Logo FOOM Hitam.webp';

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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '500px'
      }}>
        {/* Logo centered above login box with white background */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '24px',
          background: 'white',
          padding: '20px 40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <img 
            src={logoFoom} 
            alt="FOOM Logo" 
            style={{ 
              height: '60px',
              width: 'auto',
              objectFit: 'contain'
            }} 
          />
        </div>
        
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
          <p style={{ textAlign: 'center', fontSize: '16px', color: '#666', marginTop: '20px' }}>
            Made by Internal FOOM
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

export default Login;

