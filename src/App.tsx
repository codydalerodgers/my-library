// src/App.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

import type { Book, ReadingLog } from './types';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { LibraryView } from './pages/LibraryView';
import { ScanView } from './pages/ScanView';
import { BookDetail } from './pages/BookDetail';

type View = 'dashboard' | 'library' | 'scan' | 'detail';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const loadData = useCallback(
    async (uid: string) => {
      setLoadingData(true);
      try {
        const { data: booksData, error: booksError } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (booksError) throw booksError;

        const { data: logsData, error: logsError } = await supabase
          .from('reading_logs')
          .select('*')
          .eq('user_id', uid);

        if (logsError) throw logsError;

        setBooks(booksData || []);
        setLogs(logsData || []);
      } catch (e) {
        console.error('Error loading data', e);
      } finally {
        setLoadingData(false);
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!mounted) return;

        if (session?.user) {
          const uid = session.user.id;
          setUserId(uid);
          await loadData(uid);
        } else {
          setUserId(null);
        }
      } catch (e) {
        console.error('Error getting session', e);
        setUserId(null);
      } finally {
        if (mounted) {
          setSessionChecked(true);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const uid = session?.user?.id;
          if (uid) {
            setUserId(uid);
            await loadData(uid);
          }
        }

        if (event === 'SIGNED_OUT') {
          setUserId(null);
          setBooks([]);
          setLogs([]);
          setSelectedBook(null);
          setView('dashboard');
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadData]);

  const handleNavigate = (next: View) => {
    setView(next);
    if (next !== 'detail') {
      setSelectedBook(null);
    }
  };

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setView('detail');
  };

  const handleBookFoundFromScan = (book: Book | null, isbn: string) => {
    if (!book) return; // ScanView handles "not found" + creation
    setSelectedBook(book);
    setView('detail');
  };

  const handleDetailUpdated = (updatedBook: Book, updatedLog: ReadingLog | null) => {
    // Update books list
    setBooks((prev) =>
      prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)),
    );

    // Update logs list (insert or replace)
    if (updatedLog) {
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.id === updatedLog.id);
        if (idx === -1) {
          return [...prev, updatedLog];
        }
        const copy = [...prev];
        copy[idx] = updatedLog;
        return copy;
      });
    }

    setSelectedBook(updatedBook);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const selectedLog =
    selectedBook ? logs.find((l) => l.book_id === selectedBook.id) ?? null : null;

  // ------------- RENDER -------------

  if (!sessionChecked) {
    return (
      <div className="app-root">
        <div className="app-shell">
          <main style={{ padding: '1rem' }}>Loading…</main>
        </div>
      </div>
    );
  }

  if (!userId) {
    // Not signed in, show auth page
    return (
      <div className="app-root">
        <div className="app-shell">
          <main style={{ padding: '1rem' }}>
            <AuthPage />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <span className="app-title">My Library</span>
          </div>
          <nav className="topbar-nav">
            <button
              type="button"
              className={`nav-button ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavigate('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-button ${view === 'library' ? 'active' : ''}`}
              onClick={() => handleNavigate('library')}
            >
              Library
            </button>
            <button
              type="button"
              className={`nav-button ${view === 'scan' ? 'active' : ''}`}
              onClick={() => handleNavigate('scan')}
            >
              Scan
            </button>
          </nav>
          <div className="topbar-right">
            <button type="button" className="secondary small" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <main style={{ padding: '1rem' }}>
          {loadingData && (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Refreshing library…</p>
          )}

          {view === 'dashboard' && (
            <Dashboard
              books={books}
              logs={logs}
              onSelectBook={handleSelectBook}
            />
          )}

          {view === 'library' && (
            <LibraryView
              books={books}
              logs={logs}
              onSelectBook={handleSelectBook}
            />
          )}

          {view === 'scan' && (
            <ScanView onBookFound={handleBookFoundFromScan} />
          )}

          {view === 'detail' && selectedBook && (
            <BookDetail
              book={selectedBook}
              log={selectedLog}
              onBack={() => handleNavigate('library')}
              onUpdated={handleDetailUpdated}
            />
          )}

          {view === 'detail' && !selectedBook && (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No book selected.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;