export type BookStatus = 'to_read' | 'reading' | 'finished';

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  page_count: number | null;
  description: string | null;
  created_at: string;
}

export interface ReadingLog {
  id: string;
  user_id: string;
  book_id: string;

  // Include all valid statuses
  status:
    | 'not_started'
    | 'to_read'
    | 'reading'
    | 'finished'
    | 'paused'
    | 'abandoned';

  rating: number | null;

  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
}