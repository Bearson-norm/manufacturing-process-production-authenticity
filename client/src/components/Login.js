import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Login.css';
import logoFoom from '../assets/Logo FOOM Hitam.webp';

function resolveLoginError(err) {
  const status = err.response?.status;
  const message = err.response?.data?.message;

  if (status === 401) {
    return message || 'Username atau password salah';
  }
  if (status === 503) {
    return message || 'Layanan sementara tidak tersedia. Coba lagi nanti.';
  }
  if (err.request && !err.response) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.';
  }
  return message || 'Terjadi kesalahan saat login. Silakan coba lagi.';
}

function Login({ setIsAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const sessionExpired =
      searchParams.get('session') === 'expired' ||
      sessionStorage.getItem('sessionExpired') === '1';
    if (sessionExpired) {
      sessionStorage.removeItem('sessionExpired');
      setError('Sesi berakhir. Silakan login kembali.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/login', { username, password });
      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', response.data.role || 'production');
        setIsAuthenticated(true);
        navigate('/dashboard');
      } else {
        setError('Login gagal: token tidak diterima');
      }
    } catch (err) {
      setError(resolveLoginError(err));
    } finally {
      setLoading(false);
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Memproses...' : 'Login'}
          </button>
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
