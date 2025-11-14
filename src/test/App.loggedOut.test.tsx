/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

vi.mock('../lib/supabaseClient', () => {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
  };

  const from = vi.fn();

  return {
    supabase: {
      auth,
      from,
    },
  };
});

describe('App (logged out)', () => {
  it('shows the Sign In screen when there is no session', async () => {
    render(<App />);

    // 🟢 Look specifically for the heading, not generic text
    const heading = await screen.findByRole('heading', { name: /sign in/i });
    expect(heading).toBeInTheDocument();

    expect(
      screen.getByText(/enter your email to receive a login link/i),
    ).toBeInTheDocument();
  });
});