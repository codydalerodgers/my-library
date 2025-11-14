// src/pages/LibraryView.tsx
import React, { useMemo, useState } from 'react';
import type { Book, ReadingLog, BookStatus } from '../types';
import { BookCard } from '../components/BookCard';

interface LibraryViewProps {
  books: Book[];
  logs: ReadingLog[];
  onSelectBook: (book: Book) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  logs,
  onSelectBook,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all');

  const logsByBookId = useMemo(() => {
    const map = new Map<string, ReadingLog>();
    logs.forEach(log => {
      map.set(log.book_id, log); // assume 1 most-recent log per book
    });
    return map;
  }, [logs]);

  const filteredBooks = books.filter(book => {
    const log = logsByBookId.get(book.id);
    const matchesSearch =
      book.title.toLowerCase().includes(search.toLowerCase()) ||
      (book.author?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      (book.isbn ?? '').includes(search.trim());

    const matchesStatus =
      statusFilter === 'all' ? true : (log?.status ?? 'to_read') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <h2>Library</h2>
      <div className="form-row">
        <input
          className="input"
          placeholder="Search by title, author, or ISBN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="form-row">
        <label className="label">Filter by status</label>
        <select
          className="select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="to_read">To Read</option>
          <option value="reading">Reading</option>
          <option value="finished">Finished</option>
        </select>
      </div>

      {filteredBooks.map(book => (
        <BookCard
          key={book.id}
          book={book}
          log={logsByBookId.get(book.id) ?? null}
          onClick={() => onSelectBook(book)}
        />
      ))}

      {filteredBooks.length === 0 && (
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          No books match your filters.
        </p>
      )}
    </div>
  );
};