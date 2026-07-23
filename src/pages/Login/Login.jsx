import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { auth, database } from '../../firebase';
import logo from '../../assets/sti_logo.png';

const ADMIN_CREDENTIALS = {
  email: 'admin@sti.edu',
  password: 'Admin@12345'
};

const ROLES = {
  admin: {
    role_id: 'admin',
    role_name: 'Admin'
  },
  faculty: {
    role_id: 'faculty',
    role_name: 'Faculty'
  },
  student: {
    role_id: 'student',
    role_name: 'Student'
  }
};

const PERMISSIONS = [
  { permission_id: 'manage_users', permission_name: 'Manage Users' },
  { permission_id: 'manage_rooms', permission_name: 'Manage Rooms' },
  { permission_id: 'manage_devices', permission_name: 'Manage Devices' },
  { permission_id: 'upload_schedules', permission_name: 'Upload Schedules' },
  { permission_id: 'view_schedules', permission_name: 'View Schedules' },
  { permission_id: 'view_faculty_locator', permission_name: 'View Faculty Locator' },
  { permission_id: 'manage_roles', permission_name: 'Manage Roles' },
  { permission_id: 'access_admin_module', permission_name: 'Access Admin Module' },
  { permission_id: 'access_faculty_module', permission_name: 'Access Faculty Module' },
  { permission_id: 'access_student_module', permission_name: 'Access Student Module' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((permission) => permission.permission_id),
  faculty: ['view_schedules', 'view_faculty_locator', 'access_faculty_module'],
  student: ['view_faculty_locator', 'access_student_module'],
};

const isAdminLogin = (email, password) =>
  email.trim().toLowerCase() === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password;

const rolePermissionId = (roleId, permissionId) => `${roleId}_${permissionId}`;

const applyUserPermissionOverrides = (basePermissions, userPermissions, userId) =>
  Object.values(userPermissions).reduce((acc, userPermission) => {
    if (userPermission.user_id === userId) {
      acc[userPermission.permission_id] = Boolean(userPermission.allowed);
    }
    return acc;
  }, { ...basePermissions });

const adminPermissionMap = () => PERMISSIONS.reduce((acc, permission) => {
  acc[permission.permission_id] = true;
  return acc;
}, {});

const ensureAdminPermissions = (roleIds, permissions) => (
  roleIds.includes('admin')
    ? { ...permissions, ...adminPermissionMap() }
    : permissions
);

const findLinkedProfile = async (userId, roleIds) => {
  const profilePaths = roleIds.includes('faculty') || roleIds.includes('admin')
    ? ['faculties', 'students']
    : ['students', 'faculties'];

  for (const profilePath of profilePaths) {
    const profileSnapshot = await get(ref(database, profilePath));
    if (!profileSnapshot.exists()) continue;

    const profiles = profileSnapshot.val();
    const profileEntry = Object.entries(profiles).find(([, profile]) => profile.user_id === userId);
    if (profileEntry) {
      const [id, profile] = profileEntry;
      return {
        id,
        name: [
          profile.first_name,
          profile.middle_name,
          profile.last_name
        ].filter(Boolean).join(' ')
      };
    }
  }

  return null;
};

const buildCurrentUserSession = async ({ uid, email, userData, isBuiltInAdmin = false }) => {
  let userType = userData.role_id;
  let roleIds = Array.isArray(userData.role_ids) && userData.role_ids.length
    ? userData.role_ids
    : [userType || 'student'];
  let profileId = uid;
  let profileName = userData.username || email || 'User';

  if (isBuiltInAdmin) {
    userType = 'admin';
    roleIds = ['admin'];
    profileId = 'admin';
    profileName = 'Admin';
  } else {
    const linkedProfile = await findLinkedProfile(uid, roleIds);
    if (linkedProfile) {
      profileId = linkedProfile.id;
      profileName = linkedProfile.name || userData.username || email || 'User';
      if (!roleIds.includes(userType)) {
        userType = roleIds[0] || userType;
      }
    }
  }

  const permissions = await getUserEffectivePermissions(roleIds, uid);

  return {
    uid,
    email,
    username: userData.username || email,
    userType,
    roleIds,
    name: profileName,
    id: profileId,
    permissions
  };
};

const authenticateWithDatabasePassword = async (login, password) => {
  const snapshot = await get(ref(database, 'users'));
  if (!snapshot.exists()) return null;

  const normalizedLogin = login.trim().toLowerCase();
  const matches = Object.entries(snapshot.val()).filter(([key, value]) => {
    const user = value || {};
    const uid = user.user_id || key;
    const identifiers = [
      user.username,
      user.email,
      uid,
      key,
    ].map((item) => String(item || '').trim().toLowerCase());

    return identifiers.includes(normalizedLogin);
  });

  const match = matches
    .filter(([, value]) => {
      const user = value || {};
      const storedPassword = String(user.password || '');
      return storedPassword && storedPassword !== 'managed_by_firebase_auth' && storedPassword === password;
    })
    .sort(([, a], [, b]) => String(b.password_reset_at || '').localeCompare(String(a.password_reset_at || '')))[0];

  if (!match) return null;

  const [key, userData] = match;
  const uid = userData.user_id || key;
  const storedPassword = String(userData.password || '');
  if (!storedPassword || storedPassword === 'managed_by_firebase_auth' || storedPassword !== password) {
    return null;
  }

  if (['inactive', 'archived', 'deleted'].includes(userData.status)) {
    throw new Error('inactive-account');
  }

  return buildCurrentUserSession({
    uid,
    email: userData.username || userData.email || login,
    userData,
  });
};

const buildPermissionSeedUpdates = () => {
  const updates = {};

  Object.values(ROLES).forEach((role) => {
    updates[`roles/${role.role_id}`] = role;
  });

  PERMISSIONS.forEach((permission) => {
    updates[`permissions/${permission.permission_id}`] = permission;
  });

  Object.entries(DEFAULT_ROLE_PERMISSIONS).forEach(([roleId, permissionIds]) => {
    permissionIds.forEach((permissionId) => {
      const id = rolePermissionId(roleId, permissionId);
      updates[`role_permissions/${id}`] = {
        role_permission_id: id,
        role_id: roleId,
        permission_id: permissionId
      };
    });
  });

  return updates;
};

const getUserEffectivePermissions = async (roleIds, userId) => {
  const [rolePermissionsSnapshot, userPermissionsSnapshot, migrationSnapshot] = await Promise.all([
    get(ref(database, 'role_permissions')),
    get(ref(database, 'user_permissions')),
    get(ref(database, 'migrations/removed_faculty_default_upload_schedules')),
  ]);
  let rolePermissions = rolePermissionsSnapshot.exists() ? rolePermissionsSnapshot.val() : {};
  const userPermissions = userPermissionsSnapshot.exists() ? userPermissionsSnapshot.val() : {};

  const seedUpdates = buildPermissionSeedUpdates();
  const missingSeedUpdates = Object.entries(seedUpdates).reduce((acc, [path, value]) => {
    if (!path.startsWith('role_permissions/')) {
      acc[path] = value;
      return acc;
    }

    const rolePermissionKey = path.replace('role_permissions/', '');
    if (!rolePermissions[rolePermissionKey]) {
      acc[path] = value;
    }
    return acc;
  }, {});

  if (!migrationSnapshot.exists() && rolePermissions.faculty_upload_schedules) {
    missingSeedUpdates['role_permissions/faculty_upload_schedules'] = null;
    missingSeedUpdates['migrations/removed_faculty_default_upload_schedules'] = true;
  }

  if (Object.keys(missingSeedUpdates).length) {
    await update(ref(database), missingSeedUpdates);
    const seededSnapshot = await get(ref(database, 'role_permissions'));
    rolePermissions = seededSnapshot.exists() ? seededSnapshot.val() : {};
  }

  const basePermissions = Object.values(rolePermissions).reduce((acc, rolePermission) => {
    if (roleIds.includes(rolePermission.role_id)) {
      acc[rolePermission.permission_id] = true;
    }
    return acc;
  }, {});

  const effectivePermissions = applyUserPermissionOverrides(basePermissions, userPermissions, userId);
  return ensureAdminPermissions(roleIds, effectivePermissions);
};

const seedAdminSchema = async (user) => {
  const createdDate = new Date().toISOString();

  await update(ref(database), {
    [`users/${user.uid}`]: {
      user_id: user.uid,
      username: ADMIN_CREDENTIALS.email,
      password: 'managed_by_firebase_auth',
      role_id: 'admin',
      role_ids: ['admin'],
      status: 'active',
      created_date: createdDate
    },
    ...buildPermissionSeedUpdates()
  });
};

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 50,
        y: (e.clientY / window.innerHeight - 0.5) * 50
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let userCredential;

      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError) {
        if (
          (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') &&
          isAdminLogin(email, password)
        ) {
          userCredential = await createUserWithEmailAndPassword(
            auth,
            ADMIN_CREDENTIALS.email,
            ADMIN_CREDENTIALS.password
          );
          await seedAdminSchema(userCredential.user);
        } else {
          throw authError;
        }
      }

      const user = userCredential.user;
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        if (['inactive', 'archived', 'deleted'].includes(userData.status)) {
          setError('Your account is deactivated or archived. Please contact the administrator.');
          setIsLoading(false);
          return;
        }

        const isBuiltInAdmin = email.trim().toLowerCase() === ADMIN_CREDENTIALS.email;

        if (isBuiltInAdmin && userData.role_id !== 'admin') {
          await seedAdminSchema(user);
        }

        const sessionUser = await buildCurrentUserSession({
          uid: user.uid,
          email: user.email,
          userData,
          isBuiltInAdmin,
        });

        localStorage.setItem('currentUser', JSON.stringify(sessionUser));

        navigate('/home');
      } else {
        if (isAdminLogin(email, password)) {
          await seedAdminSchema(user);
          const sessionUser = await buildCurrentUserSession({
            uid: user.uid,
            email: user.email,
            userData: {
              username: ADMIN_CREDENTIALS.email,
              role_id: 'admin',
              role_ids: ['admin'],
            },
            isBuiltInAdmin: true,
          });
          localStorage.setItem('currentUser', JSON.stringify(sessionUser));
          navigate('/home');
        } else {
          setError('User data not found. Please contact support.');
        }
      }
    } catch (err) {
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) {
        try {
          const databaseSession = await authenticateWithDatabasePassword(email, password);
          if (databaseSession) {
            localStorage.setItem('currentUser', JSON.stringify(databaseSession));
            navigate('/home');
            return;
          }
        } catch (databaseAuthError) {
          if (databaseAuthError.message === 'inactive-account') {
            setError('Your account is deactivated. Please contact the administrator.');
            return;
          }
          console.error('Database password login error:', databaseAuthError);
        }
      }

      console.error('Login error:', err);

      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setError('');
  }, []);

  return (
    <div className="min-h-svh bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 pb-12 pt-24 sm:px-6 lg:px-8 relative overflow-hidden">
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-gray-200/60 bg-white/95 shadow-xl backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex cursor-pointer items-center transition-opacity duration-200 hover:opacity-80">
            <img src={logo} alt="STI Logo" className="mr-3 h-12 w-auto" />
            <span className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">STI Locator</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {[
              ['Home', '/#home'],
              ['Features', '/#features'],
              ['About', '/#about'],
              ['Support', '/#support'],
            ].map(([label, path]) => (
              <Link
                key={label}
                to={path}
                className="relative cursor-pointer rounded-lg px-4 py-2 font-medium text-gray-700 transition-all duration-300 hover:bg-gray-100 hover:text-gray-900"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="hidden h-10 w-10 md:block" aria-hidden="true" />
        </div>
      </nav>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-gradient-to-br from-blue-300/15 to-cyan-300/15 rounded-full blur-3xl animate-float-slow transition-transform duration-700"
          style={{ transform: `translate(${mousePosition.x * 0.4}px, ${mousePosition.y * 0.4}px)` }}
        ></div>
        <div 
          className="absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-br from-indigo-300/10 to-blue-300/10 rounded-full blur-3xl animate-float-slower transition-transform duration-700"
          style={{ transform: `translate(${-mousePosition.x * 0.3}px, ${-mousePosition.y * 0.3}px)` }}
        ></div>
        <div 
          className="absolute top-20 left-10 w-24 h-24 bg-white/50 rounded-xl shadow-lg animate-float transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.6}px, ${mousePosition.y * 0.6}px) rotate(6deg)` }}
        ></div>
        <div 
          className="absolute bottom-32 right-20 w-20 h-20 bg-white/40 rounded-lg shadow-md animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 0.7}px, ${-mousePosition.y * 0.7}px) rotate(-6deg)` }}
        ></div>
        <div 
          className="absolute top-1/2 left-1/2 w-16 h-16 border-2 border-blue-200/40 rounded-lg animate-float transition-transform duration-300"
          style={{ transform: `translate(-50%, -50%) translate(${mousePosition.x * 0.8}px, ${mousePosition.y * 0.8}px) rotate(45deg)` }}
        ></div>
        <div 
          className="absolute bottom-1/4 left-1/3 w-12 h-12 bg-gradient-to-br from-blue-200/60 to-cyan-200/60 rounded-full shadow-sm animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 1}px, ${-mousePosition.y * 1}px)` }}
        ></div>
        <div 
          className="absolute top-40 right-40 w-14 h-14 bg-white/30 rounded-full shadow-sm animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.9}px, ${mousePosition.y * 0.9}px)` }}
        ></div>
        <div 
          className="absolute bottom-20 left-1/3 w-18 h-18 border border-cyan-200/40 rounded-xl animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px) rotate(12deg)` }}
        ></div>
        <div 
          className="absolute top-1/3 right-20 w-10 h-10 bg-gradient-to-br from-emerald-200/50 to-teal-200/50 rounded-md shadow-sm animate-float transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 1.2}px, ${-mousePosition.y * 1.2}px) rotate(30deg)` }}
        ></div>
        <div 
          className="absolute bottom-1/2 left-20 w-8 h-8 bg-white/40 rounded-full animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.7}px, ${mousePosition.y * 0.7}px)` }}
        ></div>
        <div 
          className="absolute top-3/4 right-1/4 w-16 h-16 bg-white/25 rounded-lg animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 0.8}px, ${-mousePosition.y * 0.8}px) rotate(-15deg)` }}
        ></div>
        <div 
          className="absolute top-16 right-1/3 w-6 h-6 bg-gradient-to-br from-purple-200/50 to-pink-200/50 rounded-sm animate-float transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 1.5}px, ${-mousePosition.y * 1.5}px) rotate(45deg)` }}
        ></div>
        <div 
          className="absolute bottom-16 left-20 w-12 h-12 bg-white/35 rounded-full animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.9}px, ${mousePosition.y * 0.9}px)` }}
        ></div>
        <div 
          className="absolute top-2/3 left-16 w-22 h-22 border border-emerald-200/40 rounded-2xl animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.4}px, ${mousePosition.y * 0.4}px) rotate(-8deg)` }}
        ></div>
        <div 
          className="absolute bottom-3/4 right-16 w-9 h-9 bg-gradient-to-br from-amber-200/50 to-orange-200/50 rounded-full animate-float transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 1.1}px, ${-mousePosition.y * 1.1}px)` }}
        ></div>
        <div 
          className="absolute top-1/4 right-16 w-14 h-14 bg-white/30 rounded-md animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.6}px, ${mousePosition.y * 0.6}px) rotate(20deg)` }}
        ></div>
        <div 
          className="absolute bottom-40 left-2/3 w-11 h-11 border border-violet-200/40 rounded-lg animate-float transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 0.9}px, ${-mousePosition.y * 0.9}px) rotate(60deg)` }}
        ></div>
        <div 
          className="absolute top-2/5 right-3/4 w-7 h-7 bg-white/45 rounded-full animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 1}px, ${mousePosition.y * 1}px)` }}
        ></div>
        <div 
          className="absolute top-60 left-40 w-5 h-5 bg-gradient-to-br from-rose-200/50 to-red-200/50 rounded-full animate-float-fast transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 1.3}px, ${mousePosition.y * 1.3}px)` }}
        ></div>
        <div 
          className="absolute bottom-60 right-40 w-13 h-13 bg-white/25 rounded-xl animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 0.7}px, ${-mousePosition.y * 0.7}px) rotate(-12deg)` }}
        ></div>
        <div 
          className="absolute top-52 right-52 w-4 h-4 bg-gradient-to-br from-sky-200/60 to-blue-200/60 rounded-full animate-float transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 1.8}px, ${-mousePosition.y * 1.8}px)` }}
        ></div>
        <div 
          className="absolute bottom-52 left-52 w-15 h-15 border border-sky-200/40 rounded-2xl animate-float-reverse transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px) rotate(25deg)` }}
        ></div>
        <div 
          className="absolute top-28 right-28 w-8 h-8 bg-white/35 rounded-md animate-float-fast transition-transform duration-300"
          style={{ transform: `translate(${-mousePosition.x * 0.8}px, ${-mousePosition.y * 0.8}px) rotate(5deg)` }}
        ></div>
        <div 
          className="absolute bottom-28 left-28 w-6 h-6 bg-gradient-to-br from-lime-200/50 to-green-200/50 rounded-sm animate-float-slow transition-transform duration-300"
          style={{ transform: `translate(${mousePosition.x * 1.2}px, ${mousePosition.y * 1.2}px)` }}
        ></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-center min-h-[500px]">
          <div className="text-center lg:text-left space-y-6 lg:space-y-8 flex flex-col justify-center">
            <div className="space-y-4">
              <div className="mx-auto lg:mx-0 w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                  Faculty<span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent"> Tracker</span>
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Streamline academic management with our comprehensive faculty location and schedule tracking system.
                </p>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/30">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  System Features
                </h3>
                <div className="space-y-3.5">
                  <div className="flex items-start space-x-3 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <p className="text-slate-600 text-sm pt-0.5 group-hover:text-slate-800 transition-colors">Real-time faculty location tracking</p>
                  </div>
                  <div className="flex items-start space-x-3 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <p className="text-slate-600 text-sm pt-0.5 group-hover:text-slate-800 transition-colors">Automated schedule management</p>
                  </div>
                  <div className="flex items-start space-x-3 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <p className="text-slate-600 text-sm pt-0.5 group-hover:text-slate-800 transition-colors">Conflict-free room assignments</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:hidden grid grid-cols-3 gap-3">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/30">
                <svg className="w-5 h-5 mx-auto text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                <p className="text-xs text-slate-600">Live Tracking</p>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/30">
                <svg className="w-5 h-5 mx-auto text-emerald-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10"/></svg>
                <p className="text-xs text-slate-600">Schedule Auto</p>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/30">
                <svg className="w-5 h-5 mx-auto text-violet-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <p className="text-xs text-slate-600">Room Assign</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center mt-28">
            <div>
              <div className="text-center lg:text-left mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Welcome Back
                </h2>
                <p className="text-slate-600">Sign in to continue to your dashboard</p>
              </div>

              <form className="space-y-5 bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl shadow-black/5 border border-slate-200/50" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="block w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white placeholder-slate-400"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="block w-full pl-11 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white placeholder-slate-400"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                      Remember me
                    </label>
                  </div>
                  <div className="text-sm">
                    <a href={"#"} onClick={(e) => e.preventDefault()} className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                      Forgot password?
                    </a>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start">
                    <svg className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.01] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              <div className="text-center mt-6 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  Accounts are created by the school administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
