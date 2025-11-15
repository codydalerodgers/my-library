// src/test/App.loggedOut.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client so we don't depend on real env vars or network
vi.mock('../lib/supabaseClient', () => {
  const getSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  });

  const onAuthStateChange = vi.fn().mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  });

  const signInWithOtp = vi.fn();
  const signOut = vi.fn();

  return {
    supabase: {
      auth: {
        getSession,
        onAuthStateChange,
        signInWithOtp,
        signOut,
      },
    },
  };
});

// Import App *after* the mock so it picks up the mocked supabase
import { App } from '../App';

describe('App (logged out)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Sign In screen when there is no session', async () => {
    render(<App />);

    // Wait for App's initial getSession call to resolve and render the auth screen
    const heading = await screen.findByRole('heading', { name: /sign in/i });
    expect(heading).toBeInTheDocument();

    // Optional: also assert that the magic link button is present
    const button = screen.getByRole('button', { name: /send magic link/i });
    expect(button).toBeInTheDocument();
  });
});