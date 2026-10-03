import { z } from 'zod';
import { pool } from './db.js';
import type { PoolClient } from 'pg';

export const metadataShape = {
  tagIds: z.array(z.string().uuid()).max(20).optional(),
  folderId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
};

export type LinkMetadata = {
  tagIds?: string[];
  folderId?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
};

export function validateSchedule(input: LinkMetadata) {
  if (input.startsAt && input.expiresAt && new Date(input.startsAt) >= new Date(input.expiresAt)) {
    const error = new Error('Closing time must be after opening time.');
    error.name = 'ValidationError';
    throw error;
  }
}

export async function validateMetadata(input: LinkMetadata, userId?: string, db: Pick<PoolClient, 'query'> = pool) {
  validateSchedule(input);
  const hasMetadata = input.tagIds?.length || input.folderId || input.startsAt || input.expiresAt;
  if (!hasMetadata) return;
  const invalid = () => { const error = new Error('Choose tags and folders belonging to your account.'); error.name = 'ValidationError'; return error; };
  if (!userId) { const error = new Error('Log in to use tags, folders and access schedules.'); error.name = 'ValidationError'; throw error; }
  if (input.folderId) {
    const result = await db.query('SELECT id FROM folders WHERE id = $1 AND user_id = $2', [input.folderId, userId]);
    if (!result.rowCount) throw invalid();
  }
  if (input.tagIds?.length) {
    const ids = [...new Set(input.tagIds)];
    const result = await db.query('SELECT id FROM tags WHERE id = ANY($1::uuid[]) AND user_id = $2', [ids, userId]);
    if (result.rowCount !== ids.length) throw invalid();
  }
}
