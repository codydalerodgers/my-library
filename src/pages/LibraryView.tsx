// src/pages/LibraryView.tsx
import React, { useMemo, useState } from 'react';
import type { Book, ReadingLog, BookStatus } from '../types';
import { BookCard } from '../components/BookCard';

interface LibraryViewProps {
  books: Book[];
  logs: ReadingLog[];
  onSelectBook: (book: Book) => void;
}

type SortBy = 'title' | 'author' | 'created_at' | 'rating';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'favorite' | BookStatus;

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  logs,
  onSelectBook,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Map book_id -> latest log (by updated_at)
  const logsByBook = useMemo(() => {
    const map = new Map<string, ReadingLog>();
    for (const log of logs) {
      const existing = map.get(log.book_id);
      if (!existing) {
        map.set(log.book_id, log);
      } else {
        if (new Date(log.updated_at) > new Date(existing.updated_at)) {
          map.set(log.book_id, log);
        }
      }
    }
    return map;
  }, [logs]);

  const booksWithMeta = useMemo(
    () =>
      books.map((book) => {
        const log = logsByBook.get(book.id) ?? null;
        const status: BookStatus | null = log?.status ?? null;
        const rating: number | null = log?.rating ?? null;
        const isFavorite = (rating ?? 0) >= 4;
        return { book, log, status, rating, isFavorite };
      }),
    [books, logsByBook],
  );

  const filteredAndSorted = useMemo(() => {
    let list = booksWithMeta;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(({ book }) => {
        const t = (book.title || '').toLowerCase();
        const a = (book.author || '').toLowerCase();
        return t.includes(q) || a.includes(q);
      });
    }

    // Status filter
    if (statusFilter === 'favorite') {
      list = list.filter(({ isFavorite }) => isFavorite);
    } else if (statusFilter !== 'all') {
      list = list.filter(({ status }) => status === statusFilter);
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;

      if (sortBy === 'title') {
        const at = (a.book.title || '').toLowerCase();
        const bt = (b.book.title || '').toLowerCase();
        cmp = at.localeCompare(bt);
      } else if (sortBy === 'author') {
        const aa = (a.book.author || '').toLowerCase();
        const ba = (b.book.author || '').toLowerCase();
        cmp = aa.localeCompare(ba);
      } else if (sortBy === 'created_at') {
        const ad = new Date(a.book.created_at).getTime();
        const bd = new Date(b.book.created_at).getTime();
        cmp = ad - bd;
      } else if (sortBy === 'rating') {
        const ar = a.rating ?? 0;
        const br = b.rating ?? 0;
        cmp = ar - br;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [booksWithMeta, search, statusFilter, sortBy, sortDir]);

  const totalCount = books.length;
  const filteredCount = filteredAndSorted.length;

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
        <h2>Your library</h2>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {filteredCount} / {totalCount} books
        </span>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '0.5rem' }}>
        <input
          className="input"
          placeholder="Search by title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status chips */}
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'to_read' ? 'active' : ''}`}
          onClick={() => setStatusFilter('to_read')}
        >
          To read
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'reading' ? 'active' : ''}`}
          onClick={() => setStatusFilter('reading')}
        >
          Reading
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'finished' ? 'active' : ''}`}
          onClick={() => setStatusFilter('finished')}
        >
          Finished
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'favorite' ? 'active' : ''}`}
          onClick={() => setStatusFilter('favorite')}
        >
          ★ Favorites
        </button>
      </div>

      {/* Sort chips */}
      <div className="chip-row" style={{ marginTop: '0.35rem', marginBottom: '0.5rem' }}>
        <span className="muted" style={{ fontSize: '0.75rem' }}>
          Sort:
        </span>
        <button
          type="button"
          className={`chip ${sortBy === 'title' ? 'active' : ''}`}
          onClick={() => toggleSort('title')}
        >
          Title {sortBy === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          type="button"
          className={`chip ${sortBy === 'author' ? 'active' : ''}`}
          onClick={() => toggleSort('author')}
        >
          Author {sortBy === 'author' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          type="button"
          className={`chip ${sortBy === 'created_at' ? 'active' : ''}`}
          onClick={() => toggleSort('created_at')}
        >
          Date added {sortBy === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          type="button"
          className={`chip ${sortBy === 'rating' ? 'active' : ''}`}
          onClick={() => toggleSort('rating')}
        >
          Rating {sortBy === 'rating' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>

      {/* List */}
      {filteredAndSorted.length === 0 ? (
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          No books match your filters yet.
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {filteredAndSorted.map(({ book, log }) => (
            <BookCard
              key={book.id}
              book={book}
              log={log}
              onClick={() => onSelectBook(book)}
            />
          ))}
        </div>
      )}
    </div>
  );
};