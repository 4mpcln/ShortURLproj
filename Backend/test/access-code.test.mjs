import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { decryptAccessCode, encryptAccessCode, matchesAccessCode } from '../dist/accessCode.js';

test('access codes are authenticated ciphertext with a private key that survives process restarts', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'qlean-code-test-'));
  const keyPath = join(directory, 'access-code.key');
  process.env.ACCESS_CODE_KEY_FILE = keyPath;
  t.after(() => rm(directory, { recursive: true, force: true }));
  const encrypted = await encryptAccessCode('000007');
  assert.notEqual(encrypted, await encryptAccessCode('000007'));
  assert.equal(await decryptAccessCode(encrypted), '000007');
  assert.equal(await matchesAccessCode(encrypted, '000007'), true);
  assert.equal(await matchesAccessCode(encrypted, '000008'), false);
  assert.equal(await matchesAccessCode(encrypted, '7'), false);
  assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
  const tampered = Buffer.from(encrypted, 'base64');
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(decryptAccessCode(tampered.toString('base64')));
  const module = new URL('../dist/accessCode.js', import.meta.url).href;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e',
    `import { decryptAccessCode } from ${JSON.stringify(module)}; console.log(await decryptAccessCode(${JSON.stringify(encrypted)}));`],
    { env: { ...process.env, ACCESS_CODE_KEY_FILE: keyPath } });
  assert.equal(stdout.trim(), '000007');
});

test('environment encryption keys survive serverless restarts without filesystem storage', async () => {
  const module = new URL('../dist/accessCode.js', import.meta.url).href;
  const env = { ...process.env, ACCESS_CODE_KEY: randomBytes(32).toString('hex'), ACCESS_CODE_KEY_FILE: '/unwritable/qlean-test.key' };
  const run = source => promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { env });
  const { stdout } = await run(`import { encryptAccessCode } from ${JSON.stringify(module)}; console.log(await encryptAccessCode('000007'));`);
  const ciphertext = stdout.trim();
  const decrypted = await run(`import { decryptAccessCode } from ${JSON.stringify(module)}; console.log(await decryptAccessCode(${JSON.stringify(ciphertext)}));`);
  assert.equal(decrypted.stdout.trim(), '000007');
  await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e',
    `import { encryptAccessCode } from ${JSON.stringify(module)}; await encryptAccessCode('000007');`],
    { env: { ...env, ACCESS_CODE_KEY: 'invalid' } }), /Invalid access-code encryption key/);
});
