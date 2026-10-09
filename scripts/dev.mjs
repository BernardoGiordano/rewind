/**
 * Development: the API under `node --watch` on :4000, and `srl serve` on :8000 with
 * `/api` proxied to it. One terminal, and Ctrl-C stops both.
 */

import { spawn } from 'node:child_process';

// The API listens where `dev:web` proxies, whatever PORT the shell exports.
const children = [
  spawn('npm', ['run', '--silent', 'dev:api'], { stdio: 'inherit', env: { ...process.env, PORT: '4000' } }),
  spawn('npm', ['run', '--silent', 'dev:web'], { stdio: 'inherit' }),
];

function stop() {
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (const child of children) {
  child.on('exit', (code) => {
    stop();
    process.exitCode ??= code ?? 0;
  });
}
