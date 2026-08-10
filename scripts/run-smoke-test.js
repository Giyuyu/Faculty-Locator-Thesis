import { spawn, spawnSync } from 'node:child_process';

const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const baseUrl = 'http://127.0.0.1:5178';
const smokeEnvironment = {
  FIREBASE_AUTH_EMULATOR_PORT: '19199',
  FIREBASE_DATABASE_EMULATOR_PORT: '19100',
  STI_LOCATOR_LOCAL_DB_PORT: '19100',
  VITE_FIREBASE_AUTH_EMULATOR_PORT: '19199',
  VITE_FIREBASE_DATABASE_EMULATOR_PORT: '19100',
};

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local web server did not start within 30 seconds.');
}

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function main() {
  run('node', ['scripts/seed-local-firebase.js'], smokeEnvironment);
  run(pythonCommand, ['scripts/prepare-smoke-fixture.py'], {
    ...smokeEnvironment,
    STI_LOCATOR_ENV: 'local',
  });

  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'localdb', '--host', '127.0.0.1', '--port', '5178'], {
    cwd: process.cwd(),
    env: { ...process.env, ...smokeEnvironment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stdout.on('data', (chunk) => process.stdout.write(chunk));
  vite.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForServer();
    run('node', ['scripts/web-smoke-test.js'], { ...smokeEnvironment, SMOKE_BASE_URL: baseUrl });
  } finally {
    stopProcessTree(vite);
  }
}

main().catch((error) => {
  console.error(`[SMOKE] ${error.message}`);
  process.exitCode = 1;
});
