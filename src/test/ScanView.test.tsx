/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanView } from '../pages/ScanView';

// Mock BarcodeScanner so we don't hit camera APIs
vi.mock('../components/BarcodeScanner', () => ({
  BarcodeScanner: () => <div>Mock scanner</div>,
}));

// Light mock of supabase so imports work
vi.mock('../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe('ScanView (smoke test)', () => {
  it('renders the scan header and mocked scanner', () => {
    render(
      <ScanView
        onBookFound={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // Header text from ScanView
    expect(screen.getByText(/scan a book/i)).toBeInTheDocument();

    // Our mocked scanner placeholder
    expect(screen.getByText(/mock scanner/i)).toBeInTheDocument();
  });
});