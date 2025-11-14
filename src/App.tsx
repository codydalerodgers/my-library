// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthPage } from './pages/AuthPage';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { LibraryView } from './pages/LibraryView';
import { ScanView } from './pages/ScanView';
import { BookDetail } from './pages/BookDetail';
import type { Book, ReadingLog } from './types';

type View = 'dashboard' | 'library' | 'scan' | 'detail';

const App: React.FC = () => {
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >['data']['session'] | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [view, setView] = useState<View>('library');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch auth session on load
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUserEmail(session?.user.email ?? null);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch books + logs when session present
  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      setLoadingData(true);
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setLoadingData(false);
        return;
      }

      const { data: bookData } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: logData } = await supabase
        .from('reading_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setBooks((bookData ?? []) as Book[]);
      setLogs((logData ?? []) as ReadingLog[]);
      setLoadingData(false);
    };

    fetchData();
  }, [session]);

  const logsByBookId = useMemo(() => {
    const map = new Map<string, ReadingLog>();
    logs.forEach(l => {
      if (!map.has(l.book_id)) {
        map.set(l.book_id, l);
      }
    });
    return map;
  }, [logs]);

  const onNavigate = (next: 'library' | 'scan' | 'dashboard') => {
    setView(next);
    if (next !== 'detail') {
      setSelectedBook(null);
    }
  };

  const onSelectBook = (book: Book) => {
    setSelectedBook(book);
    setView('detail');
  };

  const onBookFoundFromScan = (book: Book | null, isbn: string) => {
    if (book) {
      setSelectedBook(book);
      setView('detail');
    } else {
      // Pre-fill a minimal "add book" form
      const title = window.prompt('Book not found. Enter title:', '');
      if (!title) return;
      const author = window.prompt('Author (optional):', '');
      (async () => {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) return;

        const { data, error } = await supabase
          .from('books')
          .insert({
            user_id: user.id,
            title,
            author: author || null,
            isbn,
          })
          .select('*')
          .single();

        if (!error && data) {
          const newBook = data as Book;
          setBooks(prev => [newBook, ...prev]);
          setSelectedBook(newBook);
          setView('detail');
        }
      })();
    }
  };

  const handleLogUpdated = (log: ReadingLog | null) => {
    if (!log) return;
    setLogs(prev => {
      const others = prev.filter(l => l.id !== log.id);
      return [log, ...others];
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBooks([]);
    setLogs([]);
  };

  if (!session) {
    return (
      <div className="app-root">
        <AuthPage />
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-container">
        <Navbar
          onNavigate={onNavigate}
          currentView={view}
          onSignOut={handleSignOut}
          userEmail={userEmail}
        />

        {loadingData && (
          <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Loading your library…</p>
        )}

        {!loadingData && view === 'dashboard' && (
          <Dashboard books={books} logs={logs} />
        )}

        {!loadingData && view === 'library' && (
          <LibraryView
            books={books}
            logs={logs}
            onSelectBook={onSelectBook}
          />
        )}

        {!loadingData && view === 'scan' && (
          <ScanView onBookFound={onBookFoundFromScan} />
        )}

        {!loadingData && view === 'detail' && selectedBook && (
          <BookDetail
            book={selectedBook}
            initialLog={logsByBookId.get(selectedBook.id) ?? null}
            onLogUpdated={handleLogUpdated}
          />
        )}
      </div>
    </div>
  );
};

export default App;