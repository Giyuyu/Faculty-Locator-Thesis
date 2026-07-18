import React, { useEffect, useMemo, useState } from 'react';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { get, onValue, ref, remove, update } from 'firebase/database';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FaBars,
  FaBuilding,
  FaCalendarAlt,
  FaChartLine,
  FaChevronDown,
  FaCheckCircle,
  FaClipboardList,
  FaCog,
  FaDoorOpen,
  FaEdit,
  FaExclamationTriangle,
  FaFileUpload,
  FaLayerGroup,
  FaSave,
  FaSearch,
  FaSignOutAlt,
  FaTimes,
  FaTrash,
  FaUpload,
  FaUserPlus,
  FaUserCircle,
  FaUserShield,
  FaUsers,
} from 'react-icons/fa';
import { MdApps } from 'react-icons/md';
import { database, firebaseConfig } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import logo from '../../assets/sti_logo.png';
import {
  changeCurrentUserPassword,
  showUserProfile,
  signOutCurrentUser,
  toggleThemeSetting,
} from '../../utils/profileActions';

const ROLES = {
  admin: { role_id: 'admin', role_name: 'Admin' },
  faculty: { role_id: 'faculty', role_name: 'Faculty' },
  student: { role_id: 'student', role_name: 'Student' },
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

const INITIAL_USER_FORM = {
  role: 'student',
  studentNumber: '',
  facultyId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  department: '',
  email: '',
  password: 'Temp@12345',
};

const INITIAL_FLOOR_FORM = {
  floorId: '',
  floorName: '',
  sortOrder: '',
  status: 'active',
};

const INITIAL_ROOM_FORM = {
  roomId: '',
  roomName: '',
  building: '',
  floor: '',
  roomStatus: 'Available',
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: FaChartLine },
  { id: 'accounts', label: 'Accounts', icon: FaUserPlus },
  { id: 'users', label: 'Users & Roles', icon: FaUserShield },
  { id: 'batch', label: 'Batch Upload', icon: FaFileUpload },
  { id: 'rooms', label: 'Floors & Rooms', icon: FaBuilding },
  { id: 'reports', label: 'Reports', icon: FaClipboardList },
  { id: 'settings', label: 'Settings', icon: FaCog },
];

const statusClasses = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Occupied: 'bg-blue-50 text-blue-700 ring-blue-200',
  Reserved: 'bg-violet-50 text-violet-700 ring-violet-200',
  'Under Maintenance': 'bg-amber-50 text-amber-700 ring-amber-200',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-200',
  Present: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Away: 'bg-slate-100 text-slate-700 ring-slate-200',
  Ready: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Review: 'bg-amber-50 text-amber-700 ring-amber-200',
  'In-Class': 'bg-blue-50 text-blue-700 ring-blue-200',
  Offline: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const batchColumns = [
  'role',
  'student_number',
  'faculty_id',
  'first_name',
  'middle_name',
  'last_name',
  'department',
  'email',
  'password',
];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold capitalize ring-1 ${statusClasses[status] || statusClasses.inactive}`}>
      {status}
    </span>
  );
}

function SectionPanel({ title, description, action, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function fieldClass() {
  return 'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
}

function normalizeKey(key) {
  return String(key).trim().toLowerCase().replace(/\s+/g, '_');
}

function sanitizeId(value) {
  return String(value || '').trim().replace(/[.#$/[\]]/g, '-');
}

function rolePermissionId(roleId, permissionId) {
  return `${roleId}_${permissionId}`;
}

function userPermissionId(userId, permissionId) {
  return `${userId}_${permissionId}`;
}

function buildPermissionSeedUpdates() {
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
        permission_id: permissionId,
      };
    });
  });

  return updates;
}

function permissionMapFromRolePermissions(rolePermissions, roleId) {
  return Object.values(rolePermissions).reduce((acc, rolePermission) => {
    if (rolePermission.role_id === roleId) {
      acc[rolePermission.permission_id] = true;
    }
    return acc;
  }, {});
}

function permissionMapFromRoles(rolePermissions, roleIds) {
  return roleIds.reduce((acc, roleId) => ({
    ...acc,
    ...permissionMapFromRolePermissions(rolePermissions, roleId),
  }), {});
}

function applyUserPermissionOverrides(basePermissions, userPermissions, userId) {
  return Object.values(userPermissions).reduce((acc, userPermission) => {
    if (userPermission.user_id === userId) {
      acc[userPermission.permission_id] = Boolean(userPermission.allowed);
    }
    return acc;
  }, { ...basePermissions });
}

function adminPermissionMap() {
  return PERMISSIONS.reduce((acc, permission) => {
    acc[permission.permission_id] = true;
    return acc;
  }, {});
}

function ensureAdminPermissions(roleIds, permissions) {
  return roleIds.includes('admin')
    ? { ...permissions, ...adminPermissionMap() }
    : permissions;
}

function effectiveUserPermissions(rolePermissions, userPermissions, userId, roleIds) {
  const basePermissions = permissionMapFromRoles(rolePermissions, roleIds);
  return ensureAdminPermissions(
    roleIds,
    applyUserPermissionOverrides(basePermissions, userPermissions, userId)
  );
}

function mapBatchRow(row) {
  const normalized = Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

  return {
    role: String(normalized.role || normalized.user_type || 'student').trim().toLowerCase(),
    studentNumber: String(normalized.student_number || normalized.student_id || '').trim(),
    facultyId: String(normalized.faculty_id || '').trim(),
    firstName: String(normalized.first_name || '').trim(),
    middleName: String(normalized.middle_name || '').trim(),
    lastName: String(normalized.last_name || '').trim(),
    department: String(normalized.department || '').trim(),
    email: String(normalized.email || '').trim(),
    password: String(normalized.password || 'Temp@12345').trim(),
  };
}

async function createProvisionedAuthUser(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `admin-provision-${Date.now()}-${Math.random()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return credential.user;
  } finally {
    await deleteApp(secondaryApp);
  }
}

function buildUserUpdates(user, form) {
  const role = form.role;
  const createdDate = new Date().toISOString();
  const status = 'active';
  const firstName = form.firstName.trim();
  const middleName = form.middleName.trim();
  const lastName = form.lastName.trim();

  const updates = {
    [`users/${user.uid}`]: {
      user_id: user.uid,
      username: form.email.trim(),
      password: 'managed_by_firebase_auth',
      role_id: role,
      role_ids: [role],
      status,
      created_date: createdDate,
    },
    ...buildPermissionSeedUpdates(),
  };

  if (role === 'student') {
    const studentId = sanitizeId(form.studentNumber);
    updates[`students/${studentId}`] = {
      student_id: studentId,
      user_id: user.uid,
      student_number: form.studentNumber.trim(),
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
    };
  }

  if (role === 'faculty') {
    const facultyId = sanitizeId(form.facultyId);
    updates[`faculties/${facultyId}`] = {
      faculty_id: facultyId,
      user_id: user.uid,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      department: form.department.trim(),
      email: form.email.trim(),
      status,
    };
  }

  return updates;
}

function validateUserForm(form) {
  if (!['student', 'faculty'].includes(form.role)) return 'Only student and faculty accounts can be created here.';
  if (!form.email.trim()) return 'Email is required.';
  if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters.';
  if (!form.firstName.trim() || !form.lastName.trim()) return 'First name and last name are required.';
  if (form.role === 'student' && !form.studentNumber.trim()) return 'Student number is required.';
  if (form.role === 'faculty' && !form.facultyId.trim()) return 'Faculty ID is required.';
  return '';
}

function getProfileName(user, students, faculties) {
  const profileSource = user.role_id === 'student' ? students : faculties;
  const profile = Object.values(profileSource).find((item) => item.user_id === user.user_id);

  if (!profile) return user.username || user.user_id;

  return [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || user.username;
}

function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('moduleSidebarOpen') === 'true');
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminLiveData, setAdminLiveData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userForm, setUserForm] = useState(INITIAL_USER_FORM);
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [batchRows, setBatchRows] = useState([]);
  const [batchResult, setBatchResult] = useState('');
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [managedUsers, setManagedUsers] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [userPermissions, setUserPermissions] = useState({});
  const [savedRolePermissions, setSavedRolePermissions] = useState({});
  const [savedUserPermissions, setSavedUserPermissions] = useState({});
  const [savedUserRoles, setSavedUserRoles] = useState({});
  const [hasPermissionDraftChanges, setHasPermissionDraftChanges] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userAdminMessage, setUserAdminMessage] = useState('');
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [floorForm, setFloorForm] = useState(INITIAL_FLOOR_FORM);
  const [roomForm, setRoomForm] = useState(INITIAL_ROOM_FORM);
  const [roomMessage, setRoomMessage] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;

    if (!currentUser) {
      navigate('/login');
    } else if (
      currentUser.userType !== 'admin' &&
      !currentUser.roleIds?.includes('admin') &&
      !currentUser.permissions?.access_admin_module
    ) {
      navigate('/home');
    } else {
      setCurrentUser(currentUser);
    }
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onValue(ref(database), (snapshot) => {
      const data = snapshot.val() || {};
      setAdminLiveData(data);

      if (data.rooms) {
        setRooms(Object.values(data.rooms).sort((a, b) => String(a.room_name).localeCompare(String(b.room_name))));
      }

      if (data.floors) {
        setFloors(Object.values(data.floors).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadAdminData = async () => {
      const [floorSnapshot, roomSnapshot] = await Promise.all([
        get(ref(database, 'floors')),
        get(ref(database, 'rooms')),
      ]);

      if (floorSnapshot.exists()) {
        setFloors(Object.values(floorSnapshot.val()).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
      }

      if (roomSnapshot.exists()) {
        setRooms(Object.values(roomSnapshot.val()).sort((a, b) => String(a.room_name).localeCompare(String(b.room_name))));
      }

      await loadManagedUsers();
    };

    loadAdminData();
  }, []);

  const liveMetrics = useMemo(() => {
    const faculties = adminLiveData.faculties || {};
    const schedules = adminLiveData.schedules || {};
    const statuses = adminLiveData.faculty_status || {};
    const activeFaculty = Object.values(statuses).filter((status) => status?.current_status && status.current_status !== 'Offline').length;
    const occupiedRooms = Object.values(statuses).filter((status) => status?.current_room_id && status?.current_status !== 'Offline').length;

    return [
      { label: 'Faculty', value: Object.keys(faculties).length, detail: `${activeFaculty} currently active`, icon: FaUsers, accent: 'text-blue-700 bg-blue-50' },
      { label: 'Rooms', value: rooms.length, detail: `${occupiedRooms} occupied now`, icon: FaDoorOpen, accent: 'text-emerald-700 bg-emerald-50' },
      { label: 'Schedules', value: Object.keys(schedules).length, detail: 'Live schedule records', icon: FaCalendarAlt, accent: 'text-violet-700 bg-violet-50' },
      { label: 'Accounts', value: managedUsers.length, detail: 'Registered system users', icon: FaUserShield, accent: 'text-amber-700 bg-amber-50' },
    ];
  }, [adminLiveData, managedUsers.length, rooms.length]);

  const liveFacultyRows = useMemo(() => {
    const faculties = adminLiveData.faculties || {};
    const roomsById = adminLiveData.rooms || {};
    const subjectsById = adminLiveData.subjects || {};
    const statusByFaculty = Object.values(adminLiveData.faculty_status || {}).reduce((acc, status) => {
      if (status?.faculty_id) acc[status.faculty_id] = status;
      return acc;
    }, {});

    return Object.values(faculties).map((faculty) => {
      const status = statusByFaculty[faculty.faculty_id] || {};
      const room = roomsById[status.current_room_id] || {};
      const subject = subjectsById[status.current_subject_id] || {};
      return {
        name: [faculty.first_name, faculty.middle_name, faculty.last_name].filter(Boolean).join(' ') || faculty.faculty_id,
        department: faculty.department || 'Not Available',
        room: room.room_name || status.current_room_id || 'Not in room',
        status: status.current_status || 'Offline',
        load: subject.subject_name || subject.subject_code || 'No active class',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [adminLiveData]);

  const liveReportRows = useMemo(() => {
    const lastScheduleUpdate = adminLiveData.lastScheduleUpdate || {};
    const uploadBatches = Object.keys(adminLiveData.schedule_upload_index || {}).length;
    const activeSessions = Object.values(adminLiveData.faculty_login_sessions || {}).filter((session) => session?.session_status !== 'Logged-Out').length;
    const roomCount = Object.keys(adminLiveData.rooms || {}).length;
    const occupiedRooms = Object.values(adminLiveData.faculty_status || {}).filter((status) => status?.current_room_id && status?.current_status !== 'Offline').length;

    return [
      {
        name: 'Schedule Updates',
        owner: lastScheduleUpdate.name || 'System',
        updated: lastScheduleUpdate.time ? new Date(lastScheduleUpdate.time).toLocaleString() : 'No updates yet',
        status: lastScheduleUpdate.time ? 'Ready' : 'Review',
        detail: `${uploadBatches} upload batch${uploadBatches === 1 ? '' : 'es'} tracked`,
      },
      {
        name: 'Faculty Sessions',
        owner: 'Desktop Login App',
        updated: new Date().toLocaleString(),
        status: activeSessions ? 'Ready' : 'Review',
        detail: `${activeSessions} active login session${activeSessions === 1 ? '' : 's'}`,
      },
      {
        name: 'Room Utilization',
        owner: 'Room Tracker',
        updated: new Date().toLocaleString(),
        status: occupiedRooms ? 'Ready' : 'Review',
        detail: `${occupiedRooms} of ${roomCount} rooms occupied`,
      },
    ];
  }, [adminLiveData]);

  const filteredFaculty = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return liveFacultyRows.filter((faculty) =>
      [faculty.name, faculty.department, faculty.room].some((value) => value.toLowerCase().includes(term))
    );
  }, [liveFacultyRows, searchTerm]);

  const roomRows = useMemo(() => {
    return rooms;
  }, [rooms]);

  const filteredManagedUsers = useMemo(() => {
    const term = userSearchTerm.trim().toLowerCase();
    if (!term) return managedUsers;

    return managedUsers.filter((user) =>
      [user.display_name, user.username, user.user_id, user.role_id, user.role_ids?.join(' '), user.status]
        .some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [managedUsers, userSearchTerm]);

  const selectedUser = useMemo(() => {
    return managedUsers.find((user) => user.user_id === selectedUserId) || null;
  }, [managedUsers, selectedUserId]);

  const loadManagedUsers = async () => {
    const [usersSnapshot, studentsSnapshot, facultiesSnapshot, rolePermissionsSnapshot, userPermissionsSnapshot, migrationSnapshot] = await Promise.all([
      get(ref(database, 'users')),
      get(ref(database, 'students')),
      get(ref(database, 'faculties')),
      get(ref(database, 'role_permissions')),
      get(ref(database, 'user_permissions')),
      get(ref(database, 'migrations/removed_faculty_default_upload_schedules')),
    ]);

    const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
    const students = studentsSnapshot.exists() ? studentsSnapshot.val() : {};
    const faculties = facultiesSnapshot.exists() ? facultiesSnapshot.val() : {};
    let loadedRolePermissions = rolePermissionsSnapshot.exists() ? rolePermissionsSnapshot.val() : {};
    const loadedUserPermissions = userPermissionsSnapshot.exists() ? userPermissionsSnapshot.val() : {};

    const seedUpdates = buildPermissionSeedUpdates();
    const missingSeedUpdates = Object.entries(seedUpdates).reduce((acc, [path, value]) => {
      if (!path.startsWith('role_permissions/')) {
        acc[path] = value;
        return acc;
      }

      const rolePermissionKey = path.replace('role_permissions/', '');
      if (!loadedRolePermissions[rolePermissionKey]) {
        acc[path] = value;
      }
      return acc;
    }, {});

    if (!migrationSnapshot.exists() && loadedRolePermissions.faculty_upload_schedules) {
      missingSeedUpdates['role_permissions/faculty_upload_schedules'] = null;
      missingSeedUpdates['migrations/removed_faculty_default_upload_schedules'] = true;
    }

    if (Object.keys(missingSeedUpdates).length) {
      await update(ref(database), missingSeedUpdates);
      const seededSnapshot = await get(ref(database, 'role_permissions'));
      loadedRolePermissions = seededSnapshot.exists() ? seededSnapshot.val() : {};
    }

    setRolePermissions(loadedRolePermissions);
    setUserPermissions(loadedUserPermissions);
    setSavedRolePermissions(loadedRolePermissions);
    setSavedUserPermissions(loadedUserPermissions);

    const rows = Object.values(users)
      .map((user) => {
        const roleIds = Array.isArray(user.role_ids) && user.role_ids.length ? user.role_ids : [user.role_id || 'student'];
        return {
          ...user,
          role_ids: roleIds,
          role_id: user.role_id || roleIds[0],
          display_name: getProfileName(user, students, faculties),
          permissions: effectiveUserPermissions(loadedRolePermissions, loadedUserPermissions, user.user_id, roleIds),
        };
      })
      .sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));

    setManagedUsers(rows);
    setSavedUserRoles(rows.reduce((acc, user) => {
      acc[user.user_id] = {
        role_id: user.role_id,
        role_ids: user.role_ids || [user.role_id],
      };
      return acc;
    }, {}));
    setHasPermissionDraftChanges(false);
  };

  const handleLogout = () => {
    signOutCurrentUser(navigate);
  };

  const setSidebarPreference = (open) => {
    localStorage.setItem('moduleSidebarOpen', String(open));
    setSidebarOpen(open);
  };

  const createInternalUser = async (form) => {
    const validationError = validateUserForm(form);
    if (validationError) throw new Error(validationError);

    const user = await createProvisionedAuthUser(form.email.trim(), form.password);
    await update(ref(database), buildUserUpdates(user, form));
    return user;
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setUserMessage('');
    setUserError('');
    setIsCreatingUser(true);

    try {
      await createInternalUser(userForm);
      setUserMessage(`${userForm.role === 'student' ? 'Student' : 'Faculty'} account created successfully.`);
      setUserForm({ ...INITIAL_USER_FORM, role: userForm.role });
      await loadManagedUsers();
    } catch (error) {
      setUserError(error.message || 'Failed to create account.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleBatchFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(mapBatchRow);
    setBatchRows(rows);
    setBatchResult(`${rows.length} row${rows.length === 1 ? '' : 's'} ready for review.`);
  };

  const handleBatchCreate = async () => {
    setIsUploadingBatch(true);
    let created = 0;
    const failed = [];

    for (const [index, row] of batchRows.entries()) {
      try {
        await createInternalUser(row);
        created += 1;
      } catch (error) {
        failed.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    setBatchResult(`Created ${created} account${created === 1 ? '' : 's'}.${failed.length ? ` Failed ${failed.length}: ${failed.slice(0, 3).join(' | ')}` : ''}`);
    await loadManagedUsers();
    setIsUploadingBatch(false);
  };

  const handleUserRoleToggle = (userId, roleId) => {
    const target = managedUsers.find((user) => user.user_id === userId);
    if (!target) return;

    const currentRoleIds = Array.isArray(target.role_ids) ? target.role_ids : [target.role_id];
    const nextRoleIds = currentRoleIds.includes(roleId)
      ? currentRoleIds.filter((id) => id !== roleId)
      : [...currentRoleIds, roleId];

    if (!nextRoleIds.length) {
      setUserAdminMessage('A user must have at least one role.');
      return;
    }

    const primaryRoleId = nextRoleIds.includes(target.role_id) ? target.role_id : nextRoleIds[0];
    setManagedUsers((current) => current.map((user) =>
      user.user_id === userId ? {
        ...user,
        role_id: primaryRoleId,
        role_ids: nextRoleIds,
        permissions: effectiveUserPermissions(rolePermissions, userPermissions, userId, nextRoleIds),
      } : user
    ));
    setHasPermissionDraftChanges(true);
    setUserAdminMessage('Role changes staged. Click Save changes to apply.');
  };

  const handleRolePermissionToggle = (roleId, permissionId) => {
    const id = rolePermissionId(roleId, permissionId);
    const exists = Boolean(rolePermissions[id]);

    const nextRolePermissions = { ...rolePermissions };
    if (exists) {
      delete nextRolePermissions[id];
    } else {
      nextRolePermissions[id] = {
        role_permission_id: id,
        role_id: roleId,
        permission_id: permissionId,
      };
    }

    setRolePermissions(nextRolePermissions);
    setManagedUsers((current) => current.map((user) => ({
      ...user,
      permissions: effectiveUserPermissions(
        nextRolePermissions,
        userPermissions,
        user.user_id,
        user.role_ids || [user.role_id]
      ),
    })));
    setHasPermissionDraftChanges(true);
    setUserAdminMessage('Role permission changes staged. Click Save changes to apply.');
  };

  const handleUserPermissionToggle = (userId, permissionId) => {
    const target = managedUsers.find((user) => user.user_id === userId);
    if (!target) return;

    const id = userPermissionId(userId, permissionId);
    const nextAllowed = !target.permissions?.[permissionId];
    const record = {
      user_permission_id: id,
      user_id: userId,
      permission_id: permissionId,
      allowed: nextAllowed,
    };

    const nextUserPermissions = {
      ...userPermissions,
      [id]: record,
    };
    setUserPermissions(nextUserPermissions);

    setManagedUsers((current) => current.map((user) => {
      if (user.user_id !== userId) return user;
      return {
        ...user,
        permissions: effectiveUserPermissions(rolePermissions, nextUserPermissions, userId, user.role_ids || [user.role_id]),
      };
    }));
    setHasPermissionDraftChanges(true);
    setUserAdminMessage('User permission override staged. Click Save changes to apply.');
  };

  const handleSaveRolePermissionChanges = async () => {
    const updates = {};

    Object.entries(rolePermissions).forEach(([id, record]) => {
      updates[`role_permissions/${id}`] = record;
    });
    Object.keys(savedRolePermissions).forEach((id) => {
      if (!rolePermissions[id]) {
        updates[`role_permissions/${id}`] = null;
      }
    });

    Object.entries(userPermissions).forEach(([id, record]) => {
      updates[`user_permissions/${id}`] = record;
    });
    Object.keys(savedUserPermissions).forEach((id) => {
      if (!userPermissions[id]) {
        updates[`user_permissions/${id}`] = null;
      }
    });

    managedUsers.forEach((user) => {
      const savedRoles = savedUserRoles[user.user_id] || {};
      const currentRoleIds = user.role_ids || [user.role_id];
      const savedRoleIds = savedRoles.role_ids || [savedRoles.role_id].filter(Boolean);
      const roleIdsChanged = JSON.stringify([...currentRoleIds].sort()) !== JSON.stringify([...savedRoleIds].sort());
      const primaryRoleChanged = user.role_id !== savedRoles.role_id;

      if (roleIdsChanged || primaryRoleChanged) {
        updates[`users/${user.user_id}/role_id`] = user.role_id;
        updates[`users/${user.user_id}/role_ids`] = currentRoleIds;
      }
    });

    if (!Object.keys(updates).length) {
      setUserAdminMessage('No role or permission changes to save.');
      setHasPermissionDraftChanges(false);
      return;
    }

    await update(ref(database), updates);

    const updatedCurrentUser = managedUsers.find((user) => user.user_id === currentUser?.uid);
    if (updatedCurrentUser) {
      const nextCurrentUser = {
        ...currentUser,
        userType: updatedCurrentUser.role_id,
        roleIds: updatedCurrentUser.role_ids || [updatedCurrentUser.role_id],
        permissions: updatedCurrentUser.permissions,
        name: updatedCurrentUser.display_name || currentUser.name,
        username: updatedCurrentUser.username || currentUser.username,
      };
      setCurrentUser(nextCurrentUser);
      localStorage.setItem('currentUser', JSON.stringify(nextCurrentUser));
    }

    setSavedRolePermissions(rolePermissions);
    setSavedUserPermissions(userPermissions);
    setSavedUserRoles(managedUsers.reduce((acc, user) => {
      acc[user.user_id] = {
        role_id: user.role_id,
        role_ids: user.role_ids || [user.role_id],
      };
      return acc;
    }, {}));
    setHasPermissionDraftChanges(false);
    setUserAdminMessage('Role and permission changes saved.');
  };

  const handleStatusChange = async (userId, status) => {
    await update(ref(database), { [`users/${userId}/status`]: status });
    setManagedUsers((current) => current.map((user) =>
      user.user_id === userId ? { ...user, status } : user
    ));
    setUserAdminMessage(status === 'inactive' ? 'Account deactivated.' : 'Account reactivated.');
  };

  const handleSaveFloor = async (event) => {
    event.preventDefault();
    const floorId = sanitizeId(floorForm.floorId || floorForm.floorName);
    const floorRecord = {
      floor_id: floorId,
      floor_name: floorForm.floorName.trim(),
      sort_order: Number(floorForm.sortOrder || floors.length + 1),
      status: floorForm.status,
    };

    await update(ref(database), { [`floors/${floorId}`]: floorRecord });
    setFloors((current) => [...current.filter((floor) => floor.floor_id !== floorId), floorRecord].sort((a, b) => a.sort_order - b.sort_order));
    setFloorForm(INITIAL_FLOOR_FORM);
    setRoomMessage('Floor saved.');
  };

  const handleEditFloor = (floor) => {
    setFloorForm({
      floorId: floor.floor_id || '',
      floorName: floor.floor_name || '',
      sortOrder: floor.sort_order || '',
      status: floor.status || 'active',
    });
    setRoomMessage('Editing floor. Save changes when ready.');
  };

  const handleDeleteFloor = async (floorId) => {
    if (!window.confirm('Delete this floor? Rooms using this floor will keep their current floor text.')) return;

    await remove(ref(database, `floors/${floorId}`));
    setFloors((current) => current.filter((floor) => floor.floor_id !== floorId));
    setFloorForm((current) => current.floorId === floorId ? INITIAL_FLOOR_FORM : current);
    setRoomMessage('Floor deleted.');
  };

  const handleSaveRoom = async (event) => {
    event.preventDefault();
    const roomId = sanitizeId(roomForm.roomId || roomForm.roomName);
    const roomRecord = {
      room_id: roomId,
      room_name: roomForm.roomName.trim(),
      building: roomForm.building.trim(),
      floor: roomForm.floor.trim(),
      room_status: roomForm.roomStatus,
    };

    await update(ref(database), { [`rooms/${roomId}`]: roomRecord });
    setRooms((current) => [...current.filter((room) => room.room_id !== roomId), roomRecord].sort((a, b) => a.room_name.localeCompare(b.room_name)));
    setRoomForm(INITIAL_ROOM_FORM);
    setRoomMessage('Room saved.');
  };

  const handleEditRoom = (room) => {
    setRoomForm({
      roomId: room.room_id || '',
      roomName: room.room_name || '',
      building: room.building || '',
      floor: room.floor || '',
      roomStatus: room.room_status || 'Available',
    });
    setRoomMessage('Editing room. Save changes when ready.');
  };

  const handleSetRoomStatus = async (room, roomStatus) => {
    await update(ref(database), { [`rooms/${room.room_id}/room_status`]: roomStatus });
    setRooms((current) => current.map((item) =>
      item.room_id === room.room_id ? { ...item, room_status: roomStatus } : item
    ));
    setRoomMessage(`${room.room_name || room.room_id} set to ${roomStatus}.`);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room?')) return;

    await remove(ref(database, `rooms/${roomId}`));
    setRooms((current) => current.filter((room) => room.room_id !== roomId));
    setRoomForm((current) => current.roomId === roomId ? INITIAL_ROOM_FORM : current);
    setRoomMessage('Room deleted.');
  };

  const renderNavigation = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{metric.value}</p>
                </div>
                <div className={`rounded-md p-3 ${metric.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">{metric.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionPanel title="Faculty Overview">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Room</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaculty.map((faculty) => (
                  <tr key={faculty.name}>
                    <td className="py-3 pr-4 font-medium text-slate-950">{faculty.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{faculty.department}</td>
                    <td className="py-3 pr-4 text-slate-600">{faculty.room}</td>
                    <td className="py-3 pr-4"><StatusBadge status={faculty.status} /></td>
                    <td className="py-3 text-slate-600">{faculty.load}</td>
                  </tr>
                ))}
                {!filteredFaculty.length && (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan="5">No faculty records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionPanel>

        <SectionPanel title="Admin Workflows">
          <div className="grid gap-3">
            {[
              ['Create account', 'accounts', FaUserPlus],
              ['Manage roles', 'users', FaUserShield],
              ['Upload users', 'batch', FaUpload],
              ['Manage rooms', 'rooms', FaLayerGroup],
            ].map(([label, tab, Icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>{label}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </SectionPanel>
      </div>
    </div>
  );

  const renderAccounts = () => (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionPanel title="Internal Signup" description="Create student and faculty accounts from the admin console.">
        <form className="space-y-4" onSubmit={handleCreateUser}>
          <Field label="Account Type">
            <select className={fieldClass()} value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={userForm.role === 'student' ? 'Student Number' : 'Faculty ID'}>
              <input
                className={fieldClass()}
                value={userForm.role === 'student' ? userForm.studentNumber : userForm.facultyId}
                onChange={(event) => setUserForm({
                  ...userForm,
                  [userForm.role === 'student' ? 'studentNumber' : 'facultyId']: event.target.value,
                })}
                placeholder={userForm.role === 'student' ? '02000123456' : 'NVS0690F'}
              />
            </Field>
            <Field label="Department">
              <input className={fieldClass()} value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} disabled={userForm.role === 'student'} placeholder="Faculty only" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First Name">
              <input className={fieldClass()} value={userForm.firstName} onChange={(event) => setUserForm({ ...userForm, firstName: event.target.value })} />
            </Field>
            <Field label="Middle Name">
              <input className={fieldClass()} value={userForm.middleName} onChange={(event) => setUserForm({ ...userForm, middleName: event.target.value })} />
            </Field>
            <Field label="Last Name">
              <input className={fieldClass()} value={userForm.lastName} onChange={(event) => setUserForm({ ...userForm, lastName: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input className={fieldClass()} type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} placeholder="name@novaliches.sti.edu.ph" />
            </Field>
            <Field label="Temporary Password">
              <input className={fieldClass()} type="text" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
            </Field>
          </div>

          {userError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{userError}</p>}
          {userMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{userMessage}</p>}

          <button type="submit" disabled={isCreatingUser} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            <FaSave className="h-3.5 w-3.5" />
            {isCreatingUser ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </SectionPanel>

      <SectionPanel title="Faculty Directory">
        <div className="mb-4 max-w-md">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search faculty" className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                <th className="pb-3 pr-4">Faculty</th>
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Current Room</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFaculty.map((faculty) => (
                <tr key={faculty.name}>
                  <td className="py-3 pr-4 font-medium text-slate-950">{faculty.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{faculty.department}</td>
                  <td className="py-3 pr-4 text-slate-600">{faculty.room}</td>
                  <td className="py-3"><StatusBadge status={faculty.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <SectionPanel
        title="Role Permissions"
        description="Assign permissions to each role. Users inherit permissions through their selected role."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadManagedUsers} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSaveRolePermissionChanges}
              disabled={!hasPermissionDraftChanges}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaSave className="h-4 w-4" />
              Save changes
            </button>
          </div>
        }
      >
        {userAdminMessage && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{userAdminMessage}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                <th className="pb-3 pr-4">Role</th>
                {PERMISSIONS.map((permission) => (
                  <th key={permission.permission_id} className="pb-3 pr-4">{permission.permission_name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(ROLES).map((role) => (
                <tr key={role.role_id}>
                  <td className="py-3 pr-4 font-semibold text-slate-950">{role.role_name}</td>
                  {PERMISSIONS.map((permission) => {
                    const id = rolePermissionId(role.role_id, permission.permission_id);
                    return (
                      <td key={id} className="py-3 pr-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={Boolean(rolePermissions[id])}
                          onChange={() => handleRolePermissionToggle(role.role_id, permission.permission_id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      <SectionPanel title="Users" description="Assign roles, search accounts, customize individual permissions, and deactivate access.">
        <div className="mb-4 max-w-md">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={userSearchTerm}
              onChange={(event) => setUserSearchTerm(event.target.value)}
              placeholder="Search by name, email, role, status, or user ID"
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{filteredManagedUsers.length} users</p>
            </div>
            <div className="max-h-[36rem] overflow-y-auto">
              {filteredManagedUsers.map((user) => (
                <button
                  key={user.user_id}
                  type="button"
                  onClick={() => setSelectedUserId(user.user_id)}
                  className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    selectedUserId === user.user_id ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{user.display_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.username}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(user.role_ids || [user.role_id]).map((roleId) => (
                        <span key={roleId} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
                          {ROLES[roleId]?.role_name || roleId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <StatusBadge status={user.status || 'active'} />
                </button>
              ))}
              {!filteredManagedUsers.length && (
                <p className="px-4 py-6 text-sm text-slate-500">No users found.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            {selectedUser ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{selectedUser.display_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedUser.username}</p>
                    <p className="mt-1 text-xs text-slate-400">{selectedUser.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedUser.status || 'active'} />
                    {selectedUser.status === 'inactive' ? (
                      <button type="button" onClick={() => handleStatusChange(selectedUser.user_id, 'active')} className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                        Reactivate
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleStatusChange(selectedUser.user_id, 'inactive')} className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-950">Roles</h4>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {Object.values(ROLES).map((role) => (
                      <label key={role.role_id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={Boolean(selectedUser.role_ids?.includes(role.role_id))}
                          onChange={() => handleUserRoleToggle(selectedUser.user_id, role.role_id)}
                        />
                        {role.role_name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-950">User Permissions</h4>
                  <p className="mt-1 text-xs text-slate-500">These settings override the selected user's role defaults.</p>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {PERMISSIONS.map((permission) => {
                      const overrideId = userPermissionId(selectedUser.user_id, permission.permission_id);
                      const hasOverride = Boolean(userPermissions[overrideId]);

                      return (
                        <div key={permission.permission_id} className={`rounded-md border px-3 py-2 ${hasOverride ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={Boolean(selectedUser.permissions?.[permission.permission_id])}
                              onChange={() => handleUserPermissionToggle(selectedUser.user_id, permission.permission_id)}
                            />
                            {permission.permission_name}
                          </label>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-400">
                              {hasOverride ? 'Custom override' : 'Role default'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-center">
                <div>
                  <FaUserShield className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Select a user</p>
                  <p className="mt-1 text-sm text-slate-500">Choose a user from the list to edit roles and permissions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionPanel>
    </div>
  );

  const renderBatch = () => (
    <div className="space-y-6">
      <SectionPanel title="Batch Upload" description="Upload .xlsx, .xls, or .csv files to create student and faculty accounts internally.">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
            <FaFileUpload className="h-8 w-8 text-blue-600" />
            <h3 className="mt-4 text-sm font-semibold text-slate-950">Upload account list</h3>
            <p className="mt-2 text-sm text-slate-500">Required columns: {batchColumns.join(', ')}.</p>
            <input className="mt-5 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700" type="file" accept=".xlsx,.xls,.csv" onChange={handleBatchFile} />
            {batchResult && <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{batchResult}</p>}
            <button type="button" disabled={!batchRows.length || isUploadingBatch} onClick={handleBatchCreate} className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <FaUpload className="h-3.5 w-3.5" />
              {isUploadingBatch ? 'Creating Accounts...' : 'Create Batch Accounts'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">ID</th>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchRows.slice(0, 8).map((row, index) => (
                  <tr key={`${row.email}-${index}`}>
                    <td className="py-3 pr-4 capitalize text-slate-600">{row.role}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.role === 'student' ? row.studentNumber : row.facultyId}</td>
                    <td className="py-3 pr-4 font-medium text-slate-950">{[row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ')}</td>
                    <td className="py-3 text-slate-600">{row.email}</td>
                  </tr>
                ))}
                {!batchRows.length && (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan="4">No file uploaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionPanel>
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionPanel title="Manage Floors">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSaveFloor}>
            <Field label="Floor ID">
              <input className={fieldClass()} value={floorForm.floorId} onChange={(event) => setFloorForm({ ...floorForm, floorId: event.target.value })} placeholder="3f" />
            </Field>
            <Field label="Floor Name">
              <input className={fieldClass()} value={floorForm.floorName} onChange={(event) => setFloorForm({ ...floorForm, floorName: event.target.value })} placeholder="3rd Floor" />
            </Field>
            <Field label="Sort Order">
              <input className={fieldClass()} type="number" value={floorForm.sortOrder} onChange={(event) => setFloorForm({ ...floorForm, sortOrder: event.target.value })} />
            </Field>
            <Field label="Status">
              <select className={fieldClass()} value={floorForm.status} onChange={(event) => setFloorForm({ ...floorForm, status: event.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button className="inline-flex w-fit items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <FaSave className="h-3.5 w-3.5" />
                Save Floor
              </button>
              <button type="button" onClick={() => setFloorForm(INITIAL_FLOOR_FORM)} className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Manage Rooms">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSaveRoom}>
            <Field label="Room ID">
              <input className={fieldClass()} value={roomForm.roomId} onChange={(event) => setRoomForm({ ...roomForm, roomId: event.target.value })} placeholder="room-301" />
            </Field>
            <Field label="Room Name">
              <input className={fieldClass()} value={roomForm.roomName} onChange={(event) => setRoomForm({ ...roomForm, roomName: event.target.value })} placeholder="Room 301" />
            </Field>
            <Field label="Building">
              <input className={fieldClass()} value={roomForm.building} onChange={(event) => setRoomForm({ ...roomForm, building: event.target.value })} placeholder="Main Building" />
            </Field>
            <Field label="Floor">
              <select className={fieldClass()} value={roomForm.floor} onChange={(event) => setRoomForm({ ...roomForm, floor: event.target.value })}>
                <option value="">Select floor</option>
                {floors.map((floor) => <option key={floor.floor_id} value={floor.floor_name}>{floor.floor_name}</option>)}
              </select>
            </Field>
            <Field label="Room Status">
              <select className={fieldClass()} value={roomForm.roomStatus} onChange={(event) => setRoomForm({ ...roomForm, roomStatus: event.target.value })}>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Reserved">Reserved</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button className="inline-flex w-fit items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <FaSave className="h-3.5 w-3.5" />
                Save Room
              </button>
              <button type="button" onClick={() => setRoomForm(INITIAL_ROOM_FORM)} className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
            </div>
          </form>
        </SectionPanel>
      </div>

      {roomMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{roomMessage}</p>}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SectionPanel title="Floors">
          <div className="space-y-3">
            {floors.map((floor) => (
              <div key={floor.floor_id} className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{floor.floor_name}</p>
                  <p className="text-xs text-slate-500">{floor.floor_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={floor.status} />
                  <button type="button" onClick={() => handleEditFloor(floor)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <FaEdit className="h-3 w-3" />
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDeleteFloor(floor.floor_id)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                    <FaTrash className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!floors.length && <p className="text-sm text-slate-500">No floors saved yet.</p>}
          </div>
        </SectionPanel>

        <SectionPanel title="Rooms">
          <div className="grid gap-4 md:grid-cols-2">
            {roomRows.map((room) => (
              <div key={room.room_id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{room.room_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{room.building || 'No building set'}</p>
                  </div>
                  <StatusBadge status={room.room_status} />
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Floor</dt>
                    <dd className="font-medium text-slate-700">{room.floor || 'Unassigned'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Room ID</dt>
                    <dd className="font-medium text-slate-700">{room.room_id}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <button type="button" onClick={() => handleSetRoomStatus(room, 'Available')} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                    Available
                  </button>
                  <button type="button" onClick={() => handleSetRoomStatus(room, 'Reserved')} className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                    Reserve
                  </button>
                  <button type="button" onClick={() => handleSetRoomStatus(room, 'Under Maintenance')} className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                    Maintenance
                  </button>
                  <button type="button" onClick={() => handleEditRoom(room)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">
                    <FaEdit className="h-3 w-3" />
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDeleteRoom(room.room_id)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                    <FaTrash className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!roomRows.length && <p className="text-sm text-slate-500">No rooms saved yet.</p>}
          </div>
        </SectionPanel>
      </div>
    </div>
  );

  const renderReports = () => (
    <SectionPanel title="Reports">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase text-slate-500">
              <th className="pb-3 pr-4">Report</th>
              <th className="pb-3 pr-4">Owner</th>
              <th className="pb-3 pr-4">Updated</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {liveReportRows.map((report) => (
              <tr key={report.name}>
                <td className="py-3 pr-4 font-medium text-slate-950">{report.name}</td>
                <td className="py-3 pr-4 text-slate-600">{report.owner}</td>
                <td className="py-3 pr-4 text-slate-600">{report.updated}</td>
                <td className="py-3 pr-4"><StatusBadge status={report.status} /></td>
                <td className="py-3 text-slate-600">{report.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  );

  const renderSettings = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionPanel title="Access Control">
        <div className="space-y-4">
          {[
            ['Admin account', 'Full dashboard access'],
            ['Faculty account', 'Upload schedules and view locator by default'],
            ['Student account', 'View faculty locator by default'],
          ].map(([role, description]) => (
            <div key={role} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{role}</p>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </div>
              <StatusBadge status="Ready" />
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Security">
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
            <span>Firebase authentication</span>
            <span className="font-semibold text-emerald-700">Enabled</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
            <span>Public signup</span>
            <span className="font-semibold text-emerald-700">Hidden</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
            <span>Admin route guard</span>
            <span className="font-semibold text-emerald-700">Enabled</span>
          </div>
        </div>
      </SectionPanel>
    </div>
  );

  const pageContent = {
    dashboard: renderDashboard,
    accounts: renderAccounts,
    users: renderUsers,
    batch: renderBatch,
    rooms: renderRooms,
    reports: renderReports,
    settings: renderSettings,
  };

  const activeLabel = navItems.find((item) => item.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-14 text-slate-950">
      <aside className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-[width] duration-300 ease-in-out ${sidebarOpen ? 'w-72' : 'w-0 border-r-0 shadow-none'}`}>
        <div className={`relative h-full w-72 px-4 py-5 transition-opacity duration-200 ease-in-out ${sidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <FaUserShield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">STI Locator</p>
              <p className="text-xs text-slate-500">Admin Console</p>
            </div>
          </div>
        </div>

        <div className="mt-8">{renderNavigation()}</div>

        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 shadow-sm">
          <div className="flex h-14 w-full items-center justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <button
                className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
                onClick={() => setSidebarPreference(!sidebarOpen)}
                aria-label="Toggle menu"
              >
                <FaBars className="h-5 w-5" />
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <img src={logo} alt="STI Locator" className="h-9 w-auto" />
                <p className="hidden truncate text-sm font-semibold text-slate-900 sm:block">STI Locator</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-slate-600">
              <Link to="/home" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Modules">
                <MdApps className="h-5 w-5" />
              </Link>
              <NotificationBell database={database} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-2"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <FaUserCircle className="h-9 w-9 text-slate-300" />
                  <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 md:inline">{currentUser?.name || currentUser?.username || 'User'}</span>
                  <FaChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-11 z-50 w-56 rounded-sm border border-slate-200 bg-white py-2 text-sm text-slate-600 shadow-xl" role="menu">
                    <button type="button" onClick={() => showUserProfile(currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">My profile</button>
                    <button type="button" onClick={() => changeCurrentUserPassword(database, currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">Change password</button>
                    <div className="my-2 border-t border-slate-200" />
                    <button type="button" onClick={toggleThemeSetting} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">Theme settings</button>
                    <button type="button" onClick={handleLogout} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">{activeLabel}</h2>
              <p className="mt-1 text-sm text-slate-500">Create internal accounts, import users, and manage campus floors and rooms.</p>
            </div>
          </div>

          {pageContent[activeTab]()}
        </main>
      </div>
    </div>
  );
}

export default Admin;
