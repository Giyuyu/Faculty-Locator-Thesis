/* global process */
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv.includes('--production') ? 'production' : 'staging';
const envPath = path.resolve(`.env.${mode}`);
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const [key, ...value] = line.split('=');
    return [key, value.join('=').trim().replace(/^['"]|['"]$/g, '')];
  }));

const email = process.env.FIREBASE_MIGRATION_EMAIL;
const password = process.env.FIREBASE_MIGRATION_PASSWORD;
if (!email || !password) {
  throw new Error('Set FIREBASE_MIGRATION_EMAIL and FIREBASE_MIGRATION_PASSWORD to an existing admin account.');
}

const authResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  },
);
const credential = await authResponse.json();
if (!authResponse.ok) throw new Error(credential?.error?.message || 'Firebase sign-in failed.');

const databaseUrl = env.VITE_FIREBASE_DATABASE_URL.replace(/\/$/, '');
const readPath = async (pathName) => {
  const response = await fetch(`${databaseUrl}/${pathName}.json?auth=${credential.idToken}`);
  if (!response.ok) throw new Error(`Could not read ${pathName}.`);
  return response.json();
};

const [users, faculties] = await Promise.all([readPath('users'), readPath('faculties')]);
const updates = {};
Object.keys(users || {}).forEach((uid) => { updates[`users/${uid}/password`] = null; });
Object.entries(faculties || {}).forEach(([facultyId, faculty]) => {
  updates[`public_faculties/${facultyId}`] = {
    faculty_id: faculty.faculty_id || facultyId,
    first_name: faculty.first_name || '',
    middle_name: faculty.middle_name || '',
    last_name: faculty.last_name || '',
    department: faculty.department || '',
    status: faculty.status || 'active',
  };
});

const updateResponse = await fetch(`${databaseUrl}/.json?auth=${credential.idToken}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates),
});
if (!updateResponse.ok) throw new Error(`Security migration failed: ${await updateResponse.text()}`);
console.log(`Security migration completed for ${mode}: removed ${Object.keys(users || {}).length} password fields and published ${Object.keys(faculties || {}).length} safe faculty records.`);
