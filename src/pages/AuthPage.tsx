// src/pages/AuthPage.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
        emailRedirectTo: window.location.origin,
        },
    });

    if (error) setError(error.message);
    else setSent(true);
    };

  return (
    <div className="app-container">
      <h1>Sign in to My Library</h1>
      <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
        Enter your email and we’ll send you a magic link.
      </p>
      <form onSubmit={signIn}>
        <div className="form-row">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <button className="primary" type="submit">Send magic link</button>
      </form>
      {sent && (
        <p style={{ marginTop: '0.5rem', color: '#16a34a' }}>
          Check your email for a sign-in link.
        </p>
      )}
      {error && (
        <p style={{ marginTop: '0.5rem', color: 'red' }}>
          {error}
        </p>
      )}
    </div>
  );
};