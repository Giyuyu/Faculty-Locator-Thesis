import { readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const environment = String(process.argv[2] || 'staging').toLowerCase();
const projectId = environment === 'production' ? 'fac-loc' : 'fac-loc-stg';
const credentialPrefix = `${projectId}-firebase-adminsdk-`;
const credentialFile = readdirSync(root).find((name) => (
  name.startsWith(credentialPrefix) && name.endsWith('.json')
));

if (!credentialFile) {
  console.error(`Missing local ${environment} Firebase Admin credential.`);
  console.error(`Place the ignored ${credentialPrefix}*.json service-account file in the project root.`);
  process.exit(1);
}

let credential;
try {
  credential = JSON.parse(readFileSync(path.join(root, credentialFile), 'utf8'));
} catch (error) {
  console.error(`Unable to read ${credentialFile}: ${error.message}`);
  process.exit(1);
}

const databaseUrl = environment === 'production'
  ? 'https://fac-loc-default-rtdb.firebaseio.com'
  : 'https://fac-loc-stg-default-rtdb.firebaseio.com';
const isWindows = process.platform === 'win32';
const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'npx';
const args = isWindows
  ? ['/d', '/s', '/c', 'npx vercel dev --listen 127.0.0.1:5173 --yes']
  : ['vercel', 'dev', '--listen', '127.0.0.1:5173', '--yes'];
const child = spawn(command, args, {
  cwd: root,
  env: {
    ...process.env,
    FIREBASE_ADMIN_PROJECT_ID: credential.project_id || projectId,
    FIREBASE_ADMIN_CLIENT_EMAIL: credential.client_email,
    FIREBASE_ADMIN_PRIVATE_KEY: credential.private_key,
    FIREBASE_ADMIN_DATABASE_URL: databaseUrl,
    VITE_PASSWORD_RESET_API_URL: '/api/reset-password',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Unable to start the local web server: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
