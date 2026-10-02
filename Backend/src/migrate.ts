import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, pool } from './db.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(currentDir, '..', 'db', 'migrations');

async function migrate() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
