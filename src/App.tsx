// src/App.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

import { LibraryView } from "./pages/LibraryView";
import { ScanView } from "./pages/ScanView";
import { Dashboard } from "./pages/Dashboard";
import { BookDetail } from "./pages/BookDetail";
import { BulkScanView } from "./pages/BulkScanView";

import type { Book, ReadingLog } from "./types";

type View = "library" | "scan" | "bulk" | "detail" | "dashboard";

export const App: React.FC = () => {
  // ===== Global App State =====
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [view, setView] = useState<View>("library");
  const [books, setBooks] = useState<Book[]>([]);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // ============================================================
  // 1. AUTH + INITIAL DATA LOAD
  // ============================================================
  const loadDataForUser = async (userId: string) => {
    try {
      const { data: bookRows, error: booksError } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(0, 1999); // up to 2000 books for now

      if (!booksError && bookRows) {
        setBooks(bookRows as Book[]);
      }

      const { data: logRows, error: logsError } = await supabase
        .from("reading_logs")
        .select("*")
        .eq("user_id", userId);

      if (!logsError && logRows) {
        setReadingLogs(logRows as ReadingLog[]);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        setSession(currentSession ?? null);
        setLoadingSession(false);

        if (currentSession?.user) {
          await loadDataForUser(currentSession.user.id);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    })();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadDataForUser(newSession.user.id);
        setView("library");
      } else {
        setBooks([]);
        setReadingLogs([]);
        setSelectedBook(null);
        setView("library");
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setBooks([]);
      setReadingLogs([]);
      setSelectedBook(null);
      setView("library");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // ============================================================
  // 2. BOOK SELECTION & SCAN HANDLING
  // ============================================================
  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setView("detail");
  };

  // Called by ScanView when it finishes a scan & save
  const handleBookFoundFromScan = (book: Book | null) => {
    if (!book) {
      // e.g. scan cancelled or lookup failed – just go back to library
      setView("library");
      return;
    }

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

  // ============================================================
  // 3. BOOK DETAIL UPDATES (NOTES, STATUS, DATES, etc.)
  // ============================================================
  const handleLogUpdated = (updatedLog: ReadingLog | null) => {
    if (!selectedBook) return;

    setReadingLogs((prev) => {
      const idx = prev.findIndex(
        (l) =>
          l.book_id === selectedBook.id &&
          l.user_id === selectedBook.user_id,
      );

      if (idx === -1) {
        // No previous log – just add if we have one
        return updatedLog ? [...prev, updatedLog] : prev;
      } else {
        const copy = [...prev];
        if (updatedLog) {
          copy[idx] = updatedLog;
          return copy;
        } else {
          // If updatedLog is null, we could remove the old one, but for now just keep it.
          return copy;
        }
      }
    });
  };

  // ============================================================
  // 4. BULK SCAN CALLBACK (BLUETOOTH SCANNER MODE)
  // ============================================================
  const handleBulkBookAdded = (book: Book) => {
    // Avoid duplicates by id
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      if (exists) return prev;
      return [book, ...prev];
    });

    setBanner("Book added via bulk scan!");
    setTimeout(() => setBanner(null), 2500);
  };

  // ============================================================
  // 5. AUTH SCREENS
  // ============================================================
  if (loadingSession) {
    return (
      <div className="app-root">
        <div className="app-shell">
          <main>
            <p className="muted">Loading your library…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-root">
        <div className="app-shell">
          <main>
            <div className="auth-screen">
              <h2>Sign In</h2>
              <p>Enter your email to receive a login link.</p>
              <SignInForm />
              <p className="muted">
                You’ll receive a magic link to sign in.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ============================================================
  // 6. MAIN APP LAYOUT (LOGGED IN)
  // ============================================================
  return (
    <div className="app-root">
      <div className="app-shell">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="app-title">My Library</span>
          </div>
          <nav className="topbar-nav">
            <button
              type="button"
              className={`nav-button ${view === "library" ? "active" : ""}`}
              onClick={() => {
                setView("library");
                setSelectedBook(null);
              }}
            >
              Library
            </button>
            <button
              type="button"
              className={`nav-button ${view === "scan" ? "active" : ""}`}
              onClick={() => {
                setView("scan");
                setSelectedBook(null);
              }}
            >
              Scan (camera)
            </button>
            <button
              type="button"
              className={`nav-button ${view === "bulk" ? "active" : ""}`}
              onClick={() => {
                setView("bulk");
                setSelectedBook(null);
              }}
            >
              Bulk scan
            </button>
            <button
              type="button"
              className={`nav-button ${
                view === "dashboard" ? "active" : ""
              }`}
              onClick={() => {
                setView("dashboard");
                setSelectedBook(null);
              }}
            >
              Dashboard
            </button>
          </nav>
          <div className="topbar-right">
            <button
              type="button"
              className="secondary small"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Main content */}
        <main>
          {view === "library" && (
            <LibraryView
              books={books}
              logs={readingLogs}
              onSelectBook={handleSelectBook}
            />
          )}

          {view === "scan" && (
            <ScanView
              onBookFound={handleBookFoundFromScan}
              onBack={() => setView("library")}
            />
          )}

          {view === "bulk" && (
            <BulkScanView onBookAdded={handleBulkBookAdded} />
          )}

          {view === "detail" && selectedBook && (
            <BookDetail
              book={selectedBook}
              initialLog={
                readingLogs.find(
                  (l) =>
                    l.book_id === selectedBook.id &&
                    l.user_id === selectedBook.user_id,
                ) ?? null
              }
              onLogUpdated={handleLogUpdated}
            />
          )}

          {view === "dashboard" && (
            <Dashboard books={books} logs={readingLogs} />
          )}
        </main>

        {/* Toast banner */}
        {banner && (
          <div className="toast-banner">
            <span>✅</span>
            <span>{banner}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// STANDALONE SIGN-IN FORM
// ============================================================
const SignInForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError(null);
    setSent(false);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to send magic link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      <input
        type="email"
        className="input"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p className="muted" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
      {sent && !error && (
        <p className="muted">Magic link sent. Check your email.</p>
      )}
      <button className="primary" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send Magic Link"}
      </button>
    </form>
  );
};