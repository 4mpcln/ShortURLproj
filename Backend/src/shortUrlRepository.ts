import { pool } from './db.js';

export type ShortUrl = {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ShortUrlRow = {
  id: string;
  code: string;
  original_url: string;
  title: string | null;
  click_count: number;
  last_clicked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: ShortUrlRow): ShortUrl {
  return {
    id: row.id,
    code: row.code,
    originalUrl: row.original_url,
    title: row.title,
    clickCount: row.click_count,
    lastClickedAt: row.last_clicked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createShortUrl(input: {
  code: string;
  originalUrl: string;
  title?: string;
}) {
  const result = await pool.query<ShortUrlRow>(
    `
      INSERT INTO short_urls (code, original_url, title)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [input.code, input.originalUrl, input.title ?? null],
  );

  return mapRow(result.rows[0]);
}

export async function findByCode(code: string) {
  const result = await pool.query<ShortUrlRow>('SELECT * FROM short_urls WHERE code = $1', [
    code,
  ]);

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listShortUrls(limit = 20) {
  const result = await pool.query<ShortUrlRow>(
    'SELECT * FROM short_urls ORDER BY created_at DESC LIMIT $1',
    [limit],
  );

  return result.rows.map(mapRow);
}

export async function registerClick(code: string) {
  const result = await pool.query<ShortUrlRow>(
    `
      UPDATE short_urls
      SET click_count = click_count + 1,
          last_clicked_at = NOW(),
          updated_at = NOW()
      WHERE code = $1
      RETURNING *
    `,
    [code],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
