import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types';

interface BulkScanViewProps {
  onBookAdded?: (book: Book) => void;
}

type EntryStatus = 'pending' | 'processing' | 'added' | 'duplicate' | 'error';

interface BulkEntry {
  id: string;
  raw: string;
  isbn: string;
  status: EntryStatus;
  message?: string;
  title?: string;
}

// Normalize ISBN-ish strings: keep digits + X/x
function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '');
}

// More robust metadata lookup: OL cover + OL API + Google Books
async function fetchMetadataByIsbn(isbn: string) {
  const normalized = normalizeIsbn(isbn);
  if (!normalized) return null;

  const cleanUrl = (url: string) =>
    url.replace(/^http:\/\//i, 'https://');

  // Try Open Library API (data)
  try {
    const apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${normalized}&format=json&jscmd=data`;
    const res = await fetch(apiUrl);
    if (res.ok) {
      const data = await res.json();
      const entry = data[`ISBN:${normalized}`];
      if (entry) {
        const title: string | undefined = entry.title;
        const authorsArr: { name: string }[] | undefined = entry.authors;
        const author =
          authorsArr && authorsArr.length > 0
            ? authorsArr.map((a) => a.name).join(', ')
            : undefined;
        const pages: number | undefined = entry.number_of_pages;
        const olCover =
          entry.cover?.large || entry.cover?.medium || entry.cover?.small;

        if (title) {
          return {
            isbn: normalized,
            title,
            author,
            pageCount: pages ?? null,
            coverUrl: olCover ? cleanUrl(olCover) : null,
            description:
              typeof entry.description === 'string'
                ? entry.description
                : entry.description?.value ?? null,
          };
        }
      }
    }
  } catch {
    // ignore and fall through
  }

  // Fallback: Google Books
  try {
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${normalized}`;
    const res = await fetch(gbUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        const img =
          info?.imageLinks?.thumbnail ||
          info?.imageLinks?.smallThumbnail ||
          info?.imageLinks?.small ||
          info?.imageLinks?.medium ||
          info?.imageLinks?.large;

        return {
          isbn: normalized,
          title: info?.title ?? null,
          author: Array.isArray(info?.authors)
            ? info.authors.join(', ')
            : null,
          pageCount: info?.pageCount ?? null,
          coverUrl: img ? cleanUrl(img) : null,
          description: info?.description ?? null,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export const BulkScanView: React.FC<BulkScanViewProps> = ({ onBookAdded }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Grab current user once
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setInfo('You must be signed in to bulk import.');
      } else {
        setUserId(data.user.id);
      }
    })();
  }, []);

  // Focus the input so the scanner can type into it
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const addEntry = (raw: string, isbn: string): string => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEntries((prev) => [
      {
        id,
        raw,
        isbn,
        status: 'pending',
      },
      ...prev,
    ]);
    return id;
  };

  const updateEntry = (
    id: string,
    updates: Partial<BulkEntry>,
  ) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  };

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const normalized = normalizeIsbn(trimmed);
    if (!normalized) {
      const id = addEntry(trimmed, '');
      updateEntry(id, {
        status: 'error',
        message: 'Not a valid ISBN/UPC format',
      });
      return;
    }

    const id = addEntry(trimmed, normalized);
    updateEntry(id, { status: 'processing', message: 'Processing…' });

    if (!userId) {
      updateEntry(id, {
        status: 'error',
        message: 'Not signed in.',
      });
      return;
    }

    try {
      // 1) Check if this book already exists in user's library
      const { data: existing, error: existingError } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .eq('isbn', normalized)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') {
        console.error(existingError);
      }

      if (existing) {
        updateEntry(id, {
          status: 'duplicate',
          message: 'Already in your library',
          title: existing.title ?? undefined,
        });
        return;
      }

      // 2) Fetch metadata
      const metadata = await fetchMetadataByIsbn(normalized);
      if (!metadata || !metadata.title) {
        updateEntry(id, {
          status: 'error',
          message: 'No metadata found; add manually later',
        });
        // Optionally create a minimal record; for now, skip insert.
        return;
      }

      // 3) Insert into Supabase
      const insertPayload = {
        user_id: userId,
        isbn: metadata.isbn,
        title: metadata.title,
        author: metadata.author,
        page_count: metadata.pageCount,
        cover_url: metadata.coverUrl,
        description: metadata.description,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('books')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        updateEntry(id, {
          status: 'error',
          message: 'Failed to insert into library',
        });
        return;
      }

      updateEntry(id, {
        status: 'added',
        message: 'Added to library',
        title: inserted.title ?? undefined,
      });

      if (onBookAdded && inserted) {
        onBookAdded(inserted as Book);
      }
    } catch (err) {
      console.error(err);
      updateEntry(id, {
        status: 'error',
        message: 'Unexpected error while processing',
      });
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const current = input;
      setInput('');
      await handleScan(current);
    }
  };

  return (
    <div className="library-view">
      <div className="library-header">
        <div>
          <h2>Bulk scan</h2>
          <p className="muted">
            Connect your Bluetooth scanner, click in the field, then scan each
            book&apos;s barcode. We&apos;ll look each up and add it to your library.
          </p>
          {info && (
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              {info}
            </p>
          )}
        </div>
        <div className="library-controls">
          <input
            ref={inputRef}
            className="input"
            placeholder="Focus here, then scan barcodes…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: '0.75rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.95rem' }}>
          Recent scans
        </h3>
        {entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing scanned yet. Each time you scan a book, you&apos;ll see it appear
            here with its status.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div>
                    <strong>{entry.isbn || entry.raw}</strong>
                    {entry.title && (
                      <span className="muted" style={{ marginLeft: '0.35rem' }}>
                        {entry.title}
                      </span>
                    )}
                  </div>
                  {entry.message && (
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      {entry.message}
                    </div>
                  )}
                </div>
                <div>
                  {entry.status === 'processing' && (
                    <span className="badge badge-soft">Processing…</span>
                  )}
                  {entry.status === 'added' && (
                    <span className="badge badge-soft">Added</span>
                  )}
                  {entry.status === 'duplicate' && (
                    <span className="badge">Duplicate</span>
                  )}
                  {entry.status === 'error' && (
                    <span
                      className="badge"
                      style={{ background: '#fee2e2', color: '#b91c1c' }}
                    >
                      Error
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};