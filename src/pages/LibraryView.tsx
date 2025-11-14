// src/pages/LibraryView.tsx
import React, { useMemo, useState } from 'react';
import type { Book, ReadingLog } from '../types';

interface LibraryViewProps {
  books: Book[];
  logs: ReadingLog[];
  onSelectBook: (book: Book) => void;
}

type Filter = 'all' | 'reading' | 'finished' | 'unread' | 'recent';

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  logs,
  onSelectBook,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const getLogForBook = (book: Book): ReadingLog | undefined =>
    logs.find((l) => l.book_id === book.id && l.user_id === book.user_id);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = [...books];

    // Search
    if (q) {
      result = result.filter((b) => {
        const haystack = `${b.title ?? ''} ${b.author ?? ''} ${b.isbn ?? ''}`
          .toLowerCase()
          .trim();
        return haystack.includes(q);
      });
    }

    // Status filters
    if (filter !== 'all' && filter !== 'recent') {
      result = result.filter((b) => {
        const log = getLogForBook(b);

        if (filter === 'reading') {
          return log?.status === 'reading';
        }

        if (filter === 'finished') {
          return log?.status === 'finished';
        }

        if (filter === 'unread') {
          // Unread = no log OR status not reading/finished
          if (!log) return true;
          return log.status !== 'reading' && log.status !== 'finished';
        }

        return true;
      });
    }

    // Sorting
    if (filter === 'recent') {
      // Recently added: newest created_at first
      result.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    } else {
      // Default: A–Z by title
      result.sort((a, b) => {
        const at = (a.title ?? '').toLowerCase();
        const bt = (b.title ?? '').toLowerCase();
        return at.localeCompare(bt);
      });
    }

    return result;
  }, [books, logs, filter, query]);

  return (
    <div className="library-view">
      <div className="library-header">
        <div>
          <h2>Your library</h2>
          <p className="muted">
            {books.length === 0
              ? 'Scan a book to get started.'
              : `${books.length} book${books.length === 1 ? '' : 's'} in your collection`}
          </p>
        </div>

        <div className="library-controls">
          <input
            className="input"
            type="search"
            placeholder="Search by title, author, or ISBN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-row">
        <button
          type="button"
          className={`chip ${filter === 'all' ? 'chip-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`chip ${filter === 'reading' ? 'chip-active' : ''}`}
          onClick={() => setFilter('reading')}
        >
          Reading
        </button>
        <button
          type="button"
          className={`chip ${filter === 'finished' ? 'chip-active' : ''}`}
          onClick={() => setFilter('finished')}
        >
          Finished
        </button>
        <button
          type="button"
          className={`chip ${filter === 'unread' ? 'chip-active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread
        </button>
        <button
          type="button"
          className={`chip ${filter === 'recent' ? 'chip-active' : ''}`}
          onClick={() => setFilter('recent')}
        >
          Recently added
        </button>
      </div>

      <div className="book-grid">
        {filteredBooks.length === 0 ? (
          <p className="muted" style={{ marginTop: '1rem' }}>
            No books match this view yet.
          </p>
        ) : (
          filteredBooks.map((book) => {
            const log = getLogForBook(book);
            const rating = log?.rating ?? null;

            let statusLabel = 'Unread';
            if (log) {
              if (log.status === 'finished') statusLabel = 'Finished';
              else if (log.status === 'reading') statusLabel = 'Reading';
              else statusLabel = 'Unread';
            }

            const initials =
              (book.title || '')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || '?';

            return (
              <button
                key={book.id}
                type="button"
                className="book-card"
                onClick={() => onSelectBook(book)}
              >
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {/* Cover */}
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title ?? 'Book cover'}
                      className="book-cover"
                    />
                  ) : (
                    <div className="book-cover fallback">
                      {initials}
                    </div>
                  )}

                  {/* Main content */}
                  <div className="book-card-main">
                    <div className="book-card-header">
                      <div>
                        <h3 className="book-title">{book.title}</h3>
                        {book.author && (
                          <p className="book-author">{book.author}</p>
                        )}
                      </div>
                    </div>

                    {/* Rating stars (if any) */}
                    {rating != null && (
                      <div className="book-card-rating">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={
                              i < rating ? 'star star-filled' : 'star'
                            }
                          >
                            ★
                          </span>
                        ))}
                        <span className="rating-number muted">
                          {rating.toFixed(1).replace(/\.0$/, '')}
                        </span>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="book-card-meta">
                      {book.isbn && (
                        <span className="badge book-isbn">
                          ISBN {book.isbn}
                        </span>
                      )}
                      <span className="badge badge-soft">{statusLabel}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};