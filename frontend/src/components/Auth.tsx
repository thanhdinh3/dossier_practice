import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthUser, Role } from '../types';

export function Auth({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<AuthUser[]>([]);

  function loadAccounts() {
    api
      .listUsers()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }

  useEffect(loadAccounts, []);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await api.register({ email, password, role, displayName })
          : await api.login({ email, password });
      api.setToken(res.token);
      onAuthed(res.user);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function quickLogin(id: string) {
    setError('');
    setBusy(true);
    try {
      const res = await api.quickLogin(id);
      api.setToken(res.token);
      onAuthed(res.user);
    } catch (e: any) {
      setError(e.message || 'Quick login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 440, margin: '40px auto' }}>
      <div className="tabs">
        <button
          className={`tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => setMode('register')}
        >
          Create account
        </button>
        <button
          className={`tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
      </div>

      {mode === 'register' && (
        <>
          <label>I am a…</label>
          <div className="row">
            <button
              className={role === 'EMPLOYER' ? '' : 'secondary'}
              onClick={() => setRole('EMPLOYER')}
            >
              Employer
            </button>
            <button
              className={role === 'CANDIDATE' ? '' : 'secondary'}
              onClick={() => setRole('CANDIDATE')}
            >
              Candidate
            </button>
          </div>

          <label>{role === 'EMPLOYER' ? 'Company name' : 'Full name'}</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={role === 'EMPLOYER' ? 'Acme AG' : 'Jane Doe'}
          />
        </>
      )}

      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="min 6 characters"
      />

      {error && <div className="error">{error}</div>}

      <div style={{ marginTop: 16 }}>
        <button onClick={submit} disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
        </button>
      </div>

      {accounts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Quick login (demo) — tap an account:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map((a) => (
              <button
                key={a.id}
                className="secondary"
                disabled={busy}
                onClick={() => quickLogin(a.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <span>
                  {a.displayName}{' '}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    · {a.email}
                  </span>
                </span>
                <span className={`pill role-${a.role}`}>{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
