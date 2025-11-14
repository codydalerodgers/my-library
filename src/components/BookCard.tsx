// src/components/BookCard.tsx
import React from 'react';
import type { Book, ReadingLog } from '../types';

interface BookCardProps {
  book: Book;
  log: ReadingLog | null;
  onClick: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, log, onClick }) => {
  const statusLabel = log?.status ?? 'to_read';
  const rating = log?.rating;

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-title">
        {book.title}
        {statusLabel && <span className="badge">{statusLabel}</span>}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
        {book.author}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
        {book.isbn && <>ISBN: {book.isbn}</>}
      </div>
      {rating && (
        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Rating:{' '}
          {'★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating))}
        </div>
      )}
    </div>
  );
};