/**
 * Builds nothing itself: run `npm run build` first (the `test:sdk` script
 * does). Starts sdk-tests/server.mjs, runs the official Go conformance suite
 * against it, then exits with the suite's status. Requires Go 1.21+ (the
 * suite's toolchain is downloaded on demand).
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const port = 7331;
const url = `http://localhost:${port}`;
const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));

const server = spawn(process.execPath, [serverPath], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${url}/test?datastar=%7B%7D`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('SDK test server did not start');
}

let code = 1;
try {
  await waitForServer();
  const go = spawn(
    'go',
    [
      'run',
      'github.com/starfederation/datastar/sdk/tests/cmd/datastar-sdk-tests@latest',
      '-server',
      url,
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit', env: { ...process.env, GOTOOLCHAIN: 'auto' } },
  );
  const [exitCode] = await once(go, 'exit');
  code = exitCode ?? 1;
} finally {
  server.kill();
}
process.exit(code);
