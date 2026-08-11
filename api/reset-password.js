import { randomInt } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const PASSWORD_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%',
];
const PASSWORD_ALPHABET = PASSWORD_GROUPS.join('');
const RESET_COOLDOWN_MS = 30_000;

function json(response, status, body) {
  response.status(status);
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function normalizeRoles(user) {
  const assigned = user?.role_ids;
  if (Array.isArray(assigned)) return assigned.filter(Boolean);
  if (assigned && typeof assigned === 'object') {
    return Object.entries(assigned)
      .map(([roleId, value]) => value === true ? roleId : value)
      .filter((value) => typeof value === 'string' && value);
  }
  return [user?.role_id].filter(Boolean);
}

function generateTemporaryPassword(length = 16) {
  const characters = PASSWORD_GROUPS.map((group) => group[randomInt(group.length)]);
  while (characters.length < length) {
    characters.push(PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const usesEmulators = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST
    && process.env.FIREBASE_DATABASE_EMULATOR_HOST
  );
  if (usesEmulators && projectId) {
    return initializeApp({
      projectId,
      databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL
        || `https://${projectId}-default-rtdb.firebaseio.com`,
    });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('firebase-admin-not-configured');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL
      || `https://${projectId}-default-rtdb.firebaseio.com`,
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { error: 'method-not-allowed' });
  }

  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) {
    return json(response, 401, { error: 'authentication-required' });
  }

  const targetUid = String(request.body?.uid || '').trim();
  if (!targetUid || targetUid.length > 128) {
    return json(response, 400, { error: 'invalid-user' });
  }

  try {
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const database = getDatabase(app);
    const callerToken = await adminAuth.verifyIdToken(authorization.slice(7), true);

    if (callerToken.uid === targetUid) {
      return json(response, 400, { error: 'use-profile-password-change' });
    }

    const callerSnapshot = await database.ref(`users/${callerToken.uid}`).get();
    const caller = callerSnapshot.val() || {};
    if (String(caller.status || '').toLowerCase() !== 'active' || !normalizeRoles(caller).includes('admin')) {
      return json(response, 403, { error: 'admin-required' });
    }

    const targetRef = database.ref(`users/${targetUid}`);
    const targetSnapshot = await targetRef.get();
    if (!targetSnapshot.exists()) {
      return json(response, 404, { error: 'user-not-found' });
    }

    const lockUntil = Date.now() + RESET_COOLDOWN_MS;
    const lockResult = await targetRef.child('password_reset_lock_until').transaction((current) => {
      if (Number(current || 0) > Date.now()) return;
      return lockUntil;
    }, undefined, false);
    if (!lockResult.committed) {
      return json(response, 429, { error: 'reset-too-soon' });
    }

    let authUser;
    try {
      authUser = await adminAuth.getUser(targetUid);
    } catch (error) {
      await targetRef.child('password_reset_lock_until').remove();
      if (error?.code === 'auth/user-not-found') {
        return json(response, 404, { error: 'auth-user-not-found' });
      }
      throw error;
    }

    const temporaryPassword = generateTemporaryPassword();
    await adminAuth.updateUser(targetUid, { password: temporaryPassword });

    let auditSaved = true;
    try {
      await targetRef.update({
        password: null,
        password_change_required: true,
        password_reset_at: new Date().toISOString(),
        password_reset_by: callerToken.uid,
        password_reset_lock_until: null,
      });
    } catch {
      auditSaved = false;
    }

    return json(response, 200, {
      email: authUser.email || targetSnapshot.val()?.username || '',
      temporaryPassword,
      auditSaved,
    });
  } catch (error) {
    if (error?.message === 'firebase-admin-not-configured') {
      return json(response, 503, { error: 'server-not-configured' });
    }
    if (error?.code?.startsWith('auth/id-token-') || error?.code === 'auth/argument-error') {
      return json(response, 401, { error: 'invalid-session' });
    }
    return json(response, 500, { error: 'reset-failed' });
  }
}
