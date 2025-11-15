// src/pages/BulkEditView.tsx
import React, { useMemo, useState, useEffect } from 'react';
import type { Book, ReadingLog } from '../types';
import { supabase } from '../lib/supabaseClient';

interface BulkEditViewProps {
  books: Book[];
  logs: ReadingLog[];
  onLogUpdated: (log: ReadingLog | null) => void;
}

type StatusFilter =
  | 'all'
  | 'to_read'
  | 'reading'
  | 'finished'
  | 'paused'
  | 'abandoned'
  | 'no_log';

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RowProps {
  book: Book;
  log: ReadingLog | null;
  onLogUpdated: (log: ReadingLog | null) => void;
}

const BulkEditRow: React.FC<RowProps> = ({ book, log, onLogUpdated }) => {
  const [status, setStatus] = useState<string>(
    (log && (log as any).status) || 'finished',
  );
  const [rating, setRating] = useState<string>(
    log && typeof (log as any).rating === 'number'
      ? String((log as any).rating)
      : '',
  );
  const [startedAt, setStartedAt] = useState<string>(
    (log && ((log as any).started_at as string | null)) || '',
  );
  const [finishedAt, setFinishedAt] = useState<string>(
    (log && ((log as any).finished_at as string | null)) || '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local state in sync if log prop changes
  useEffect(() => {
    if (!log) {
      setStatus('finished');
      setRating('');
      setStartedAt('');
      setFinishedAt('');
      setError(null);
      setSaving(false);
      return;
    }

    setStatus((log as any).status || 'finished');
    setRating(
      typeof (log as any).rating === 'number'
        ? String((log as any).rating)
        : '',
    );
    setStartedAt(((log as any).started_at as string | null) || '');
    setFinishedAt(((log as any).finished_at as string | null) || '');
    setError(null);
    setSaving(false);
  }, [log]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be signed in to save.');
        setSaving(false);
        return;
      }

      // Decide status if empty
      const effectiveStatus =
        status ||
        (finishedAt
          ? 'finished'
          : startedAt
          ? 'reading'
          : 'to_read');

      const numericRating =
        rating && rating.trim()
          ? Number(rating.trim())
          : null;

      const payload = {
        user_id: user.id,
        book_id: book.id,
        status: effectiveStatus,
        rating:
          numericRating !== null && Number.isFinite(numericRating)
            ? numericRating
            : null,
        started_at: startedAt || null,
        finished_at: finishedAt || null,
        // Keep notes as-is if they exist already, otherwise null
        notes: log && (log as any).notes ? (log as any).notes : null,
      };

      // Upsert reading log based on (user_id, book_id)
      const { data, error: upsertError } = await supabase
        .from('reading_logs')
        .upsert(payload, { onConflict: 'user_id,book_id' })
        .select()
        .single();

      if (upsertError) {
        console.error(upsertError);
        setError('Failed to save. Please try again.');
      } else {
        onLogUpdated(data as ReadingLog);
      }
    } catch (err) {
      console.error(err);
      setError('Unexpected error while saving.');
    } finally {
      setSaving(false);
    }
  };

  const displayStatus =
    status || (log && (log as any).status) || '—';

  const yearLabel = (() => {
    const finished = parseDate(finishedAt || ((log as any)?.finished_at as string | null));
    const started = parseDate(startedAt || ((log as any)?.started_at as string | null));
    const d = finished || started;
    return d ? d.getFullYear() : null;
  })();

  const initials =
    (book.title || '')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return (
    <li className="bulk-edit-row">
      <div className="bulk-edit-main">
        <div className="bulk-edit-cover">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="book-cover"
            />
          ) : (
            <div className="book-cover fallback">
              <span>{initials}</span>
            </div>
          )}
        </div>

        <div className="bulk-edit-info">
          <div className="bulk-edit-header">
            <div>
              <div className="book-title">
                {book.title || 'Untitled'}
              </div>
              {book.author && (
                <div className="book-author">{book.author}</div>
              )}
            </div>
            <div className="bulk-edit-status-pill">
              <span className="pill">
                {displayStatus} {yearLabel ? `• ${yearLabel}` : ''}
              </span>
            </div>
          </div>

          <div className="bulk-edit-fields">
            {/* Status */}
            <div className="bulk-edit-field">
              <label className="label">Status</label>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="to_read">To read</option>
                <option value="reading">Reading</option>
                <option value="finished">Finished</option>
                <option value="paused">Paused</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>

            {/* Started date */}
            <div className="bulk-edit-field">
              <label className="label">Started</label>
              <input
                className="input"
                type="date"
                value={startedAt || ''}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>

            {/* Finished date */}
            <div className="bulk-edit-field">
              <label className="label">Finished</label>
              <input
                className="input"
                type="date"
                value={finishedAt || ''}
                onChange={(e) => setFinishedAt(e.target.value)}
              />
            </div>

            {/* Rating */}
            <div className="bulk-edit-field">
              <label className="label">Rating</label>
              <select
                className="select"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                <option value="">—</option>
                <option value="1">1 ⭐</option>
                <option value="2">2 ⭐⭐</option>
                <option value="3">3 ⭐⭐⭐</option>
                <option value="4">4 ⭐⭐⭐⭐</option>
                <option value="5">5 ⭐⭐⭐⭐⭐</option>
              </select>
            </div>

            {/* Save button */}
            <div className="bulk-edit-actions">
              <button
                type="button"
                className="primary small"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {error && (
            <p
              className="muted"
              style={{ color: '#b91c1c', marginTop: '0.25rem' }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
};

export const BulkEditView: React.FC<BulkEditViewProps> = ({
  books,
  logs,
  onLogUpdated,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const logsByBookId = useMemo(() => {
    const map = new Map<string, ReadingLog>();
    logs.forEach((log) => {
      const bookId = String((log as any).book_id);
      map.set(bookId, log);
    });
    return map;
  }, [logs]);

  const allYears = useMemo(() => {
    const yearSet = new Set<number>();
    logs.forEach((log) => {
      const started = parseDate((log as any).started_at as string | null);
      const finished = parseDate((log as any).finished_at as string | null);
      if (started) yearSet.add(started.getFullYear());
      if (finished) yearSet.add(finished.getFullYear());
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [logs]);

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const log = logsByBookId.get(book.id) || null;

      // Search by title / author
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const title = (book.title || '').toLowerCase();
        const author = (book.author || '').toLowerCase();
        if (!title.includes(q) && !author.includes(q)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'no_log') {
        if (log) return false;
      } else if (statusFilter !== 'all') {
        const s = log && (log as any).status;
        if (!s || s !== statusFilter) {
          return false;
        }
      }

      // Year filter
      if (yearFilter !== 'all') {
        const yearInt = parseInt(yearFilter, 10);
        const finished = parseDate((log as any)?.finished_at as string | null);
        const started = parseDate((log as any)?.started_at as string | null);
        const rowYear =
          finished?.getFullYear() ?? started?.getFullYear() ?? null;

        if (!rowYear || rowYear !== yearInt) {
          return false;
        }
      }

      return true;
    });
  }, [books, logsByBookId, query, statusFilter, yearFilter]);

  return (
    <div className="dashboard">
      <section className="card bulk-edit-header">
        <div>
          <h2 style={{ margin: 0 }}>Bulk edit reading logs</h2>
          <p
            className="muted"
            style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
          >
            Quickly adjust status, dates, and ratings across your library.
          </p>
        </div>

        <div className="bulk-edit-filters">
          <div className="bulk-edit-filter">
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="Title or author…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="bulk-edit-filter">
            <label className="label">Status</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">All</option>
              <option value="to_read">To read</option>
              <option value="reading">Reading</option>
              <option value="finished">Finished</option>
              <option value="paused">Paused</option>
              <option value="abandoned">Abandoned</option>
              <option value="no_log">No log</option>
            </select>
          </div>

          <div className="bulk-edit-filter">
            <label className="label">Year</label>
            <select
              className="select"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All years</option>
              {allYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        {filteredBooks.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            No books match your current filters. Try changing the search, status,
            or year.
          </p>
        ) : (
          <ul className="bulk-edit-list">
            {filteredBooks.map((book) => {
              const log = logsByBookId.get(book.id) || null;
              return (
                <BulkEditRow
                  key={book.id}
                  book={book}
                  log={log}
                  onLogUpdated={onLogUpdated}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};