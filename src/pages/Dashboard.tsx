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

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
      logsByBook.set(String(log.book_id), log);
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

    const finishedThisYearCount = finishedLogs.filter((log) => {
      const d = parseDate((log as any).finished_at);
      return d && d.getFullYear() === thisYear;
    }).length;

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
        const fd = parseDate((log as any).finished_at);
        return fd && fd.getFullYear() === year && fd.getMonth() === d.getMonth();
      }).length;

      monthlyFinished.push({ label: month, count });
    }

    // Currently reading list
    const currentlyReading = allWithLogs
      .filter(({ log }) => (log as any).status === 'reading')
      .sort((a, b) => {
        const aDate = parseDate((a.log as any).started_at)?.getTime() ?? 0;
        const bDate = parseDate((b.log as any).started_at)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(0, 5);

    // Recently finished list
    const recentlyFinished = allWithLogs
      .filter(({ log }) => (log as any).status === 'finished')
      .sort((a, b) => {
        const aDate = parseDate((a.log as any).finished_at)?.getTime() ?? 0;
        const bDate = parseDate((b.log as any).finished_at)?.getTime() ?? 0;
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

  const maxMonthly = monthlyFinished.reduce(
    (max, m) => (m.count > max ? m.count : max),
    0,
  );

  const maxRatingCount = ratingCounts.reduce(
    (max, n) => (n > max ? n : max),
    0,
  );

  // If you have zero data, show a gentle empty state
  const hasAnyData = books.length > 0 || logs.length > 0;

  return (
    <div className="dashboard">
      {!hasAnyData && (
        <div className="card dashboard-empty">
          <h2>Your reading dashboard</h2>
          <p className="muted">
            Once you start scanning books and logging your reading, this view
            will come alive with stats and insights.
          </p>
        </div>
      )}

      {hasAnyData && (
        <>
          {/* Top KPI cards */}
          <section className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-icon">📚</div>
              <div className="stat-kpi">{totalBooks}</div>
              <div className="stat-label">Total books</div>
              <div className="stat-sub">
                {toReadCount} to read • {readingCount} reading • {finishedCount} finished
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-kpi">
                {finishedThisYearCount}
              </div>
              <div className="stat-label">Finished this year</div>
              <div className="stat-sub">
                {thisYear}
              </div>
            </div>

            <div className="stat-card stat-card-accent">
              <div className="stat-icon">⭐</div>
              <div className="stat-kpi">
                {averageRating === null ? '—' : averageRating.toFixed(1)}
              </div>
              <div className="stat-label">Average rating</div>
              <div className="stat-sub">
                {averageRating === null
                  ? 'No ratings yet'
                  : 'Based on your reading logs'}
              </div>
            </div>
          </section>

          {/* Timeline + rating distro */}
          <section className="dashboard-grid dashboard-grid-2col">
            {/* Timeline */}
            <div className="card dashboard-panel">
              <div className="panel-header">
                <div>
                  <h3>Recent reading timeline</h3>
                  <p className="muted">
                    Finished books per month (last 6 months)
                  </p>
                </div>
              </div>
              <div className="timeline">
                {monthlyFinished.map((m) => {
                  const height =
                    maxMonthly === 0
                      ? 4
                      : 6 + Math.round((m.count / maxMonthly) * 40);
                  return (
                    <div key={m.label} className="timeline-col">
                      <div
                        className="timeline-bar"
                        style={{ height: `${height}px` }}
                      >
                        <div className="timeline-bar-inner" />
                      </div>
                      <div className="timeline-count">
                        {m.count > 0 ? m.count : ''}
                      </div>
                      <div className="timeline-label">{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rating distribution */}
            <div className="card dashboard-panel">
              <div className="panel-header">
                <div>
                  <h3>Rating distribution</h3>
                  <p className="muted">
                    How you&apos;ve rated your books so far
                  </p>
                </div>
              </div>
              <div className="rating-distribution">
                {ratingCounts.map((count, idx) => {
                  const ratingValue = idx + 1;
                  const width =
                    maxRatingCount === 0
                      ? 0
                      : Math.max(
                          8,
                          Math.round((count / maxRatingCount) * 88),
                        );
                  return (
                    <div key={ratingValue} className="rating-row">
                      <div className="rating-label">
                        {ratingValue} ⭐
                      </div>
                      <div className="rating-bar">
                        <div
                          className="rating-bar-fill"
                          style={{ width: `${width}%`, opacity: count ? 1 : 0.25 }}
                        />
                      </div>
                      <div className="rating-count">
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Lists: currently reading & recently finished */}
          <section className="dashboard-grid dashboard-grid-2col">
            <div className="card dashboard-panel">
              <div className="panel-header">
                <div>
                  <h3>Currently reading</h3>
                  <p className="muted">
                    The books you&apos;re in the middle of right now
                  </p>
                </div>
              </div>
              {currentlyReading.length === 0 && (
                <p className="muted small-text">
                  You have no books marked as &quot;reading&quot; yet.
                </p>
              )}
              {currentlyReading.length > 0 && (
                <ul className="book-list">
                  {currentlyReading.map(({ book, log }) => {
                    const started = parseDate((log as any).started_at);
                    const startedLabel = started
                      ? started.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—';
                    const rating = (log as any).rating as number | null | undefined;

                    return (
                      <li key={book.id} className="book-list-item">
                        <div className="book-list-main">
                          <div className="book-list-title">
                            {book.title || 'Untitled'}
                          </div>
                          {book.author && (
                            <div className="book-list-author">{book.author}</div>
                          )}
                          <div className="book-list-meta">
                            <span className="pill">Started {startedLabel}</span>
                            {rating && (
                              <span className="pill pill-soft">
                                {rating.toFixed(1)} ⭐
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="card dashboard-panel">
              <div className="panel-header">
                <div>
                  <h3>Recently finished</h3>
                  <p className="muted">
                    The last few books you completed
                  </p>
                </div>
              </div>
              {recentlyFinished.length === 0 && (
                <p className="muted small-text">
                  Once you mark books as finished, they&apos;ll show up here.
                </p>
              )}
              {recentlyFinished.length > 0 && (
                <ul className="book-list">
                  {recentlyFinished.map(({ book, log }) => {
                    const finished = parseDate((log as any).finished_at);
                    const finishedLabel = finished
                      ? finished.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—';
                    const rating = (log as any).rating as number | null | undefined;

                    return (
                      <li key={book.id} className="book-list-item">
                        <div className="book-list-main">
                          <div className="book-list-title">
                            {book.title || 'Untitled'}
                          </div>
                          {book.author && (
                            <div className="book-list-author">{book.author}</div>
                          )}
                          <div className="book-list-meta">
                            <span className="pill">Finished {finishedLabel}</span>
                            {rating && (
                              <span className="pill pill-soft">
                                {rating.toFixed(1)} ⭐
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}