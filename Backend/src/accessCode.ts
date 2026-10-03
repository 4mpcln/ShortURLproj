import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

let keyPromise: Promise<Buffer> | undefined;
function encryptionKey() {
  return keyPromise ??= (async () => {
    if (process.env.ACCESS_CODE_KEY !== undefined) {
      if (!/^[a-f0-9]{64}$/i.test(process.env.ACCESS_CODE_KEY)) throw new Error('Invalid access-code encryption key.');
      return Buffer.from(process.env.ACCESS_CODE_KEY, 'hex');
    }
    const path = resolve(process.env.ACCESS_CODE_KEY_FILE || '.data/access-code.key');
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    try {
      await writeFile(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    const key = await readFile(path);
    if (key.length !== 32) throw new Error('Invalid access-code encryption key.');
    return key;
  })();
}

export async function encryptAccessCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export async function decryptAccessCode(value: string) {
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', await encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}

export async function matchesAccessCode(ciphertext: string, code: string) {
  const expected = Buffer.from(await decryptAccessCode(ciphertext));
  const supplied = Buffer.from(code);
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
