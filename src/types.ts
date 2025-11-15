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
    | 'to_read'
    | 'reading'
    | 'finished';

  rating: number | null;

  date_started?: string | null;
  date_finished?: string | null;
  description?: string | null;

  created_at?: string;
  updated_at?: string;
}