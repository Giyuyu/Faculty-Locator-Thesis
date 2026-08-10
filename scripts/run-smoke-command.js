import { spawnSync } from 'node:child_process';

const databasePort = '19100';

function cleanupWindowsDatabaseEmulator() {
  if (process.platform !== 'win32') return;
  const script = [
    `$connection = Get-NetTCPConnection -LocalPort ${databasePort} -State Listen -ErrorAction SilentlyContinue`,
    'if ($connection) {',
    '  $pidValue = $connection.OwningProcess | Select-Object -First 1',
    '  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"',
    `  if ($process.CommandLine -like '*firebase-database-emulator*--port ${databasePort}*') { Stop-Process -Id $pidValue -Force }`,
    '}',
  ].join('; ');
  spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
}

const firebaseCli = 'node_modules/firebase-tools/lib/bin/firebase.js';
const result = spawnSync(
  process.execPath,
  [
    firebaseCli,
    'emulators:exec',
    '--config',
    'firebase.smoke.json',
    '--project',
    'sti-locator-local',
    '--only',
    'auth,database',
    'node scripts/run-smoke-test.js',
  ],
  { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
);

cleanupWindowsDatabaseEmulator();
process.exitCode = result.status ?? 1;
