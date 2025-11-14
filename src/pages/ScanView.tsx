// src/pages/ScanView.tsx
import React, { useState } from 'react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types';

interface ScanViewProps {
  onBookFound: (book: Book | null, isbn: string) => void;
}

export const ScanView: React.FC<ScanViewProps> = ({ onBookFound }) => {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDetected = async (code: string) => {
    if (searching) return;
    setSearching(true);
    setLastCode(code);
    setMessage('Looking up ISBN...');

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error('Not signed in');

      // Normalize to digits only in case the scanner includes extra chars
      const normalized = code.replace(/[^\dX]/gi, '');

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .eq('isbn', normalized)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMessage('Book found in your library.');
        onBookFound(data as Book, normalized);
      } else {
        setMessage('Book not found. You can add it.');
        onBookFound(null, normalized);
      }
    } catch (e: any) {
      console.error(e);
      setMessage(e.message || 'Error looking up ISBN');
      onBookFound(null, code);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <h2>Scan a book</h2>
      <BarcodeScanner onDetected={handleDetected} />
      {lastCode && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Last barcode: <strong>{lastCode}</strong>
        </p>
      )}
      {message && (
        <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{message}</p>
      )}
    </div>
  );
};