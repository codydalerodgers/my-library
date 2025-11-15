import React, { useEffect, useState } from 'react';
import type { Book, ReadingLog } from '../types';
import { supabase } from '../lib/supabaseClient';

interface BookDetailProps {
  book: Book;
  initialLog: ReadingLog | null;
  onLogUpdated: (log: ReadingLog | null) => void;
}

export const BookDetail: React.FC<BookDetailProps> = ({
  book,
  initialLog,
  onLogUpdated,
}) => {
  const [status, setStatus] = useState<string>(
    initialLog?.status ?? 'not_started',
  );
  const [rating, setRating] = useState<number | null>(
    initialLog?.rating ?? null,
  );
  const [hoverRating, setHoverRating] = useState<number | null>(null);
const [startedAt, setStartedAt] = useState<string>(
(initialLog as any)?.date_started
    ? (initialLog as any).date_started.slice(0, 10)
    : '',
);

const [finishedAt, setFinishedAt] = useState<string>(
(initialLog as any)?.date_finished
    ? (initialLog as any).date_finished.slice(0, 10)
    : '',
);

const [description, setdescription] = useState<string>(
((initialLog as any)?.description as string) ?? '',
);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If initialLog changes (e.g. from an import or another save), sync up.
    setStatus(initialLog?.status ?? 'not_started');
    setRating(initialLog?.rating ?? null);
    setStartedAt(initialLog?.date_started ? initialLog.date_started.slice(0, 10) : '');
    setFinishedAt(initialLog?.date_finished ? initialLog.date_finished.slice(0, 10) : '');
    setdescription(initialLog?.description ?? '');
  }, [initialLog]);

  const handleStarClick = (value: number) => {
    if (rating === value) {
      // Toggle off if clicking the same star
      setRating(null);
    } else {
      setRating(value);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be signed in to save a reading log.');
        setSaving(false);
        return;
      }

      // If status is "finished" and no date chosen, default to today (YYYY-MM-DD)
        let finalFinishedAt = finishedAt;
        if (status === 'finished' && !finalFinishedAt) {
        finalFinishedAt = new Date().toISOString().slice(0, 10);
        }

        const payload = {
        user_id: user.id,
        book_id: book.id,
        status, // see status note below
        rating,
        date_started: startedAt || null,
        date_finished: finalFinishedAt || null,
        description: description.trim() || null,
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

  const initials =
    (book.title || '')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return (
    <div className="card book-detail-card">
      <div className="book-detail-layout">
        {/* Cover column */}
        <div className="book-detail-cover-wrap">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title ?? 'Book cover'}
              className="book-detail-cover"
            />
          ) : (
            <div className="book-detail-cover fallback">
              {initials}
            </div>
          )}
        </div>

        {/* Main info column */}
        <div className="book-detail-main">
          <div className="book-detail-header">
            <h2 className="book-detail-title">{book.title}</h2>
            {book.author && (
              <p className="book-detail-author">
                {book.author}
              </p>
            )}
          </div>

          {/* Rating */}
          <div className="book-detail-rating-row">
            <span className="label">Your rating</span>
            <div className="book-card-rating">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                const isFilled =
                  (hoverRating ?? rating ?? 0) >= value;

                return (
                  <button
                    key={value}
                    type="button"
                    className="star-btn"
                    onClick={() => handleStarClick(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(null)}
                    aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                  >
                    <span className={isFilled ? 'star star-filled' : 'star'}>
                      ★
                    </span>
                  </button>
                );
              })}
              {rating != null && (
                <span className="rating-number muted">
                  {rating.toFixed(1).replace(/\.0$/, '')}
                </span>
              )}
            </div>
          </div>

          {/* Meta pills */}
          <div className="book-detail-meta-row">
            {book.page_count != null && book.page_count > 0 && (
              <span className="meta-pill">
                {book.page_count} pages
              </span>
            )}
            {book.isbn && (
              <span className="meta-pill meta-pill-mono">
                ISBN {book.isbn}
              </span>
            )}
          </div>

          {/* Log form */}
          <div className="book-detail-form">
            <div className="form-row">
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="to_read">To read</option>
                <option value="reading">Reading</option>
                <option value="finished">Finished</option>
              </select>
            </div>

            <div
              className="form-row"
              style={{ display: 'flex', gap: '0.75rem' }}
            >
              <div style={{ flex: 1 }}>
                <label className="label" htmlFor="date_started">
                  Date started
                </label>
                <input
                  id="date_started"
                  type="date"
                  className="input"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label" htmlFor="date_finished">
                  Date finished
                </label>
                <input
                  id="date_finished"
                  type="date"
                  className="input"
                  value={finishedAt}
                  onChange={(e) => setFinishedAt(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label className="label" htmlFor="description">
                Thoughts / description
              </label>
              <textarea
                id="description"
                className="textarea"
                placeholder="What did you think of this book?"
                value={description}
                onChange={(e) => setdescription(e.target.value)}
              />
            </div>

            {error && (
              <p className="muted" style={{ color: '#b91c1c' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save log'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional description from Open Library / Goodreads */}
      {book.description && (
        <div className="book-detail-description">
          <h3>Synopsis</h3>
          <p className="muted">
            {book.description}
          </p>
        </div>
      )}
    </div>
  );
};