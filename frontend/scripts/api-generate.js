// Regenerates the typed API client from the backend: `npm run api:generate`.
// Uses backend/.venv when present, otherwise `python` on PATH (with backend requirements installed).
const { execFileSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const backend = path.resolve(__dirname, '../../backend');
const venvPython = [path.join(backend, '.venv/Scripts/python.exe'), path.join(backend, '.venv/bin/python')].find(existsSync);
const spec = 'src/app/core/api/openapi.json';
const cwd = path.resolve(__dirname, '..');

execFileSync(venvPython || 'python', [path.join(backend, 'scripts/export_openapi.py'), spec], { cwd, stdio: 'inherit' });
execFileSync('npx', ['--yes', 'openapi-typescript@7.13.0', spec, '-o', 'src/app/core/api/schema.ts'], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
