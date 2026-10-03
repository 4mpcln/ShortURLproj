import { pool } from './db.js';
import { validateMetadata, type LinkMetadata } from './linkMetadata.js';
import { decryptAccessCode, encryptAccessCode } from './accessCode.js';

export type Tag = { id: string; name: string; color: string };

const selectLinks = `SELECT s.*, f.name AS folder_name,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
  FROM short_url_tags st JOIN tags t ON t.id = st.tag_id WHERE st.short_url_id = s.id), '[]'::jsonb) AS tags
  FROM short_urls s LEFT JOIN folders f ON f.id = s.folder_id`;

export type ShortUrl = {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
  kind: 'url' | 'qr';
  folderId: string | null;
  folderName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isPinned: boolean;
  isEnabled: boolean;
  hasAccessCode: boolean;
  tags: Tag[];
  qrOptions: { style: string; color: string; size: number } | null;
  status: 'active' | 'scheduled' | 'expired' | 'disabled';
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
  kind: 'url' | 'qr';
  folder_id: string | null;
  folder_name?: string | null;
  starts_at: Date | null;
  expires_at: Date | null;
  is_pinned: boolean;
  is_enabled: boolean;
  access_code_ciphertext: string | null;
  tags?: Tag[];
  qr_options: ShortUrl['qrOptions'];
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
    kind: row.kind,
    folderId: row.folder_id,
    folderName: row.folder_name ?? null,
    startsAt: row.starts_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    isPinned: row.is_pinned,
    isEnabled: row.is_enabled,
    hasAccessCode: Boolean(row.access_code_ciphertext),
    tags: row.tags ?? [],
    qrOptions: row.qr_options,
    status: !row.is_enabled ? 'disabled' : row.expires_at && row.expires_at <= new Date() ? 'expired' : row.starts_at && row.starts_at > new Date() ? 'scheduled' : 'active',
  };
}

export async function createShortUrl(input: {
  code: string;
  originalUrl: string;
  title?: string;
  userId?: string;
  kind?: 'url' | 'qr';
  qrOptions?: ShortUrl['qrOptions'];
} & LinkMetadata) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
  const result = await client.query<ShortUrlRow>(
    `
      INSERT INTO short_urls (code, original_url, title, user_id, kind, folder_id, starts_at, expires_at, qr_options, access_code_ciphertext)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [input.code, input.originalUrl, input.title ?? null, input.userId ?? null, input.kind ?? 'url', input.folderId ?? null, input.startsAt ?? null, input.expiresAt ?? null, input.qrOptions ?? null,
      input.accessCode ? await encryptAccessCode(input.accessCode) : null],
  );

    const id = result.rows[0].id;
    if (input.tagIds?.length) await client.query(
      'INSERT INTO short_url_tags (short_url_id, tag_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING', [id, input.tagIds],
    );
    const saved = await client.query<ShortUrlRow>(`${selectLinks} WHERE s.id = $1`, [id]);
    await client.query('COMMIT');
    return mapRow(saved.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function findByCode(code: string) {
  const result = await pool.query<ShortUrlRow>(`${selectLinks} WHERE s.code = $1`, [
    code,
  ]);

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listShortUrls(limit = 20) {
  const result = await pool.query<ShortUrlRow>(
    `${selectLinks} WHERE s.user_id IS NULL AND s.access_code_ciphertext IS NULL ORDER BY s.created_at DESC LIMIT $1`,
    [limit],
  );

  return result.rows.map(mapRow);
}

export async function registerClick(code: string, verifiedCiphertext: string | null = null) {
  const result = await pool.query<ShortUrlRow>(
    `
      WITH accessed AS (
        UPDATE short_urls SET click_count = click_count + 1, last_clicked_at = NOW(), updated_at = NOW()
        WHERE code = $1 AND is_enabled AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
          AND (access_code_ciphertext IS NULL OR access_code_ciphertext = $2)
        RETURNING *
      ), logged AS (
        INSERT INTO click_logs (short_url_id) SELECT id FROM accessed RETURNING short_url_id
      ) SELECT * FROM accessed
    `,
    [code, verifiedCiphertext],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listUserShortUrls(userId: string) {
  const result = await pool.query<ShortUrlRow>(
    `${selectLinks} WHERE s.user_id = $1 ORDER BY s.is_pinned DESC, s.created_at DESC LIMIT 500`, [userId],
  );
  return result.rows.map(mapRow);
}

export async function findOwnedLink(id: string, userId: string) {
  const result = await pool.query<ShortUrlRow>(`${selectLinks} WHERE s.id = $1 AND s.user_id = $2`, [id, userId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function findAccessCodeCiphertext(code: string) {
  const result = await pool.query<{ access_code_ciphertext: string | null }>('SELECT access_code_ciphertext FROM short_urls WHERE code=$1', [code]);
  return result.rows[0]?.access_code_ciphertext ?? null;
}

export async function findOwnedAccessCode(id: string, userId: string) {
  const result = await pool.query<{ access_code_ciphertext: string | null }>('SELECT access_code_ciphertext FROM short_urls WHERE id=$1 AND user_id=$2', [id, userId]);
  const value = result.rows[0]?.access_code_ciphertext;
  return value ? decryptAccessCode(value) : null;
}

export async function updateOwnedLink(id: string, userId: string, input: { originalUrl?: string; title?: string; isEnabled?: boolean } & LinkMetadata) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<ShortUrlRow>(`${selectLinks} WHERE s.id=$1 AND s.user_id=$2 FOR UPDATE OF s`, [id, userId]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return null; }
    const current = mapRow(existing.rows[0]);
    const metadata: LinkMetadata = {
      tagIds: input.tagIds ?? current.tags.map(tag => tag.id),
      folderId: input.folderId === undefined ? current.folderId : input.folderId,
      startsAt: input.startsAt === undefined ? current.startsAt : input.startsAt,
      expiresAt: input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
    };
    // Validate the merged schedule while holding the row lock, including partial edits.
    await validateMetadata(metadata, userId, client);
    await client.query(`UPDATE short_urls SET original_url=$1,title=$2,folder_id=$3,starts_at=$4,expires_at=$5,is_enabled=$8,updated_at=NOW()
      WHERE id=$6 AND user_id=$7`, [input.originalUrl ?? current.originalUrl, input.title === undefined ? current.title : input.title || null,
      metadata.folderId, metadata.startsAt, metadata.expiresAt, id, userId, input.isEnabled ?? current.isEnabled]);
    if (input.accessCode !== undefined) {
      await client.query('UPDATE short_urls SET access_code_ciphertext=$1 WHERE id=$2 AND user_id=$3',
        [input.accessCode ? await encryptAccessCode(input.accessCode) : null, id, userId]);
    }
    if (input.tagIds !== undefined) {
      await client.query('DELETE FROM short_url_tags WHERE short_url_id=$1', [id]);
      if (input.tagIds.length) await client.query('INSERT INTO short_url_tags (short_url_id,tag_id) SELECT $1,unnest($2::uuid[]) ON CONFLICT DO NOTHING', [id, input.tagIds]);
    }
    const saved = await client.query<ShortUrlRow>(`${selectLinks} WHERE s.id=$1 AND s.user_id=$2`, [id, userId]);
    await client.query('COMMIT');
    return mapRow(saved.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function deleteOwnedLink(id: string, userId: string) {
  const result = await pool.query('DELETE FROM short_urls WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId]);
  return Boolean(result.rowCount);
}
