// src/components/BookCard.tsx
import React from 'react';
import type { Book, ReadingLog } from '../types';

interface BookCardProps {
  book: Book;
  log: ReadingLog | null;
  onClick: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, log, onClick }) => {
  const status = log?.status ?? null;
  const rating = log?.rating ?? null;

  const statusLabel =
    status === 'reading'
      ? 'Reading'
      : status === 'finished'
      ? 'Finished'
      : status === 'to_read'
      ? 'To read'
      : 'Not started';

  const renderStars = (value: number | null) => {
    if (!value) return null;
    const full = '★'.repeat(value);
    const empty = '☆'.repeat(5 - value);
    return (
      <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
        {full}
        <span style={{ color: '#d1d5db' }}>{empty}</span>
      </span>
    );
  };

  const firstLetter =
    book.title && book.title.trim().length > 0
      ? book.title.trim()[0].toUpperCase()
      : '?';

  return (
    <div className="card clickable book-card" onClick={onClick}>
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt={book.title}
          className="book-cover"
          loading="lazy"
        />
      ) : (
        <div className="book-cover fallback">
          <span>{firstLetter}</span>
        </div>
      )}

      <div className="book-card-main">
        <div className="book-card-header">
          <div>
            <div className="book-title">{book.title || '(Untitled)'}</div>
            {book.author && (
              <div className="book-author">
                {book.author}
              </div>
            )}
          </div>
          <div className="book-badge">
            {statusLabel}
          </div>
        </div>

        <div className="book-card-meta">
          {rating && (
            <div className="book-rating">
              {renderStars(rating)}
            </div>
          )}
          {book.isbn && (
            <div className="book-isbn">
              ISBN: {book.isbn}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};