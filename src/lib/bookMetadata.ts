// src/lib/bookMetadata.ts

export interface BookMetadata {
  isbn: string;
  title: string | null;
  author: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
}

/**
 * Strip everything except digits and X/x.
 */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '');
}

/**
 * Given an ISBN (10 or 13), produce a small set of candidate forms
 * (e.g. the 10-digit equivalent of a 13-digit 978… ISBN).
 */
export function getIsbnCandidates(raw: string): string[] {
  const digits = normalizeIsbn(raw);
  if (!digits) return [];

  const candidates = new Set<string>();
  candidates.add(digits);

  // If we have an ISBN-10, add a 13-digit 978-prefixed variant.
  if (digits.length === 10) {
    const core = '978' + digits.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < core.length; i++) {
      const d = Number(core[i]);
      sum += d * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    candidates.add(core + String(check));
  }

  // If we have a 978… ISBN-13, add an ISBN-10 equivalent.
  if (digits.length === 13 && digits.startsWith('978')) {
    const core = digits.slice(3, 12);
    if (/^\d{9}$/.test(core)) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        const d = Number(core[i]);
        sum += d * (10 - i);
      }
      const remainder = sum % 11;
      const check = 11 - remainder;
      let checkDigit: string;
      if (check === 10) checkDigit = 'X';
      else if (check === 11) checkDigit = '0';
      else checkDigit = String(check);
      candidates.add(core + checkDigit);
    }
  }

  return Array.from(candidates);
}

const cleanUrl = (url: string) => url.replace(/^http:\/\//i, 'https://');

/**
 * Open Library API (data + cover).
 */
async function fetchFromOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  try {
    const apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;

    const data = await res.json();
    const entry = data[`ISBN:${isbn}`];
    if (!entry) return null;

    const title: string | undefined = entry.title;
    const authorsArr: { name?: string }[] | undefined = entry.authors;
    const author =
      authorsArr && authorsArr.length > 0
        ? authorsArr
            .map((a) => a.name)
            .filter(Boolean)
            .join(', ')
        : null;

    const pages: number | undefined = entry.number_of_pages;

    const descriptionRaw: string | null =
      typeof entry.description === 'string'
        ? entry.description
        : entry.description?.value ?? null;

    // Prefer embedded covers; if missing, fall back to the covers service,
    // but only if it actually exists (HEAD request).
    let coverUrl: string | null =
      entry.cover?.large || entry.cover?.medium || entry.cover?.small || null;

    if (!coverUrl) {
      const candidate = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
      try {
        const head = await fetch(candidate, { method: 'HEAD' });
        if (head.ok) {
          coverUrl = candidate;
        }
      } catch {
        // ignore, leave coverUrl as null
      }
    }

    return {
      isbn,
      title: title ?? null,
      author,
      pageCount: pages ?? null,
      description: descriptionRaw,
      coverUrl: coverUrl ? cleanUrl(coverUrl) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Google Books fallback.
 */
async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  try {
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    const res = await fetch(gbUrl);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return null;
    }

    const info = data.items[0].volumeInfo;
    if (!info) return null;

    const img =
      info.imageLinks?.large ||
      info.imageLinks?.medium ||
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail ||
      info.imageLinks?.small;

    return {
      isbn,
      title: info.title ?? null,
      author: Array.isArray(info.authors)
        ? info.authors.join(', ')
        : null,
      pageCount: info.pageCount ?? null,
      description: info.description ?? null,
      coverUrl: img ? cleanUrl(img) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Main entrypoint: best-effort metadata lookup (Open Library → Google Books).
 */
export async function fetchBookMetadata(
  rawIsbn: string,
): Promise<BookMetadata | null> {
  const digits = normalizeIsbn(rawIsbn);
  if (!digits) return null;

  const candidates = getIsbnCandidates(digits);

  // 1) Try Open Library on each candidate
  for (const candidate of candidates) {
    const meta = await fetchFromOpenLibrary(candidate);
    if (meta && meta.title) {
      return meta;
    }
  }

  // 2) Fallback: Google Books on the primary digits
  const gbMeta = await fetchFromGoogleBooks(digits);
  if (gbMeta && gbMeta.title) {
    return gbMeta;
  }

  return null;
}

/**
 * Convenience helper when you only care about the cover URL.
 */
export async function fetchCoverUrl(rawIsbn: string): Promise<string | null> {
  const meta = await fetchBookMetadata(rawIsbn);
  return meta?.coverUrl ?? null;
}