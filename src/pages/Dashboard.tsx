// src/pages/Dashboard.tsx
import React from 'react';
import type { Book, ReadingLog } from '../types';

interface DashboardProps {
  books: Book[];
  logs: ReadingLog[];
}

export const Dashboard: React.FC<DashboardProps> = ({ books, logs }) => {
  const totalBooks = books.length;
  const finished = logs.filter(l => l.status === 'finished').length;
  const reading = logs.filter(l => l.status === 'reading').length;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="card">
        <div>Total books: {totalBooks}</div>
        <div>Finished: {finished}</div>
        <div>Currently reading: {reading}</div>
      </div>
    </div>
  );
};