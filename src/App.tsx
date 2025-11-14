// src/App.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

import { LibraryView } from "./pages/LibraryView";
import { ScanView } from "./pages/ScanView";
import { Dashboard } from "./pages/Dashboard";
import { BookDetail } from "./pages/BookDetail";

import type { Book, ReadingLog } from "./types";

export const App: React.FC = () => {
  // ===== Global App State =====
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);

  const [view, setView] = useState<"library" | "scan" | "detail" | "dashboard">(
    "library"
  );

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Toast banner (success message)
  const [banner, setBanner] = useState<string | null>(null);

  // =====================================================================
  // 1. INITIAL LOGIN SESSION AND DATA LOADING
  // =====================================================================
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLoadingSession(false);

      if (session?.user?.id) {
        await loadLibraryData(session.user.id);
      }
    };

    init();

    supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        loadLibraryData(newSession.user.id);
      }
    });
  }, []);

  const loadLibraryData = async (userId: string) => {
    // Load Books
    const { data: booksData, error: booksErr } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!booksErr && booksData) {
      setBooks(booksData);
    }

    // Load Reading Logs
    const { data: logsData, error: logsErr } = await supabase
      .from("reading_logs")
      .select("*")
      .eq("user_id", userId);

    if (!logsErr && logsData) {
      setReadingLogs(logsData);
    }
  };

  // =====================================================================
  // 2. SCAN HANDLER (CALLED BY ScanView)
  // =====================================================================
  const handleBookFoundFromScan = (book: Book | null, _isbn: string) => {
    if (!book) return;

    // Does book already exist in local state?
    const exists = books.some((b) => b.id === book.id);

    if (exists) {
      // Existing book → open Detail view
      setSelectedBook(book);
      setView("detail");
    } else {
      // New book → insert in local list, return to Library, show toast banner
      setBooks((prev) => [book, ...prev]);
      setSelectedBook(book);
      setView("library");

      setBanner("Book successfully added!");
      setTimeout(() => setBanner(null), 2500);
    }
  };

  // =====================================================================
  // 3. BOOK DETAIL UPDATES (NOTES, STATUS, DATES, etc.)
  // =====================================================================
  const handleLogUpdated = (updatedLog: ReadingLog | null) => {
    if (!selectedBook) return;

    setReadingLogs((prev) => {
      const idx = prev.findIndex(
        (l) => l.book_id === selectedBook.id && l.user_id === selectedBook.user_id
      );
      if (idx === -1) {
        return updatedLog ? [...prev, updatedLog] : prev;
      } else {
        const copy = [...prev];
        if (updatedLog) copy[idx] = updatedLog;
        return copy;
      }
    });
  };

  // =====================================================================
  // 4. LOGIN / LOGOUT HANDLERS
  // =====================================================================
  const signIn = async (email: string) => {
    await supabase.auth.signInWithOtp({ email });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setView("library");
    setBooks([]);
    setReadingLogs([]);
  };

  // =====================================================================
  // 5. MAIN UI
  // =====================================================================

  if (loadingSession) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <h2>Sign In</h2>
        <p>Enter your email to receive a login link.</p>

        <EmailLoginForm onSubmit={signIn} />

        <p className="muted">You’ll receive a magic link to sign in.</p>
      </div>
    );
  }

  // ACTUAL LOGGED-IN VIEW
  return (
    <div className="app-shell">
      {/* =======================
          SUCCESS BANNER
      ======================== */}
      {banner && <div className="toast-banner">{banner}</div>}

      {/* =======================
          HEADER NAVIGATION
      ======================== */}
      <header className="app-header">
        <button
          className={`nav-btn ${view === "library" ? "active" : ""}`}
          onClick={() => setView("library")}
        >
          Library
        </button>
        <button
          className={`nav-btn ${view === "scan" ? "active" : ""}`}
          onClick={() => setView("scan")}
        >
          Scan
        </button>
        <button
          className={`nav-btn ${view === "dashboard" ? "active" : ""}`}
          onClick={() => setView("dashboard")}
        >
          Dashboard
        </button>

        <button className="nav-btn small red" onClick={signOut}>
          Sign out
        </button>
      </header>

      {/* =======================
          MAIN VIEW
      ======================== */}
      <main className="app-main">
        {view === "library" && (
          <LibraryView
            books={books}
            logs={readingLogs}
            onSelectBook={(book) => {
              setSelectedBook(book);
              setView("detail");
            }}
          />
        )}

        {view === "scan" && (
          <ScanView
            onBookFound={handleBookFoundFromScan}
            onBack={() => setView("library")}
          />
        )}

        {view === "detail" && selectedBook && (
          <BookDetail
            book={selectedBook}
            initialLog={
              readingLogs.find(
                (l) =>
                  l.book_id === selectedBook.id &&
                  l.user_id === selectedBook.user_id
              ) ?? null
            }
            onLogUpdated={handleLogUpdated}
          />
        )}

        {view === "dashboard" && (
          <Dashboard books={books} logs={readingLogs} />
        )}
      </main>
    </div>
  );
};

// =====================================================================
// SIMPLE EMAIL LOGIN FORM (so App.tsx is self-contained)
// =====================================================================
const EmailLoginForm: React.FC<{ onSubmit: (email: string) => void }> = ({
  onSubmit,
}) => {
  const [email, setEmail] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email);
      }}
    >
      <input
        type="email"
        className="input"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="primary" type="submit">
        Send Magic Link
      </button>
    </form>
  );
};