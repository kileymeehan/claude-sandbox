import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // success: App.jsx onAuthStateChange handles the transition
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    marginBottom: '10px',
    boxSizing: 'border-box',
  };

  return (
    <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: '360px' }}>

        {/* Logo / title */}
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Songbook
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {mode === 'signin' ? 'Sign in to your songbook.' : 'Create your songbook.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={inputStyle}
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            style={{ ...inputStyle, marginBottom: '16px' }}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error && (
            <p style={{ fontSize: '13px', color: '#c46060', marginBottom: '12px', marginTop: '-4px' }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '12px', marginTop: '-4px', lineHeight: 1.5 }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-accent"
            disabled={loading}
            style={{ width: '100%', fontSize: '14px', padding: '10px', marginBottom: '12px' }}
          >
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

      </div>
    </div>
  );
}
