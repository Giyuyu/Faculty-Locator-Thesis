import { get, ref } from 'firebase/database';
import { database } from '../firebase';

const ALL_PERMISSIONS = [
  'manage_users',
  'manage_rooms',
  'manage_devices',
  'upload_schedules',
  'view_schedules',
  'view_faculty_locator',
  'manage_roles',
  'access_admin_module',
  'access_faculty_module',
  'access_student_module',
];

const inactiveStatuses = new Set(['inactive', 'archived', 'deleted']);

const findProfile = (profiles, userId) => Object.entries(profiles || {})
  .find(([, profile]) => profile?.user_id === userId);

export async function loadAuthenticatedSession(authUser) {
  if (!authUser || authUser.isAnonymous) throw new Error('authentication-required');

  const [userSnapshot, rolesSnapshot, overridesSnapshot, facultiesSnapshot, studentsSnapshot] = await Promise.all([
    get(ref(database, `users/${authUser.uid}`)),
    get(ref(database, 'role_permissions')),
    get(ref(database, 'user_permissions')),
    get(ref(database, 'faculties')),
    get(ref(database, 'students')),
  ]);
  const userData = userSnapshot.val();
  if (!userData) throw new Error('user-record-not-found');
  if (inactiveStatuses.has(String(userData.status || '').toLowerCase())) {
    throw new Error('inactive-account');
  }

  const roleIds = Array.isArray(userData.role_ids) && userData.role_ids.length
    ? userData.role_ids
    : [userData.role_id || 'student'];
  const permissions = {};

  Object.values(rolesSnapshot.val() || {}).forEach((record) => {
    if (roleIds.includes(record?.role_id)) permissions[record.permission_id] = true;
  });
  Object.values(overridesSnapshot.val() || {}).forEach((record) => {
    if (record?.user_id === authUser.uid) permissions[record.permission_id] = Boolean(record.allowed);
  });
  if (roleIds.includes('admin')) {
    ALL_PERMISSIONS.forEach((permission) => { permissions[permission] = true; });
  }

  const profileEntry = roleIds.includes('faculty') || roleIds.includes('admin')
    ? findProfile(facultiesSnapshot.val(), authUser.uid) || findProfile(studentsSnapshot.val(), authUser.uid)
    : findProfile(studentsSnapshot.val(), authUser.uid) || findProfile(facultiesSnapshot.val(), authUser.uid);
  const [profileId, profile] = profileEntry || [authUser.uid, {}];
  const name = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ');

  return {
    uid: authUser.uid,
    email: authUser.email,
    username: userData.username || userData.email || authUser.email,
    userType: userData.role_id || roleIds[0] || 'student',
    roleIds,
    name: name || userData.username || authUser.email || 'User',
    id: profileId,
    facultyId: profile.faculty_id || '',
    permissions,
    passwordChangeRequired: userData.password_change_required === true,
  };
}

export function cacheAuthenticatedSession(session) {
  localStorage.setItem('currentUser', JSON.stringify(session));
}

export function clearAuthenticatedSession() {
  localStorage.removeItem('currentUser');
}
