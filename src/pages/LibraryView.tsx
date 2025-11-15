// src/pages/LibraryView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { Book, ReadingLog } from '../types';
import { supabase } from '../lib/supabaseClient';
import { fetchCoverUrl } from '../lib/bookMetadata';

interface LibraryViewProps {
  books: Book[];
  logs: ReadingLog[];
  onSelectBook: (book: Book) => void;
}

type Filter = 'all' | 'reading' | 'finished' | 'unread';
type SortMode = 'recent' | 'title' | 'author' | 'rating';

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  logs,
  onSelectBook,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [query, setQuery] = useState('');

  // Local copy so we can update cover_url when we discover new covers
  const [bookList, setBookList] = useState<Book[]>(books);

  useEffect(() => {
    setBookList(books);
  }, [books]);

  const getLogForBook = (book: Book): ReadingLog | undefined =>
    logs.find((l) => l.book_id === book.id && l.user_id === book.user_id);

  // 🔍 Backfill covers for books with ISBN but no cover_url
  useEffect(() => {
    let cancelled = false;

    async function backfillCovers() {
      // Only consider books with ISBN and no cover
      const missing = bookList.filter(
        (b) => !b.cover_url && b.isbn && b.isbn.trim().length > 0,
      );

      // Don't hammer the API: process at most 5 at a time
      const batch = missing.slice(0, 5);
      if (batch.length === 0) return;

      for (const book of batch) {
        if (cancelled) return;

        const url = await fetchCoverUrl(book.isbn as string);
        if (!url) continue;

        // Update Supabase so it persists
        try {
          await supabase
            .from('books')
            .update({ cover_url: url })
            .eq('id', book.id);
        } catch {
          // ignore db error – user still has fallback initials
        }

        // Optimistically update local state so Cody sees the cover immediately
        setBookList((prev) =>
          prev.map((b) =>
            b.id === book.id ? { ...b, cover_url: url } : b,
          ),
        );
      }
    }

    backfillCovers();

    return () => {
      cancelled = true;
    };
  }, [bookList]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = [...bookList];

    // 1) Search
    if (q) {
      result = result.filter((b) => {
        const haystack = `${b.title ?? ''} ${b.author ?? ''} ${b.isbn ?? ''}`
          .toLowerCase()
          .trim();
        return haystack.includes(q);
      });
    }

    // 2) Status filters
    if (filter !== 'all') {
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

    // 3) Sorting
    result.sort((a, b) => {
      const logA = getLogForBook(a);
      const logB = getLogForBook(b);

      switch (sortMode) {
        case 'title': {
          const at = (a.title ?? '').toLowerCase();
          const bt = (b.title ?? '').toLowerCase();
          return at.localeCompare(bt);
        }
        case 'author': {
          const aa = (a.author ?? '').toLowerCase();
          const ba = (b.author ?? '').toLowerCase();
          return aa.localeCompare(ba);
        }
        case 'rating': {
          const ra = logA?.rating ?? 0;
          const rb = logB?.rating ?? 0;
          if (rb !== ra) return rb - ra; // highest rating first
          const at = (a.title ?? '').toLowerCase();
          const bt = (b.title ?? '').toLowerCase();
          return at.localeCompare(bt);
        }
        case 'recent':
        default: {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          // Newest first
          if (db !== da) return db - da;
          const at = (a.title ?? '').toLowerCase();
          const bt = (b.title ?? '').toLowerCase();
          return at.localeCompare(bt);
        }
      }
    });

    return result;
  }, [bookList, logs, filter, sortMode, query]);

  return (
    <div className="library-view">
      <div className="library-header">
        <div>
          <h2>Your library</h2>
          <p className="muted">
            {bookList.length === 0
              ? 'Scan a book to get started.'
              : `${bookList.length} book${bookList.length === 1 ? '' : 's'} in your collection`}
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
          <select
            className="select sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="recent">Recently added</option>
            <option value="title">Title (A–Z)</option>
            <option value="author">Author (A–Z)</option>
            <option value="rating">Rating (high → low)</option>
          </select>
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