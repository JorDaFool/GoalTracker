import React, { useState } from 'react';
import { login } from './pb';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#2C2C2E',
  border: 'none',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#F2F2F7',
  fontSize: 14,
};

const labelStyle = {
  display: 'block',
  color: '#8E8E93',
  fontSize: 12,
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      onLoggedIn();
    } catch {
      setError('Login failed — check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '32px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#1C1C1E',
          borderRadius: 16,
          padding: 24,
          border: '1px solid #2C2C2E',
        }}
      >
        <h1 style={{ margin: '0 0 20px', color: '#F2F2F7', fontSize: 22, fontWeight: 700 }}>
          Goal Tracker
        </h1>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p style={{ color: '#DC5F3C', fontSize: 13, margin: '0 0 16px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: busy ? '#2C2C2E' : '#F2F2F7',
            color: busy ? '#636366' : '#000',
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
