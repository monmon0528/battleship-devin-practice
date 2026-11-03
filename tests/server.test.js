import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

async function freePort() {
  const probe = createServer().listen(0);
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

/** Sends `path` verbatim (no client-side normalisation) so traversal attempts reach the server as written. */
function get(port, path) {
  return new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    })
      .on('error', reject)
      .end();
  });
}

describe('static server', () => {
  let server;
  let port;

  before(async () => {
    port = await freePort();
    // Exit cleanly on SIGTERM so V8 coverage for server.js is flushed to the test runner.
    server = spawn(
      process.execPath,
      ['--input-type=module', '-e', "process.on('SIGTERM', () => process.exit(0)); await import('./server.js');"],
      { cwd: repoRoot, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let output = '';
    for await (const chunk of server.stdout) {
      output += chunk;
      if (output.includes(`http://localhost:${port}`)) break;
    }
  });

  after(async () => {
    server.kill('SIGTERM');
    if (server.exitCode === null) await once(server, 'exit');
  });

  test('serves index.html for /', async () => {
    const res = await get(port, '/');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.deepEqual(res.body, await readFile(new URL('../index.html', import.meta.url)));
  });

  test('serves index.html when requested by name', async () => {
    const res = await get(port, '/index.html');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  });

  test('serves JavaScript modules with a JavaScript content type', async () => {
    const res = await get(port, '/src/game.js');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.deepEqual(res.body, await readFile(new URL('../src/game.js', import.meta.url)));
  });

  test('serves stylesheets with a CSS content type', async () => {
    const res = await get(port, '/styles.css');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/css; charset=utf-8');
  });

  test('ignores the query string when resolving files', async () => {
    const res = await get(port, '/styles.css?v=1');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/css; charset=utf-8');
  });

  test('decodes percent-encoded paths', async () => {
    const res = await get(port, '/src/%67ame.js');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8');
  });

  test('falls back to application/octet-stream for unknown file types', async () => {
    const res = await get(port, '/README.md');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/octet-stream');
  });

  test('returns 404 for missing files', async () => {
    const res = await get(port, '/does-not-exist.js');
    assert.equal(res.status, 404);
    assert.equal(res.body.toString(), 'Not found');
  });

  test('returns 404 for directories', async () => {
    const res = await get(port, '/src');
    assert.equal(res.status, 404);
  });

  test('returns 403 for path traversal with encoded slashes', async () => {
    const res = await get(port, '/..%2f..%2fetc%2fpasswd');
    assert.equal(res.status, 403);
    assert.equal(res.body.toString(), 'Forbidden');
  });

  test('returns 403 for encoded traversal to a sibling directory', async () => {
    const res = await get(port, '/%2e%2e%2fbattleship-secrets.txt');
    assert.equal(res.status, 403);
  });

  test('keeps plain ../ segments inside the web root', async () => {
    const res = await get(port, '/../../index.html');
    assert.equal(res.status, 200, 'URL parsing resolves ../ against /, so this is just /index.html');
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  });

  test('returns 404 for malformed percent-encoding instead of crashing', async () => {
    const res = await get(port, '/%E0%A4%A');
    assert.equal(res.status, 404);
    const stillUp = await get(port, '/');
    assert.equal(stillUp.status, 200, 'server keeps serving after a malformed request');
  });
});
