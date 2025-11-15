// src/pages/Dashboard.tsx
import { useMemo } from 'react';
import type { Book, ReadingLog } from '../types';

type DashboardProps = {
  books: Book[];
  logs: ReadingLog[];
};

type BookWithLog = {
  book: Book;
  log: ReadingLog;
};

// Safely parse a date string
function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Get the "finished" date for a log, using your real columns
function getFinishedDate(log: ReadingLog): Date | null {
  const anyLog = log as any;
  const raw =
    (anyLog.date_finished as string | null) ||
    (anyLog.date_started as string | null); // fallback if no finished date yet
  return parseDate(raw);
}

// Just the year we consider the book "finished"
function getFinishedYear(log: ReadingLog): number | null {
  const d = getFinishedDate(log);
  return d ? d.getFullYear() : null;
}

export function Dashboard({ books, logs }: DashboardProps) {
  const now = new Date();
  const thisYear = now.getFullYear();

  const {
    totalBooks,
    toReadCount,
    readingCount,
    finishedCount,
    finishedThisYearCount,
    averageRating,
    ratingCounts,
    monthlyFinished,
    currentlyReading,
    recentlyFinished,
  } = useMemo(() => {
    const totalBooks = books.length;

    // Map logs by book_id (you have at most one per book due to the constraint)
    const logsByBook = new Map<string, ReadingLog>();
    logs.forEach((log) => {
      logsByBook.set(String((log as any).book_id), log);
    });

    const allWithLogs: BookWithLog[] = [];
    books.forEach((book) => {
      const log = logsByBook.get(String(book.id));
      if (log) {
        allWithLogs.push({ book, log });
      }
    });

    let toReadCount = 0;
    let readingCount = 0;
    let finishedCount = 0;

    const finishedLogs: ReadingLog[] = [];
    const ratedLogs: ReadingLog[] = [];
    const ratingCounts = [0, 0, 0, 0, 0]; // index 0 => ⭐, 4 => ⭐⭐⭐⭐⭐

    logs.forEach((log) => {
      const status = (log as any).status as string | null | undefined;

      if (status === 'to_read') toReadCount += 1;
      if (status === 'reading') readingCount += 1;
      if (status === 'finished') {
        finishedCount += 1;
        finishedLogs.push(log);
      }

      const rating = (log as any).rating as number | null | undefined;
      if (typeof rating === 'number' && rating > 0) {
        ratedLogs.push(log);
        const idx = Math.min(Math.max(Math.round(rating) - 1, 0), 4);
        ratingCounts[idx] += 1;
      }
    });

    const finishedThisYear = logs.filter((log) => {
      const anyLog = log as any;
      return (
        anyLog.status === 'finished' &&
        getFinishedYear(log) === thisYear
      );
    });

    const finishedThisYearCount = finishedThisYear.length;

    const averageRating =
      ratedLogs.length === 0
        ? null
        : ratedLogs.reduce((sum, log) => {
            const r = (log as any).rating as number | null | undefined;
            return sum + (typeof r === 'number' ? r : 0);
          }, 0) / ratedLogs.length;

    // Last 6 months timeline (including current month)
    const monthlyFinished: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString(undefined, { month: 'short' });
      const year = d.getFullYear();

      const count = finishedLogs.filter((log) => {
        const fd = getFinishedDate(log);
        return (
          fd &&
          fd.getFullYear() === year &&
          fd.getMonth() === d.getMonth()
        );
      }).length;

      monthlyFinished.push({ label: month, count });
    }

    // Currently reading list
    const currentlyReading = allWithLogs
      .filter(({ log }) => (log as any).status === 'reading')
      .sort((a, b) => {
        const aDate =
          parseDate((a.log as any).date_started)?.getTime() ?? 0;
        const bDate =
          parseDate((b.log as any).date_started)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(0, 5);

    // Recently finished list
    const recentlyFinished = allWithLogs
      .filter(({ log }) => (log as any).status === 'finished')
      .sort((a, b) => {
        const aDate = getFinishedDate(a.log)?.getTime() ?? 0;
        const bDate = getFinishedDate(b.log)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(0, 5);

    return {
      totalBooks,
      toReadCount,
      readingCount,
      finishedCount,
      finishedThisYearCount,
      averageRating,
      ratingCounts,
      monthlyFinished,
      currentlyReading,
      recentlyFinished,
    };
  }, [books, logs, thisYear, now]);

  const totalLogged = toReadCount + readingCount + finishedCount;
  const unlogged = totalBooks - totalLogged;

  return (
    <div className="dashboard">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Overview</h2>
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-label">Total books</div>
            <div className="stat-number">{totalBooks}</div>
            <div className="stat-sub">
              {unlogged > 0
                ? `${unlogged} without a reading log`
                : 'All books have logs'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Reading status</div>
            <div className="stat-pill-row">
              <span className="pill pill-soft">
                To read <strong>{toReadCount}</strong>
              </span>
              <span className="pill pill-soft">
                Reading <strong>{readingCount}</strong>
              </span>
              <span className="pill pill-soft">
                Finished <strong>{finishedCount}</strong>
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Finished this year</div>
            <div className="stat-number">
              {finishedThisYearCount}
            </div>
            <div className="stat-sub">
              {finishedThisYearCount === 0
                ? 'No finished books logged yet.'
                : 'Based on your reading logs.'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Average rating</div>
            <div className="stat-number">
              {averageRating ? averageRating.toFixed(1) : '—'}
            </div>
            <div className="stat-sub">
              {averageRating
                ? 'From books you’ve rated.'
                : 'No ratings yet.'}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Rating distribution</h3>
        {ratingCounts.every((c) => c === 0) ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            No ratings yet. When you rate books, you’ll see the
            distribution here.
          </p>
        ) : (
          <div className="rating-bars">
            {ratingCounts.map((count, idx) => {
              const stars = idx + 1;
              const total = ratingCounts.reduce(
                (sum, c) => sum + c,
                0,
              );
              const pct = total === 0 ? 0 : (count / total) * 100;

              return (
                <div key={stars} className="rating-row">
                  <div className="rating-label">
                    {stars}⭐
                  </div>
                  <div className="rating-bar-shell">
                    <div
                      className="rating-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="rating-count">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Finished in the last 6 months</h3>
        {monthlyFinished.every((m) => m.count === 0) ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            No finished books logged in the last 6 months.
          </p>
        ) : (
          <div className="timeline">
            {monthlyFinished.map(({ label, count }) => (
              <div key={label} className="timeline-item">
                <div className="timeline-label">{label}</div>
                <div className="timeline-bar-shell">
                  <div
                    className="timeline-bar-fill"
                    style={{
                      width: count === 0 ? '4%' : `${20 + count * 10}%`,
                    }}
                  />
                </div>
                <div className="timeline-count">{count}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="dashboard-split">
          <div className="dashboard-column">
            <h3>Currently reading</h3>
            {currentlyReading.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                No books marked as “reading” yet.
              </p>
            ) : (
              <ul className="book-list">
                {currentlyReading.map(({ book, log }) => {
                  const started = parseDate(
                    (log as any).date_started as string | null,
                  );
                  const startedLabel = started
                    ? started.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';
                  const rating = (log as any).rating as
                    | number
                    | null
                    | undefined;

                  return (
                    <li key={(log as any).id} className="book-list-item">
                      <div className="book-list-main">
                        <div className="book-title">
                          {book.title}
                        </div>
                        {book.author && (
                          <div className="book-author">
                            {book.author}
                          </div>
                        )}
                      </div>
                      <div className="book-list-meta">
                        <span className="pill pill-soft">
                          Started {startedLabel}
                        </span>
                        {rating ? (
                          <span className="pill pill-soft">
                            {rating}★
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="dashboard-column">
            <h3>Recently finished</h3>
            {recentlyFinished.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                No finished books yet. Once you mark books as
                “finished”, the most recent ones will show here.
              </p>
            ) : (
              <ul className="book-list">
                {recentlyFinished.map(({ book, log }) => {
                  const finished = getFinishedDate(log);
                  const finishedLabel = finished
                    ? finished.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';
                  const rating = (log as any).rating as
                    | number
                    | null
                    | undefined;

                  return (
                    <li key={(log as any).id} className="book-list-item">
                      <div className="book-list-main">
                        <div className="book-title">
                          {book.title}
                        </div>
                        {book.author && (
                          <div className="book-author">
                            {book.author}
                          </div>
                        )}
                      </div>
                      <div className="book-list-meta">
                        <span className="pill pill-soft">
                          Finished {finishedLabel}
                        </span>
                        {rating ? (
                          <span className="pill pill-soft">
                            {rating}★
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}