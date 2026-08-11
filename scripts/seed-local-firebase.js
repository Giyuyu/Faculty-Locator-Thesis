/* global process */

const projectId = 'sti-locator-local';
const databaseNamespace = 'sti-locator-local-default-rtdb';
const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const authPort = process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099';
const databasePort = process.env.FIREBASE_DATABASE_EMULATOR_PORT || '9000';
const authBase = `http://${host}:${authPort}/identitytoolkit.googleapis.com/v1/accounts`;
const databaseBase = `http://${host}:${databasePort}`;

const accounts = [
  {
    email: 'device.local@sti.edu',
    password: 'Device@12345',
    role: 'device',
    firstName: 'Local',
    lastName: 'Desktop Device',
  },
  {
    email: 'admin@sti.edu',
    password: 'Admin@12345',
    role: 'admin',
    firstName: 'Local',
    lastName: 'Administrator',
  },
  {
    email: 'faculty.local@sti.edu',
    password: 'Faculty@12345',
    role: 'faculty',
    facultyId: 'NVSLOCALF',
    firstName: 'Local',
    lastName: 'Faculty',
    department: 'Information Technology',
  },
  {
    email: 'student.local@sti.edu',
    password: 'Student@12345',
    role: 'student',
    studentNumber: '2026-LOCAL-01',
    firstName: 'Local',
    lastName: 'Student',
  },
];

const roles = {
  admin: { role_id: 'admin', role_name: 'Admin' },
  faculty: { role_id: 'faculty', role_name: 'Faculty' },
  student: { role_id: 'student', role_name: 'Student' },
  device: { role_id: 'device', role_name: 'Desktop Device' },
};

const permissions = [
  ['manage_users', 'Manage Users'],
  ['manage_rooms', 'Manage Rooms'],
  ['manage_devices', 'Manage Devices'],
  ['upload_schedules', 'Upload Schedules'],
  ['view_schedules', 'View Schedules'],
  ['view_faculty_locator', 'View Faculty Locator'],
  ['manage_roles', 'Manage Roles'],
  ['access_admin_module', 'Access Admin Module'],
  ['access_faculty_module', 'Access Faculty Module'],
  ['access_student_module', 'Access Student Module'],
];

const rolePermissions = {
  admin: permissions.map(([id]) => id),
  faculty: ['view_schedules', 'view_faculty_locator', 'access_faculty_module'],
  student: ['view_faculty_locator', 'access_student_module'],
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForEmulators() {
  for (let attempt = 1; attempt <= 240; attempt += 1) {
    try {
      const [databaseResponse, authResponse] = await Promise.all([
        fetch(`${databaseBase}/.json?ns=${databaseNamespace}`),
        fetch(`http://${host}:${authPort}/emulator/v1/projects/${projectId}/config`),
      ]);
      if (databaseResponse.status && authResponse.ok) return;
    } catch {
      // The launcher starts this script before the emulator process is ready.
    }
    await sleep(500);
  }
  throw new Error('Local Firebase Auth and Database emulators did not become ready within 120 seconds.');
}

async function authRequest(action, body) {
  const response = await fetch(`${authBase}:${action}?key=local-emulator-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error?.message || `Auth emulator request failed: ${action}`);
    error.code = result?.error?.message;
    throw error;
  }
  return result;
}

async function ensureAuthAccount(account) {
  try {
    return await authRequest('signUp', {
      email: account.email,
      password: account.password,
    });
  } catch (error) {
    if (!String(error.code || '').startsWith('EMAIL_EXISTS')) throw error;
    return authRequest('signInWithPassword', {
      email: account.email,
      password: account.password,
    });
  }
}

function databaseUrl(path = '') {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  return `${databaseBase}/${cleanPath ? `${cleanPath}.json` : '.json'}?ns=${databaseNamespace}`;
}

async function databaseGet(path) {
  const response = await fetch(databaseUrl(path), {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!response.ok) throw new Error(`Could not read local database path: ${path}`);
  return response.json();
}

async function putIfMissing(path, value) {
  if ((await databaseGet(path)) !== null) return false;
  const response = await fetch(databaseUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Could not seed local database path: ${path}`);
  return true;
}

async function seedReferenceData() {
  for (const role of Object.values(roles)) {
    await putIfMissing(`roles/${role.role_id}`, role);
  }
  for (const [permissionId, permissionName] of permissions) {
    await putIfMissing(`permissions/${permissionId}`, {
      permission_id: permissionId,
      permission_name: permissionName,
    });
  }
  for (const [roleId, permissionIds] of Object.entries(rolePermissions)) {
    for (const permissionId of permissionIds) {
      const id = `${roleId}_${permissionId}`;
      await putIfMissing(`role_permissions/${id}`, {
        role_permission_id: id,
        role_id: roleId,
        permission_id: permissionId,
      });
    }
  }

  await putIfMissing('rooms/local_room_101', {
    room_id: 'local_room_101',
    room_name: 'Local Room 101',
    building: 'Local Campus',
    floor: '1st Floor',
    room_status: 'Available',
  });
}

async function seedAccount(account) {
  const credential = await ensureAuthAccount(account);
  const uid = credential.localId;
  const createdDate = new Date().toISOString();

  await putIfMissing(`users/${uid}`, {
    user_id: uid,
    username: account.email,
    email: account.email,
    role_id: account.role,
    role_ids: [account.role],
    status: 'active',
    created_date: createdDate,
  });

  if (account.role === 'faculty') {
    const facultyRecord = {
      faculty_id: account.facultyId,
      user_id: uid,
      first_name: account.firstName,
      middle_name: '',
      last_name: account.lastName,
      department: account.department,
      email: account.email,
      status: 'active',
    };
    await putIfMissing(`faculties/${account.facultyId}`, facultyRecord);
    await putIfMissing(`public_faculties/${account.facultyId}`, {
      faculty_id: account.facultyId,
      first_name: account.firstName,
      middle_name: '',
      last_name: account.lastName,
      department: account.department,
      status: 'active',
    });
    await putIfMissing(`faculty_status/${account.facultyId}`, {
      status_id: account.facultyId,
      faculty_id: account.facultyId,
      current_status: 'Offline',
      current_room_id: '',
      current_subject_id: '',
      previous_room_id: '',
      previous_subject_id: '',
      updated_date: createdDate,
    });
  }

  if (account.role === 'student') {
    await putIfMissing(`students/${account.studentNumber}`, {
      student_id: account.studentNumber,
      student_number: account.studentNumber,
      user_id: uid,
      first_name: account.firstName,
      middle_name: '',
      last_name: account.lastName,
      email: account.email,
      status: 'active',
    });
  }
}

async function main() {
  await waitForEmulators();
  await seedReferenceData();
  for (const account of accounts) await seedAccount(account);
  await putIfMissing('local_metadata/environment', {
    name: 'local',
    project_id: projectId,
    seeded: true,
  });
  console.log('Local Firebase is ready with Admin, Faculty, and Student sample accounts.');
}

main().catch((error) => {
  console.error(`[LOCAL FIREBASE] ${error.message}`);
  process.exitCode = 1;
});
