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

/**
 * Fetch basic metadata for a book from Open Library via ISBN-13.
 */
async function fetchOpenLibraryMetadata(isbn: string): Promise<{
  title: string;
  author: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
} | null> {
  try {
    const resp = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (!resp.ok) return null;

    const data = (await resp.json()) as OpenLibraryBook;

    // Try to fetch first author's name
    let author: string | null = null;
    if (data.authors && data.authors.length > 0) {
      const authorKey = data.authors[0].key; // e.g. "/authors/OL123A"
      if (authorKey) {
        try {
          const authorResp = await fetch(`https://openlibrary.org${authorKey}.json`);
          if (authorResp.ok) {
            const authorData = await authorResp.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            author = (authorData as any).name ?? null;
          }
        } catch {
          // ignore author fetch failure
        }
      }
    }

    // Description can be string or object
    let description: string | null = null;
    if (typeof data.description === 'string') {
      description = data.description;
    } else if (data.description && typeof data.description === 'object') {
      description = data.description.value ?? null;
    }

    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

    return {
      title: data.title ?? '',
      author,
      pageCount: data.number_of_pages ?? null,
      description,
      coverUrl,
    };
  } catch (e) {
    console.error('Open Library error', e);
    return null;
  }
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