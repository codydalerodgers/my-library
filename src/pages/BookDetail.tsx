// src/pages/BookDetail.tsx
import React, { useEffect, useState } from 'react';
import type { Book, ReadingLog, BookStatus } from '../types';
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
  const [log, setLog] = useState<ReadingLog | null>(initialLog);
  const [status, setStatus] = useState<BookStatus>(initialLog?.status ?? 'to_read');
  const [dateStarted, setDateStarted] = useState<string>(initialLog?.date_started ?? '');
  const [dateFinished, setDateFinished] = useState<string>(initialLog?.date_finished ?? '');
  const [rating, setRating] = useState<number | ''>(initialLog?.rating ?? '');
  const [review, setReview] = useState<string>(initialLog?.review ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLog(initialLog);
    setStatus(initialLog?.status ?? 'to_read');
    setDateStarted(initialLog?.date_started ?? '');
    setDateFinished(initialLog?.date_finished ?? '');
    setRating(initialLog?.rating ?? '');
    setReview(initialLog?.review ?? '');
  }, [initialLog]);

  const saveLog = async () => {
    setSaving(true);
    setError(null);

    try {
      const logPayload: Partial<ReadingLog> = {
        status,
        date_started: dateStarted || null,
        date_finished: dateFinished || null,
        rating: rating === '' ? null : Number(rating),
        review: review || null,
      };

      let resultLog: ReadingLog;
      if (log) {
        const { data, error } = await supabase
          .from('reading_logs')
          .update(logPayload)
          .eq('id', log.id)
          .select('*')
          .single();
        if (error) throw error;
        resultLog = data as ReadingLog;
      } else {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) throw userErr || new Error('No user');

        const { data, error } = await supabase
          .from('reading_logs')
          .insert({
            user_id: user.id,
            book_id: book.id,
            ...logPayload,
          })
          .select('*')
          .single();
        if (error) throw error;
        resultLog = data as ReadingLog;
      }

      setLog(resultLog);
      onLogUpdated(resultLog);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to save reading log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Book details</h2>
      <div className="card">
        <div className="card-title">{book.title}</div>
        <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
          {book.author}
        </div>
        {book.isbn && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            ISBN: {book.isbn}
          </div>
        )}
        {book.description && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {book.description}
          </p>
        )}
      </div>

      <h3>Reading progress</h3>
      <div className="card">
        <div className="form-row">
          <label className="label">Status</label>
          <select
            className="select"
            value={status}
            onChange={e => setStatus(e.target.value as BookStatus)}
          >
            <option value="to_read">To Read</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
        </div>

        <div className="flex-row">
          <div className="form-row flex-grow">
            <label className="label">Date started</label>
            <input
              type="date"
              className="input"
              value={dateStarted}
              onChange={e => setDateStarted(e.target.value)}
            />
          </div>
          <div className="form-row flex-grow">
            <label className="label">Date finished</label>
            <input
              type="date"
              className="input"
              value={dateFinished}
              onChange={e => setDateFinished(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="label">Rating (1–5)</label>
          <input
            type="number"
            className="input"
            min={1}
            max={5}
            value={rating}
            onChange={e => setRating(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label className="label">Comments</label>
          <textarea
            className="textarea"
            value={review ?? ''}
            onChange={e => setReview(e.target.value)}
          />
        </div>

        <button className="primary" onClick={saveLog} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>

        {error && (
          <div style={{ marginTop: '0.5rem', color: 'red' }}>{error}</div>
        )}
      </div>
    </div>
  );
};