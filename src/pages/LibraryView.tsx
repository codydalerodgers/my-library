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

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  logs,
  onSelectBook,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookStatus>('all');
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
        return { book, log, status, rating };
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
    if (statusFilter !== 'all') {
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

  return (
    <div>
      <h2>Your library</h2>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <input
          className="input"
          style={{ flex: '1 1 180px' }}
          placeholder="Search by title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | BookStatus)
          }
        >
          <option value="all">All statuses</option>
          <option value="to_read">To read</option>
          <option value="reading">Reading</option>
          <option value="finished">Finished</option>
        </select>

        <select
          className="select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="title">Sort by title</option>
          <option value="author">Sort by author</option>
          <option value="created_at">Sort by date added</option>
          <option value="rating">Sort by rating</option>
        </select>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
          }
        >
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
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