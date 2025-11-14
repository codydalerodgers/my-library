// src/pages/ScanView.tsx
import React, { useState } from 'react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types';

interface ScanViewProps {
  onBookFound: (book: Book | null, isbn: string) => void;
}

interface OpenLibraryBook {
  title?: string;
  authors?: { key: string }[];
  number_of_pages?: number;
  description?: string | { value?: string };
}

interface OpenLibraryApiBook {
  title?: string;
  authors?: { name?: string }[];
  number_of_pages?: number;
  description?: string | { value?: string };
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

/**
 * Try fetching book data from Open Library using the API endpoint.
 * First tries the given ISBN, then (if it's a 13-digit ISBN) tries the ISBN-10 equivalent.
 */
async function fetchOpenLibraryMetadata(isbnRaw: string): Promise<{
  title: string;
  author: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
} | null> {
  // Normalize to digits/X
  const digits = isbnRaw.replace(/[^\dX]/gi, '');

  const tryIsbn = async (isbn: string): Promise<{
    title: string;
    author: string | null;
    pageCount: number | null;
    description: string | null;
    coverUrl: string | null;
  } | null> => {
    try {
      const resp = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      );
      if (!resp.ok) {
        return null;
      }

      const json = (await resp.json()) as Record<string, OpenLibraryApiBook>;
      const key = `ISBN:${isbn}`;
      const data = json[key];
      if (!data) return null;

      const title = data.title ?? '';
      const author = data.authors?.[0]?.name ?? null;
      const pageCount = data.number_of_pages ?? null;

      let description: string | null = null;
      if (typeof data.description === 'string') {
        description = data.description;
      } else if (data.description && typeof data.description === 'object') {
        description = (data.description as any).value ?? null;
      }

      const coverUrl =
        data.cover?.large || data.cover?.medium || data.cover?.small || null;

      return {
        title,
        author,
        pageCount,
        description,
        coverUrl,
      };
    } catch (e) {
      console.error('Open Library API error', e);
      return null;
    }
  };

  // 1) Try the raw digits (often ISBN-13 from barcodes)
  const primary = await tryIsbn(digits);
  if (primary) return primary;

  // 2) If it's a 13-digit ISBN starting with 978/979, convert to ISBN-10 and try again
  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) {
    const core = digits.slice(3, 12); // 9 digits
    if (/^\d{9}$/.test(core)) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        const digit = Number(core[i]);
        sum += digit * (10 - i);
      }
      const remainder = sum % 11;
      const check = 11 - remainder;
      let checkDigit: string;
      if (check === 10) checkDigit = 'X';
      else if (check === 11) checkDigit = '0';
      else checkDigit = String(check);

      const isbn10 = core + checkDigit;
      const alt = await tryIsbn(isbn10);
      if (alt) return alt;
    }
  }

  // Nothing found
  return null;
}

export const ScanView: React.FC<ScanViewProps> = ({ onBookFound }) => {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add-book form state
  const [formVisible, setFormVisible] = useState(false);
  const [formIsbn, setFormIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pageCount, setPageCount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleDetected = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setFormError(null);

    // Normalize the barcode to digits (and X for some ISBNs)
    const normalized = code.replace(/[^\dX]/gi, '');
    setLastCode(normalized);
    setStatus('Looking up book in your library...');

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error('Not signed in');

      // Check if this ISBN is already in the user's library
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .eq('isbn', normalized)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStatus('Book already in your library.');
        setFormVisible(false);
        onBookFound(data as Book, normalized);
      } else {
        // Not found in your library – try Open Library
        setStatus('Not in your library. Looking up details from Open Library...');
        const meta = await fetchOpenLibraryMetadata(normalized);

        setFormIsbn(normalized);
        setTitle(meta?.title || '');
        setAuthor(meta?.author || '');
        setPageCount(meta?.pageCount ?? '');
        setDescription(meta?.description || '');

        if (meta) {
          setStatus('We found details. Confirm and save.');
        } else {
          setStatus('Could not find details. Enter at least a title and save.');
        }

        setFormVisible(true);
      }
    } catch (e: any) {
      console.error(e);
      setStatus(e.message || 'Error while looking up book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);

    try {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setFormError('Title is required.');
        setSaving(false);
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error('Not signed in');

      const payload: any = {
        user_id: user.id,
        title: trimmedTitle,
        author: author.trim() || null,
        isbn: formIsbn || null,
      };

      if (pageCount !== '') payload.page_count = Number(pageCount);
      if (description.trim()) payload.description = description.trim();

      // You could also store cover_url here if you want:
      // payload.cover_url = `https://covers.openlibrary.org/b/isbn/${formIsbn}-L.jpg`;

      const { data, error } = await supabase
        .from('books')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      const newBook = data as Book;
      setStatus('Book saved to your library.');
      setFormVisible(false);
      onBookFound(newBook, formIsbn);
    } catch (e: any) {
      console.error(e);
      setFormError(e.message || 'Failed to save book.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Scan a book</h2>
      <BarcodeScanner onDetected={handleDetected} />

      {lastCode && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Last barcode / ISBN: <strong>{lastCode}</strong>
        </p>
      )}

      {status && (
        <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{status}</p>
      )}

      {formVisible && (
        <div className="card" style={{ marginTop: '0.75rem' }}>
          <div className="form-row">
            <span className="label">ISBN</span>
            <div style={{ fontSize: '0.85rem' }}>{formIsbn || 'Unknown'}</div>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="author">
              Author
            </label>
            <input
              id="author"
              className="input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Main author"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="pages">
              Page count
            </label>
            <input
              id="pages"
              type="number"
              className="input"
              value={pageCount}
              onChange={(e) =>
                setPageCount(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="e.g. 320"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or description"
            />
          </div>

          <button
            className="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save to library'}
          </button>

          {formError && (
            <div style={{ marginTop: '0.5rem', color: 'red' }}>
              {formError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};