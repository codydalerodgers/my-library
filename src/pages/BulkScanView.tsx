import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types';
import { normalizeIsbn, fetchBookMetadata } from '../lib/bookMetadata';

interface BulkScanViewProps {
  onBookAdded?: (book: Book) => void;
}

type EntryStatus =
  | 'pending'
  | 'processing'
  | 'added'
  | 'duplicate'
  | 'error'
  | 'not_found';

interface BulkEntry {
  id: string;
  raw: string;
  isbn: string;
  status: EntryStatus;
  message?: string;
  title?: string;
  manualTitle?: string;
  manualAuthor?: string;
  manualPages?: string;
  editingManual?: boolean;
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

    const startManualEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              editingManual: true,
              manualTitle: e.manualTitle ?? e.title ?? '',
              manualAuthor: e.manualAuthor ?? '',
              manualPages: e.manualPages ?? '',
            }
          : e,
      ),
    );
  };

  const handleManualFieldChange = (
    id: string,
    field: 'manualTitle' | 'manualAuthor' | 'manualPages',
    value: string,
  ) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  };

  const saveManualEntry = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const title = (entry.manualTitle || '').trim();
    if (!title) {
      updateEntry(id, {
        message: 'Title is required to add manually.',
      });
      return;
    }

    const author =
      (entry.manualAuthor && entry.manualAuthor.trim()) || null;
    const pageCount =
      entry.manualPages && entry.manualPages.trim()
        ? Number(entry.manualPages.trim())
        : null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        updateEntry(id, {
          status: 'error',
          message: 'You must be signed in to save.',
        });
        return;
      }

      const userId = user.id;

      // Check for duplicate with same ISBN for this user
      const { data: existing, error: existingError } = await supabase
        .from('books')
        .select('id')
        .eq('user_id', userId)
        .eq('isbn', entry.isbn)
        .maybeSingle();

      if (existingError) {
        console.error(existingError);
        updateEntry(id, {
          status: 'error',
          message: 'Error checking for duplicates.',
        });
        return;
      }

      if (existing) {
        updateEntry(id, {
          status: 'duplicate',
          message: 'Already in your library',
          editingManual: false,
        });
        return;
      }

      const insertPayload = {
        user_id: userId,
        isbn: entry.isbn,
        title,
        author,
        page_count: Number.isFinite(pageCount || NaN) ? pageCount : null,
        cover_url: null,
        description: null,
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
        message: 'Added to library (manual)',
        title: (inserted as any)?.title ?? title,
        editingManual: false,
      });

      if (onBookAdded && inserted) {
        onBookAdded(inserted as Book);
      }
    } catch (err) {
      console.error(err);
      updateEntry(id, {
        status: 'error',
        message: 'Unexpected error while saving manually',
      });
    }
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
      const metadata = await fetchBookMetadata(normalized);
      if (!metadata || !metadata.title) {
        updateEntry(id, {
          status: 'not_found',
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
                  {entry.status === 'not_found' && (
                    <span className="badge badge-soft">Not found</span>
                  )}
                  {entry.status === 'error' && (
                    <span
                      className="badge"
                      style={{ background: '#fee2e2', color: '#b91c1c' }}
                    >
                      Error
                    </span>
                  )}
                  {entry.status === 'not_found' && !entry.editingManual && (
                    <button
                      type="button"
                      className="secondary small"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={() => startManualEntry(entry.id)}
                    >
                      Add details
                    </button>
                  )}
                </div>
                {entry.editingManual && (
                  <div style={{ marginTop: '0.5rem', width: '100%' }}>
                    <div className="form-row">
                      <label className="label">Title *</label>
                      <input
                        className="input"
                        value={entry.manualTitle ?? ''}
                        onChange={(e) =>
                          handleManualFieldChange(
                            entry.id,
                            'manualTitle',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="form-row">
                      <label className="label">Author</label>
                      <input
                        className="input"
                        value={entry.manualAuthor ?? ''}
                        onChange={(e) =>
                          handleManualFieldChange(
                            entry.id,
                            'manualAuthor',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="form-row">
                      <label className="label">Page count</label>
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        value={entry.manualPages ?? ''}
                        onChange={(e) =>
                          handleManualFieldChange(
                            entry.id,
                            'manualPages',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      <button
                        type="button"
                        className="primary small"
                        onClick={() => saveManualEntry(entry.id)}
                      >
                        Save to library
                      </button>
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() =>
                          updateEntry(entry.id, {
                            editingManual: false,
                          })
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};