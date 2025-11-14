// src/components/BookCard.tsx
import React, { useState } from 'react';
import type { Book, ReadingLog } from '../types';

interface BookCardProps {
  book: Book;
  log: ReadingLog | null;
  onClick: () => void;
}

const getCoverUrl = (book: Book): string | null => {
  if (book.cover_url && book.cover_url.trim().length > 0) {
    return book.cover_url;
  }
  if (book.isbn && book.isbn.trim().length > 0) {
    const digits = book.isbn.replace(/[^\dX]/gi, '');
    if (digits) {
      // Open Library cover fallback
      return `https://covers.openlibrary.org/b/isbn/${digits}-M.jpg`;
    }
  }
  return null;
};

export const BookCard: React.FC<BookCardProps> = ({ book, log, onClick }) => {
  const status = log?.status ?? null;
  const rating = log?.rating ?? null;
  const [hideImage, setHideImage] = useState(false);

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

  const coverUrl = !hideImage ? getCoverUrl(book) : null;

  return (
    <div className="card clickable book-card" onClick={onClick}>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={book.title}
          className="book-cover"
          loading="lazy"
          onError={() => setHideImage(true)}
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