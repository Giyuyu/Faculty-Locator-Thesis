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
  FaFileUpload,
  FaLayerGroup,
  FaCopy,
  FaDownload,
  FaKey,
  FaEye,
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
  openThemeSettings,
  openUserProfile,
  signOutCurrentUser,
} from '../../utils/profileActions';

const ROLES = {
  admin: { role_id: 'admin', role_name: 'Admin' },
  faculty: { role_id: 'faculty', role_name: 'Faculty' },
  student: { role_id: 'student', role_name: 'Student' },
};

const ALL_ROLE_IDS = Object.keys(ROLES);

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

const INITIAL_UPLOAD_CONTEXT = {
  schoolYear: '',
  term: '',
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
  archived: 'bg-slate-100 text-slate-700 ring-slate-200',
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

function normalizeHeaderCell(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getBatchRowsFromSheet(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  const requiredHeaders = ['role', 'first_name', 'last_name', 'email'];
  const headerRowIndex = rawRows.findIndex((row) => {
    const headers = row.map(normalizeHeaderCell);
    return requiredHeaders.every((header) => headers.includes(header));
  });

  if (headerRowIndex < 0) {
    throw new Error('Template headers were not found. Please use the STI Locator batch account template.');
  }

  const headers = rawRows[headerRowIndex].map(normalizeHeaderCell);
  const cell = (row, key) => {
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : '';
  };

  return rawRows
    .slice(headerRowIndex + 1)
    .map((row, index) => ({
      role: String(cell(row, 'role') || '').trim().toLowerCase(),
      studentNumber: String(cell(row, 'student_number') || cell(row, 'student_id') || '').trim(),
      facultyId: String(cell(row, 'faculty_id') || '').trim(),
      firstName: String(cell(row, 'first_name') || '').trim(),
      middleName: String(cell(row, 'middle_name') || '').trim(),
      lastName: String(cell(row, 'last_name') || '').trim(),
      department: String(cell(row, 'department') || '').trim(),
      email: String(cell(row, 'email') || '').trim(),
      password: String(cell(row, 'password') || '').trim(),
      __rowNumber: headerRowIndex + index + 2,
    }))
    .filter(hasBatchRowContent);
}

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

function sanitizeId(value) {
  return String(value || '').trim().replace(/[.#$/[\]]/g, '-');
}

function generateTemporaryPassword() {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const numericPart = String(Math.floor(1000 + Math.random() * 9000));
  return `Temp@${randomPart}${numericPart}`;
}

function rolePermissionId(roleId, permissionId) {
  return `${roleId}_${permissionId}`;
}

function userPermissionId(userId, permissionId) {
  return `${userId}_${permissionId}`;
}

function userRecordPath(user) {
  return `users/${user.user_key || user.user_id}`;
}

function resolveAccountStatus(user, profile) {
  const userStatus = String(user?.status || '').toLowerCase();
  const profileStatus = String(profile?.status || '').toLowerCase();

  if (['deleted', 'archived'].includes(userStatus) || ['deleted', 'archived'].includes(profileStatus)) {
    return userStatus === 'deleted' || profileStatus === 'deleted' ? 'deleted' : 'archived';
  }

  if (userStatus === 'inactive' || profileStatus === 'inactive') return 'inactive';
  return 'active';
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

function normalizeAssignedRoles(roleIds) {
  const uniqueRoleIds = [...new Set(roleIds.filter((roleId) => ROLES[roleId]))];
  if (uniqueRoleIds.includes('admin')) return ALL_ROLE_IDS;
  return uniqueRoleIds.length ? uniqueRoleIds : ['student'];
}

function effectiveUserPermissions(rolePermissions, userPermissions, userId, roleIds) {
  const basePermissions = permissionMapFromRoles(rolePermissions, roleIds);
  return ensureAdminPermissions(
    roleIds,
    applyUserPermissionOverrides(basePermissions, userPermissions, userId)
  );
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

function buildUserUpdates(user, form, uploadMeta = null) {
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
      ...(uploadMeta ? {
        account_upload_id: uploadMeta.uploadId,
        school_year: uploadMeta.schoolYear,
        term: uploadMeta.term,
      } : {}),
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
      status,
      ...(uploadMeta ? {
        account_upload_id: uploadMeta.uploadId,
        school_year: uploadMeta.schoolYear,
        term: uploadMeta.term,
      } : {}),
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
      ...(uploadMeta ? {
        account_upload_id: uploadMeta.uploadId,
        school_year: uploadMeta.schoolYear,
        term: uploadMeta.term,
      } : {}),
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

function normalizeUniqueValue(value) {
  return String(value || '').trim().toLowerCase();
}

function buildAccountDuplicateIndex(data = {}) {
  const index = {
    emails: new Set(),
    usernames: new Set(),
    studentNumbers: new Set(),
    facultyIds: new Set(),
  };

  Object.values(data.users || {}).forEach((user) => {
    const username = normalizeUniqueValue(user?.username);
    const email = normalizeUniqueValue(user?.email);
    if (username) {
      index.usernames.add(username);
      index.emails.add(username);
    }
    if (email) {
      index.emails.add(email);
      index.usernames.add(email);
    }
  });

  Object.values(data.students || {}).forEach((student) => {
    const studentNumber = normalizeUniqueValue(student?.student_number || student?.student_id);
    if (studentNumber) index.studentNumbers.add(studentNumber);
  });

  Object.values(data.faculties || {}).forEach((faculty) => {
    const facultyId = normalizeUniqueValue(faculty?.faculty_id);
    const email = normalizeUniqueValue(faculty?.email);
    if (facultyId) index.facultyIds.add(facultyId);
    if (email) index.emails.add(email);
  });

  return index;
}

function addAccountToDuplicateIndex(index, form) {
  const email = normalizeUniqueValue(form.email);
  if (email) {
    index.emails.add(email);
    index.usernames.add(email);
  }

  if (form.role === 'student') {
    const studentNumber = normalizeUniqueValue(form.studentNumber);
    if (studentNumber) index.studentNumbers.add(studentNumber);
  }

  if (form.role === 'faculty') {
    const facultyId = normalizeUniqueValue(form.facultyId);
    if (facultyId) index.facultyIds.add(facultyId);
  }
}

function validateUniqueUserForm(form, duplicateIndex) {
  const email = normalizeUniqueValue(form.email);
  if (email && (duplicateIndex.emails.has(email) || duplicateIndex.usernames.has(email))) {
    return `Email already exists: ${form.email}`;
  }

  if (form.role === 'student') {
    const studentNumber = normalizeUniqueValue(form.studentNumber);
    if (studentNumber && duplicateIndex.studentNumbers.has(studentNumber)) {
      return `Student number already exists: ${form.studentNumber}`;
    }
  }

  if (form.role === 'faculty') {
    const facultyId = normalizeUniqueValue(form.facultyId);
    if (facultyId && duplicateIndex.facultyIds.has(facultyId)) {
      return `Faculty ID already exists: ${form.facultyId}`;
    }
  }

  return '';
}

function hasBatchRowContent(row) {
  return [
    row.role,
    row.studentNumber,
    row.facultyId,
    row.firstName,
    row.middleName,
    row.lastName,
    row.department,
    row.email,
    row.password,
  ].some((value) => String(value || '').trim());
}

function buildBatchImportPlan(rows, duplicateIndex) {
  const seen = {
    emails: new Map(),
    studentNumbers: new Map(),
    facultyIds: new Map(),
  };
  const acceptedRows = [];
  const skippedRows = [];

  rows.forEach((row, index) => {
    const rowNumber = row.__rowNumber || index + 2;
    const issues = [];
    const validationError = validateUserForm(row);
    const email = normalizeUniqueValue(row.email);
    const studentNumber = normalizeUniqueValue(row.studentNumber);
    const facultyId = normalizeUniqueValue(row.facultyId);

    if (validationError) issues.push(validationError);

    if (email) {
      if (duplicateIndex.emails.has(email) || duplicateIndex.usernames.has(email)) {
        issues.push(`email already exists (${row.email})`);
      }
      if (seen.emails.has(email)) {
        issues.push(`duplicate email with row ${seen.emails.get(email)} (${row.email})`);
      }
    }

    if (row.role === 'student' && studentNumber) {
      if (duplicateIndex.studentNumbers.has(studentNumber)) {
        issues.push(`student number already exists (${row.studentNumber})`);
      }
      if (seen.studentNumbers.has(studentNumber)) {
        issues.push(`duplicate student number with row ${seen.studentNumbers.get(studentNumber)} (${row.studentNumber})`);
      }
    }

    if (row.role === 'faculty' && facultyId) {
      if (duplicateIndex.facultyIds.has(facultyId)) {
        issues.push(`faculty ID already exists (${row.facultyId})`);
      }
      if (seen.facultyIds.has(facultyId)) {
        issues.push(`duplicate faculty ID with row ${seen.facultyIds.get(facultyId)} (${row.facultyId})`);
      }
    }

    if (issues.length) {
      skippedRows.push({
        rowNumber,
        row,
        issues,
      });
      return;
    }

    acceptedRows.push(row);
    if (email) seen.emails.set(email, rowNumber);
    if (row.role === 'student' && studentNumber) seen.studentNumbers.set(studentNumber, rowNumber);
    if (row.role === 'faculty' && facultyId) seen.facultyIds.set(facultyId, rowNumber);
  });

  return {
    acceptedRows,
    skippedRows,
  };
}

function formatBatchSkippedSummary(skippedRows) {
  if (!skippedRows.length) return '';
  const summaries = skippedRows.slice(0, 3).map((item) => `Row ${item.rowNumber}: ${item.issues.join(', ')}`);
  return `${summaries.join(' | ')}${skippedRows.length > 3 ? ` | +${skippedRows.length - 3} more` : ''}`;
}

function excelColorToCss(color) {
  const rgb = color?.rgb || color?.fgColor?.rgb || '';
  if (!rgb) return '';
  const normalized = rgb.length === 8 ? rgb.slice(2) : rgb;
  return `#${normalized}`;
}

function workbookCellStyle(cell) {
  const style = cell?.s || {};
  const css = {};
  const fillColor = excelColorToCss(style.fgColor || style.fill?.fgColor);
  const fontColor = excelColorToCss(style.font?.color);
  const cellValue = String(cell?.w ?? cell?.v ?? '');

  if (fillColor && fillColor.toLowerCase() !== '#ffffff') css.backgroundColor = fillColor;
  if (fontColor) css.color = fontColor;
  if (style.font?.bold || (fillColor && cellValue)) css.fontWeight = 700;
  if (style.font?.italic) css.fontStyle = 'italic';
  if (style.font?.sz) css.fontSize = `${Math.max(8, Number(style.font.sz))}px`;
  if (style.alignment?.horizontal) css.textAlign = style.alignment.horizontal;
  if (style.alignment?.vertical) css.verticalAlign = style.alignment.vertical;
  if (style.alignment?.wrapText || cellValue.includes('\n')) css.whiteSpace = 'pre-line';

  return css;
}

function buildWorkbookDocumentPreview(workbook, fileName) {
  const sheets = workbook.SheetNames.map((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName];
    const fallbackRange = { s: { r: 0, c: 0 }, e: { r: 32, c: 8 } };
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : fallbackRange;
    const maxRow = Math.min(range.e.r, range.s.r + 79);
    const maxCol = Math.min(range.e.c, range.s.c + 17);
    const merges = sheet['!merges'] || [];
    const coveredCells = new Set();
    const mergeStarts = {};

    merges.forEach((merge) => {
      if (merge.e.r < range.s.r || merge.e.c < range.s.c || merge.s.r > maxRow || merge.s.c > maxCol) return;
      const startKey = `${merge.s.r}:${merge.s.c}`;
      mergeStarts[startKey] = {
        rowSpan: Math.min(merge.e.r, maxRow) - merge.s.r + 1,
        colSpan: Math.min(merge.e.c, maxCol) - merge.s.c + 1,
      };
      for (let r = merge.s.r; r <= Math.min(merge.e.r, maxRow); r += 1) {
        for (let c = merge.s.c; c <= Math.min(merge.e.c, maxCol); c += 1) {
          if (r !== merge.s.r || c !== merge.s.c) coveredCells.add(`${r}:${c}`);
        }
      }
    });

    const columnWidths = [];
    for (let c = range.s.c; c <= maxCol; c += 1) {
      const col = sheet['!cols']?.[c] || {};
      columnWidths.push(Math.max(42, Math.min(240, Number(col.wpx || (col.wch ? col.wch * 7 : 86)))));
    }

    const rows = [];
    for (let r = range.s.r; r <= maxRow; r += 1) {
      const cells = [];
      for (let c = range.s.c; c <= maxCol; c += 1) {
        if (coveredCells.has(`${r}:${c}`)) continue;
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[address] || {};
        const merge = mergeStarts[`${r}:${c}`] || {};

        cells.push({
          key: address,
          value: cell.w ?? cell.v ?? '',
          rowSpan: merge.rowSpan || 1,
          colSpan: merge.colSpan || 1,
          style: workbookCellStyle(cell),
        });
      }
      rows.push({
        index: r + 1,
        height: Math.max(20, Math.min(90, Number(sheet['!rows']?.[r]?.hpx || 22))),
        cells,
      });
    }

    return {
      name: sheetName,
      rows,
      columnWidths,
    };
  });

  return {
    fileName,
    sheets,
  };
}

async function fetchAccountDuplicateIndex() {
  const [usersSnapshot, studentsSnapshot, facultiesSnapshot] = await Promise.all([
    get(ref(database, 'users')),
    get(ref(database, 'students')),
    get(ref(database, 'faculties')),
  ]);

  return buildAccountDuplicateIndex({
    users: usersSnapshot.exists() ? usersSnapshot.val() : {},
    students: studentsSnapshot.exists() ? studentsSnapshot.val() : {},
    faculties: facultiesSnapshot.exists() ? facultiesSnapshot.val() : {},
  });
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
  const [batchImportPlan, setBatchImportPlan] = useState(null);
  const [batchWorkbookPreview, setBatchWorkbookPreview] = useState(null);
  const [selectedBatchPreviewSheet, setSelectedBatchPreviewSheet] = useState('');
  const [showBatchDocumentPreview, setShowBatchDocumentPreview] = useState(false);
  const [batchSuccessModal, setBatchSuccessModal] = useState(null);
  const [batchActionModal, setBatchActionModal] = useState(null);
  const [batchNoticeModal, setBatchNoticeModal] = useState(null);
  const [archiveActionModal, setArchiveActionModal] = useState(null);
  const [batchUploadContext, setBatchUploadContext] = useState(INITIAL_UPLOAD_CONTEXT);
  const [selectedAccountUploadId, setSelectedAccountUploadId] = useState('');
  const [selectedArchivedAccountUploadId, setSelectedArchivedAccountUploadId] = useState('');
  const [showAccountArchiveViewer, setShowAccountArchiveViewer] = useState(false);
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
  const [passwordResetToast, setPasswordResetToast] = useState(null);
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

  const liveStudentRows = useMemo(() => {
    const students = adminLiveData.students || {};
    const usersById = Object.values(adminLiveData.users || {}).reduce((acc, user) => {
      if (user?.user_id) acc[user.user_id] = user;
      return acc;
    }, {});

    return Object.values(students).map((student) => {
      const user = usersById[student.user_id] || {};
      return {
        name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || student.student_number || student.student_id,
        studentNumber: student.student_number || student.student_id || 'Not Available',
        email: user.username || user.email || 'No email',
        status: student.status || user.status || 'active',
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

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return liveStudentRows.filter((student) =>
      [student.name, student.studentNumber, student.email, student.status].some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [liveStudentRows, searchTerm]);

  const dashboardInsights = useMemo(() => {
    const facultiesById = adminLiveData.faculties || {};
    const roomsById = adminLiveData.rooms || {};
    const statusesByFaculty = Object.values(adminLiveData.faculty_status || {}).reduce((acc, status) => {
      if (status?.faculty_id) acc[status.faculty_id] = status;
      return acc;
    }, {});
    const facultyCounts = {};
    const roomCounts = {};

    Object.values(adminLiveData.faculty_login_sessions || {}).forEach((session) => {
      if (session?.faculty_id) facultyCounts[session.faculty_id] = (facultyCounts[session.faculty_id] || 0) + 1;
      if (session?.room_id) roomCounts[session.room_id] = (roomCounts[session.room_id] || 0) + 1;
    });

    const facultyName = (facultyId) => {
      const faculty = facultiesById[facultyId] || {};
      return [faculty.first_name, faculty.middle_name, faculty.last_name].filter(Boolean).join(' ') || facultyId || 'Unknown faculty';
    };

    const roomName = (roomId) => {
      const room = roomsById[roomId] || {};
      return room.room_name || roomId || 'Unknown room';
    };

    const frequentlyTrackedFaculty = Object.entries(facultyCounts)
      .map(([facultyId, count]) => {
        const status = statusesByFaculty[facultyId] || {};
        return {
          id: facultyId,
          name: facultyName(facultyId),
          count,
          room: roomName(status.current_room_id),
          status: status.current_status || 'Offline',
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);

    const frequentlyUsedRooms = Object.entries(roomCounts)
      .map(([roomId, count]) => {
        const room = roomsById[roomId] || {};
        return {
          id: roomId,
          name: roomName(roomId),
          count,
          floor: room.floor || 'No floor',
          status: room.room_status || 'Available',
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);

    const maintenanceRooms = Object.values(roomsById)
      .filter((room) => room?.room_status === 'Under Maintenance')
      .map((room) => ({
        id: room.room_id,
        name: room.room_name || room.room_id,
        count: roomCounts[room.room_id] || 0,
        floor: room.floor || 'No floor',
        status: room.room_status || 'Under Maintenance',
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);

    return {
      frequentlyTrackedFaculty,
      frequentlyUsedRooms,
      maintenanceRooms,
    };
  }, [adminLiveData]);

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

  const accountUploadGroups = useMemo(() => {
    const uploadRecords = adminLiveData.account_uploads || {};
    const uploadIndex = adminLiveData.account_upload_index || {};
    const users = adminLiveData.users || {};
    const groups = {};

    Object.values(uploadRecords).forEach((upload) => {
      const id = upload.account_upload_id || upload.upload_id;
      if (!id) return;
      groups[id] = {
        uploadId: id,
        schoolYear: upload.school_year || '',
        term: upload.term || '',
        uploadedAt: upload.uploaded_at || upload.created_at || '',
        uploadedByName: upload.uploaded_by_name || '',
        status: upload.status || 'active',
        userIds: new Set(Object.keys(uploadIndex[id] || {})),
      };
    });

    Object.values(users).forEach((user) => {
      const uploadId = user.account_upload_id;
      if (!uploadId) return;
      if (!groups[uploadId]) {
        groups[uploadId] = {
          uploadId,
          schoolYear: user.school_year || '',
          term: user.term || '',
          uploadedAt: user.created_date || '',
          uploadedByName: '',
          status: 'active',
          userIds: new Set(),
        };
      }
      groups[uploadId].userIds.add(user.user_id);
    });

    return Object.values(groups)
      .map((group) => ({
        ...group,
        count: group.userIds.size,
      }))
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  }, [adminLiveData]);

  const manageableAccountUploadGroups = useMemo(
    () => accountUploadGroups.filter((group) => !['archived', 'deleted'].includes(group.status)),
    [accountUploadGroups]
  );

  const archivedAccountUploadGroups = useMemo(
    () => accountUploadGroups.filter((group) => group.status === 'archived'),
    [accountUploadGroups]
  );

  const accountUploadStats = useMemo(() => ({
    active: accountUploadGroups.filter((group) => group.status === 'active').length,
    inactive: accountUploadGroups.filter((group) => group.status === 'inactive').length,
    archived: archivedAccountUploadGroups.length,
    totalAccounts: accountUploadGroups.reduce((sum, group) => sum + Number(group.count || 0), 0),
  }), [accountUploadGroups, archivedAccountUploadGroups.length]);

  const accountArchiveViewerRows = useMemo(() => {
    if (!selectedArchivedAccountUploadId) return [];

    const users = adminLiveData.users || {};
    const students = adminLiveData.students || {};
    const faculties = adminLiveData.faculties || {};
    const selectedGroup = archivedAccountUploadGroups.find((group) => group.uploadId === selectedArchivedAccountUploadId);
    if (!selectedGroup) return [];

    return [...selectedGroup.userIds]
      .map((userId) => {
        const userEntry = Object.entries(users).find(([, user]) => user?.user_id === userId);
        const user = userEntry?.[1] || {};
        const role = user.role_id || user.role_ids?.[0] || '';
        const student = Object.values(students).find((item) => item?.user_id === userId) || {};
        const faculty = Object.values(faculties).find((item) => item?.user_id === userId) || {};
        const profile = role === 'student' ? student : faculty;
        return {
          role,
          accountId: role === 'student' ? (student.student_number || student.student_id || '') : (faculty.faculty_id || ''),
          firstName: profile.first_name || '',
          middleName: profile.middle_name || '',
          lastName: profile.last_name || '',
          department: faculty.department || '',
          email: user.username || user.email || faculty.email || '',
          status: user.status || profile.status || 'active',
        };
      })
      .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.lastName).localeCompare(String(b.lastName)));
  }, [adminLiveData, archivedAccountUploadGroups, selectedArchivedAccountUploadId]);

  const selectedArchivedAccountUpload = useMemo(() => {
    if (!selectedArchivedAccountUploadId) return null;
    return archivedAccountUploadGroups.find((group) => group.uploadId === selectedArchivedAccountUploadId) || null;
  }, [archivedAccountUploadGroups, selectedArchivedAccountUploadId]);

  const canActOnSelectedArchive = Boolean(
    selectedArchivedAccountUpload &&
    selectedArchivedAccountUpload.userIds?.size &&
    accountArchiveViewerRows.length
  );

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

    const rows = Object.entries(users)
      .map(([key, user]) => {
        const userId = user.user_id || key;
        const roleIds = normalizeAssignedRoles(Array.isArray(user.role_ids) && user.role_ids.length ? user.role_ids : [user.role_id || 'student']);
        const primaryRole = roleIds.includes('admin') ? 'admin' : user.role_id || roleIds[0];
        const profileSource = primaryRole === 'student' ? students : faculties;
        const profile = Object.values(profileSource).find((item) => item?.user_id === userId) || {};
        return {
          ...user,
          user_key: key,
          user_id: userId,
          role_ids: roleIds,
          role_id: primaryRole,
          display_name: getProfileName(user, students, faculties),
          status: resolveAccountStatus(user, profile),
          permissions: effectiveUserPermissions(loadedRolePermissions, loadedUserPermissions, userId, roleIds),
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

  const createInternalUser = async (form, duplicateIndex = null, uploadMeta = null) => {
    const validationError = validateUserForm(form);
    if (validationError) throw new Error(validationError);

    const index = duplicateIndex || await fetchAccountDuplicateIndex();
    const duplicateError = validateUniqueUserForm(form, index);
    if (duplicateError) throw new Error(duplicateError);

    const user = await createProvisionedAuthUser(form.email.trim(), form.password);
    await update(ref(database), buildUserUpdates(user, form, uploadMeta));
    addAccountToDuplicateIndex(index, form);
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

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellStyles: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = getBatchRowsFromSheet(sheet);
      const workbookPreview = buildWorkbookDocumentPreview(workbook, file.name);
      setBatchRows(rows);
      setBatchWorkbookPreview(workbookPreview);
      setSelectedBatchPreviewSheet(workbookPreview.sheets[0]?.name || '');
      setShowBatchDocumentPreview(false);
      setBatchImportPlan(null);
      setBatchSuccessModal(null);
      setBatchResult(`${rows.length} row${rows.length === 1 ? '' : 's'} ready for review.`);
    } catch (error) {
      setBatchRows([]);
      setBatchWorkbookPreview(null);
      setSelectedBatchPreviewSheet('');
      setShowBatchDocumentPreview(false);
      setBatchImportPlan(null);
      setBatchSuccessModal(null);
      setBatchResult(error.message || 'Unable to read the uploaded file.');
    }
  };

  const handleDownloadBatchTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/sti-locator-batch-account-template.xlsx';
    link.download = 'sti-locator-batch-account-template.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleBatchCreate = async () => {
    if (!batchUploadContext.schoolYear.trim() || !batchUploadContext.term.trim()) {
      setBatchResult('School Year and Term are required before importing batch accounts.');
      return;
    }

    setIsUploadingBatch(true);
    setBatchResult('');
    setBatchSuccessModal(null);

    try {
      const duplicateIndex = await fetchAccountDuplicateIndex();
      const plan = buildBatchImportPlan(batchRows, duplicateIndex);
      setBatchImportPlan(plan);
      setBatchResult(
        `Validation complete. ${plan.acceptedRows.length} row${plan.acceptedRows.length === 1 ? '' : 's'} can be imported.${plan.skippedRows.length ? ` ${plan.skippedRows.length} duplicate/invalid row${plan.skippedRows.length === 1 ? '' : 's'} will be skipped.` : ''}`
      );
    } catch (error) {
      setBatchResult(error.message || 'Unable to validate uploaded accounts.');
    } finally {
      setIsUploadingBatch(false);
    }
  };

  const handleConfirmBatchImport = async () => {
    if (!batchImportPlan?.acceptedRows?.length) return;

    setIsUploadingBatch(true);
    let created = 0;
    const failed = [];

    try {
      const duplicateIndex = await fetchAccountDuplicateIndex();
      const uploadId = sanitizeId(`account_upload_${batchUploadContext.schoolYear}_${batchUploadContext.term}_${Date.now()}`);
      const importedAt = new Date().toISOString();
      const hasActiveAccountUpload = Object.values(adminLiveData.account_uploads || {})
        .some((upload) => (upload?.status || 'active') === 'active');
      const uploadStatus = hasActiveAccountUpload ? 'inactive' : 'active';
      const uploadMeta = {
        uploadId,
        schoolYear: batchUploadContext.schoolYear.trim(),
        term: batchUploadContext.term.trim(),
        importedAt,
        importedBy: currentUser?.uid || '',
        importedByName: currentUser?.name || currentUser?.username || 'Admin',
        status: uploadStatus,
      };

      for (const row of batchImportPlan.acceptedRows) {
        try {
          const user = await createInternalUser(row, duplicateIndex, uploadMeta);
          await update(ref(database), {
            [`account_upload_index/${uploadId}/${user.uid}`]: true,
          });
          created += 1;
        } catch (error) {
          failed.push(`Row ${row.__rowNumber || '?'}: ${error.message}`);
        }
      }

      await update(ref(database), {
        [`account_uploads/${uploadId}`]: {
          account_upload_id: uploadId,
          school_year: uploadMeta.schoolYear,
          term: uploadMeta.term,
          uploaded_at: uploadMeta.importedAt,
          uploaded_by: uploadMeta.importedBy,
          uploaded_by_name: uploadMeta.importedByName,
          created_count: created,
          skipped_count: batchImportPlan.skippedRows.length,
          failed_count: failed.length,
          status: uploadStatus,
        },
      });

      const skippedSummary = formatBatchSkippedSummary(batchImportPlan.skippedRows);
      setBatchResult(
        uploadStatus === 'active'
          ? `Import finished. Created ${created} active account${created === 1 ? '' : 's'} and marked this upload active.`
          : `Import finished. Created ${created} active account${created === 1 ? '' : 's'}. Upload group is inactive until you choose Set Active.`
      );
      setBatchSuccessModal({
        created,
        skippedRows: batchImportPlan.skippedRows,
        skippedSummary,
        failed,
      });
      setBatchImportPlan(null);
      await loadManagedUsers();
    } catch (error) {
      setBatchResult(error.message || 'Unable to import batch accounts.');
    } finally {
      setIsUploadingBatch(false);
    }
  };

  const handleCancelBatchImport = () => {
    setBatchImportPlan(null);
  };

  const handleCloseBatchSuccess = () => {
    setBatchSuccessModal(null);
  };

  const buildAccountGroupStatusUpdates = (group, status, timestamp) => {
    const students = adminLiveData.students || {};
    const faculties = adminLiveData.faculties || {};
    const updates = {};

    [...group.userIds].forEach((userId) => {
      const userRecord = Object.entries(adminLiveData.users || {}).find(([, user]) => user?.user_id === userId);
      const userKey = userRecord?.[0] || userId;
      const studentEntry = Object.entries(students).find(([, student]) => student?.user_id === userId);
      const facultyEntry = Object.entries(faculties).find(([, faculty]) => faculty?.user_id === userId);
      const timestampField = status === 'active' ? 'activated_at'
        : status === 'archived' ? 'archived_at'
          : 'deactivated_at';

      updates[`users/${userKey}/status`] = status;
      updates[`users/${userKey}/${timestampField}`] = timestamp;
      if (studentEntry) {
        updates[`students/${studentEntry[0]}/status`] = status;
        updates[`students/${studentEntry[0]}/${timestampField}`] = timestamp;
      }
      if (facultyEntry) {
        updates[`faculties/${facultyEntry[0]}/status`] = status;
        updates[`faculties/${facultyEntry[0]}/${timestampField}`] = timestamp;
      }

      if (status === 'active') {
        updates[`users/${userKey}/deactivated_at`] = null;
        updates[`users/${userKey}/archived_at`] = null;
        if (studentEntry) {
          updates[`students/${studentEntry[0]}/deactivated_at`] = null;
          updates[`students/${studentEntry[0]}/archived_at`] = null;
        }
        if (facultyEntry) {
          updates[`faculties/${facultyEntry[0]}/deactivated_at`] = null;
          updates[`faculties/${facultyEntry[0]}/archived_at`] = null;
        }
      }
    });

    return updates;
  };

  const handleAccountUploadAction = async (action, confirmed = false) => {
    if (!selectedAccountUploadId) {
      setBatchNoticeModal({
        type: 'info',
        title: 'Select an upload group',
        message: 'Choose a School Year and Term account upload before applying an action.',
      });
      return;
    }

    const selectedGroup = manageableAccountUploadGroups.find((group) => group.uploadId === selectedAccountUploadId);
    if (!selectedGroup) {
      setBatchNoticeModal({
        type: 'error',
        title: 'Upload group not found',
        message: 'The selected account upload group no longer exists. Refresh the page and try again.',
      });
      return;
    }

    const userIds = [...selectedGroup.userIds];
    if (!userIds.length) {
      setBatchNoticeModal({
        type: 'info',
        title: 'No linked users',
        message: 'Selected upload has no linked user records.',
      });
      return;
    }

    const groupLabel = `${selectedGroup.schoolYear || 'Unknown SY'} ${selectedGroup.term || ''}`.trim();

    if (!confirmed) {
      const actionLabels = {
        activate: {
          title: 'Set Active Account Batch',
          message: `Set ${groupLabel} as the active account batch and reactivate its ${userIds.length} linked account${userIds.length === 1 ? '' : 's'}? Other account batches will be marked inactive.`,
          confirmText: 'Set Active',
          tone: 'blue',
        },
        deactivate: {
          title: 'Deactivate Accounts',
          message: `Deactivate ${userIds.length} account record${userIds.length === 1 ? '' : 's'} from ${groupLabel}? These users will no longer be able to log in.`,
          confirmText: 'Deactivate',
          tone: 'amber',
        },
        archive: {
          title: 'Archive Accounts',
          message: `Archive ${userIds.length} account record${userIds.length === 1 ? '' : 's'} from ${groupLabel}? Archived accounts can be restored from View Archives.`,
          confirmText: 'Archive',
          tone: 'slate',
        },
        delete: {
          title: 'Delete Accounts',
          message: `Delete ${userIds.length} account record${userIds.length === 1 ? '' : 's'} from ${groupLabel}? This removes the database records for this upload.`,
          confirmText: 'Delete',
          tone: 'red',
        },
      };

      setBatchActionModal({
        action,
        groupLabel,
        count: userIds.length,
        ...actionLabels[action],
      });
      return;
    }

    setBatchActionModal(null);

    if (action === 'activate') {
      const now = new Date().toISOString();
      const updates = buildAccountGroupStatusUpdates(selectedGroup, 'active', now);
      manageableAccountUploadGroups.forEach((group) => {
        const nextStatus = group.uploadId === selectedAccountUploadId ? 'active' : 'inactive';
        updates[`account_uploads/${group.uploadId}/status`] = nextStatus;
        updates[`account_uploads/${group.uploadId}/updated_at`] = now;
        updates[`account_uploads/${group.uploadId}/${nextStatus === 'active' ? 'activated_at' : 'deactivated_at'}`] = now;
      });

      await update(ref(database), updates);
      setBatchResult(`${selectedGroup.schoolYear || 'Selected'} ${selectedGroup.term || ''} is now the active account batch.`);
      setBatchNoticeModal({
        type: 'success',
        title: 'Account batch is active',
        message: `${groupLabel} is now active and ${userIds.length} linked account${userIds.length === 1 ? '' : 's'} were reactivated.`,
      });
      await loadManagedUsers();
      return;
    }

    const now = new Date().toISOString();
    const students = adminLiveData.students || {};
    const faculties = adminLiveData.faculties || {};
    const updates = {};

    if (action === 'delete') {
      userIds.forEach((userId) => {
        const userRecord = Object.entries(adminLiveData.users || {}).find(([, user]) => user?.user_id === userId);
        const userKey = userRecord?.[0] || userId;
        const studentEntry = Object.entries(students).find(([, student]) => student?.user_id === userId);
        const facultyEntry = Object.entries(faculties).find(([, faculty]) => faculty?.user_id === userId);
        updates[`users/${userKey}`] = null;
        if (studentEntry) updates[`students/${studentEntry[0]}`] = null;
        if (facultyEntry) updates[`faculties/${facultyEntry[0]}`] = null;
        updates[`account_upload_index/${selectedAccountUploadId}/${userId}`] = null;
      });
    } else {
      const status = action === 'archive' ? 'archived' : 'inactive';
      Object.assign(updates, buildAccountGroupStatusUpdates(selectedGroup, status, now));
    }

    updates[`account_uploads/${selectedAccountUploadId}/status`] = action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'inactive';
    updates[`account_uploads/${selectedAccountUploadId}/updated_at`] = now;
    if (action === 'delete') {
      updates[`account_uploads/${selectedAccountUploadId}/deleted_at`] = now;
    }

    await update(ref(database), updates);
    const pastTense = action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'deactivated';
    setBatchResult(`${userIds.length} account record${userIds.length === 1 ? '' : 's'} ${pastTense}.`);
    setBatchNoticeModal({
      type: action === 'delete' ? 'warning' : 'success',
      title: `Accounts ${pastTense}`,
      message: action === 'delete'
        ? `${userIds.length} database account record${userIds.length === 1 ? '' : 's'} from ${groupLabel} were deleted.`
        : `${userIds.length} account record${userIds.length === 1 ? '' : 's'} from ${groupLabel} ${pastTense}.`,
    });
    await loadManagedUsers();
  };

  const handleRestoreArchivedAccountUpload = async (confirmed = false) => {
    if (!selectedArchivedAccountUploadId) {
      setBatchNoticeModal({
        type: 'info',
        title: 'Select an archive',
        message: 'Select an archived account upload first.',
      });
      return;
    }

    const selectedGroup = selectedArchivedAccountUpload;
    if (!selectedGroup) {
      setBatchNoticeModal({
        type: 'error',
        title: 'Archive not found',
        message: 'Selected archived account upload was not found.',
      });
      return;
    }

    if (!selectedGroup.userIds?.size || !accountArchiveViewerRows.length) {
      setBatchNoticeModal({
        type: 'info',
        title: 'No archived rows',
        message: 'This archive has no linked account records to restore.',
      });
      return;
    }

    const groupLabel = `${selectedGroup.schoolYear || 'Unknown SY'} ${selectedGroup.term || ''}`.trim();

    if (!confirmed) {
      setArchiveActionModal({
        action: 'restore',
        title: 'Restore Archived Upload',
        message: `Restore ${selectedGroup.count} archived account record${selectedGroup.count === 1 ? '' : 's'} from ${groupLabel}? Restored accounts will stay inactive until you choose Set Active.`,
        confirmText: 'Restore Upload',
        tone: 'blue',
        groupLabel,
        count: selectedGroup.count,
      });
      return;
    }

    setArchiveActionModal(null);

    const now = new Date().toISOString();
    const updates = {
      ...buildAccountGroupStatusUpdates(selectedGroup, 'inactive', now),
      [`account_uploads/${selectedGroup.uploadId}/status`]: 'inactive',
      [`account_uploads/${selectedGroup.uploadId}/restored_at`]: now,
      [`account_uploads/${selectedGroup.uploadId}/updated_at`]: now,
    };

    await update(ref(database), updates);
    setSelectedArchivedAccountUploadId('');
    setBatchResult(`${selectedGroup.count} account record${selectedGroup.count === 1 ? '' : 's'} restored as inactive.`);
    setBatchNoticeModal({
      type: 'success',
      title: 'Archive restored',
      message: `${selectedGroup.count} account record${selectedGroup.count === 1 ? '' : 's'} from ${groupLabel} were restored as inactive.`,
    });
    await loadManagedUsers();
  };

  const handleOpenAccountArchiveViewer = () => {
    if (!archivedAccountUploadGroups.length) {
      setBatchResult('No archived account uploads found.');
      return;
    }

    const initialUploadId = selectedArchivedAccountUploadId || archivedAccountUploadGroups[0].uploadId;
    setSelectedArchivedAccountUploadId(initialUploadId);
    setShowAccountArchiveViewer(true);
  };

  const handleDeleteArchivedAccountUpload = async (confirmed = false) => {
    if (!selectedArchivedAccountUploadId) {
      setBatchNoticeModal({
        type: 'info',
        title: 'Select an archive',
        message: 'Select an archived account upload first.',
      });
      return;
    }

    const selectedGroup = selectedArchivedAccountUpload;
    if (!selectedGroup) {
      setBatchNoticeModal({
        type: 'error',
        title: 'Archive not found',
        message: 'Selected archived account upload was not found.',
      });
      return;
    }

    if (!selectedGroup.userIds?.size || !accountArchiveViewerRows.length) {
      setBatchNoticeModal({
        type: 'info',
        title: 'No archived rows',
        message: 'This archive has no linked account records to delete.',
      });
      return;
    }

    const groupLabel = `${selectedGroup.schoolYear || 'Unknown SY'} ${selectedGroup.term || ''}`.trim();

    if (!confirmed) {
      setArchiveActionModal({
        action: 'delete',
        title: 'Delete Archived Upload',
        message: `Permanently delete ${selectedGroup.count} archived database account record${selectedGroup.count === 1 ? '' : 's'} from ${groupLabel}?`,
        confirmText: 'Delete Archive',
        tone: 'red',
        groupLabel,
        count: selectedGroup.count,
      });
      return;
    }

    setArchiveActionModal(null);

    const students = adminLiveData.students || {};
    const faculties = adminLiveData.faculties || {};
    const updates = {};
    const userIds = [...selectedGroup.userIds];

    userIds.forEach((userId) => {
      const userRecord = Object.entries(adminLiveData.users || {}).find(([, user]) => user?.user_id === userId);
      const userKey = userRecord?.[0] || userId;
      const studentEntry = Object.entries(students).find(([, student]) => student?.user_id === userId);
      const facultyEntry = Object.entries(faculties).find(([, faculty]) => faculty?.user_id === userId);
      updates[`users/${userKey}`] = null;
      if (studentEntry) updates[`students/${studentEntry[0]}`] = null;
      if (facultyEntry) updates[`faculties/${facultyEntry[0]}`] = null;
      updates[`account_upload_index/${selectedGroup.uploadId}/${userId}`] = null;
    });

    updates[`account_uploads/${selectedGroup.uploadId}/status`] = 'deleted';
    updates[`account_uploads/${selectedGroup.uploadId}/deleted_at`] = new Date().toISOString();
    updates[`account_uploads/${selectedGroup.uploadId}/updated_at`] = new Date().toISOString();

    await update(ref(database), updates);
    setBatchResult(`${selectedGroup.count} archived account record${selectedGroup.count === 1 ? '' : 's'} deleted.`);
    setBatchNoticeModal({
      type: 'success',
      title: 'Archive deleted',
      message: `${selectedGroup.count} archived database account record${selectedGroup.count === 1 ? '' : 's'} were deleted.`,
    });

    const remainingArchives = archivedAccountUploadGroups.filter((group) => group.uploadId !== selectedGroup.uploadId);
    if (remainingArchives.length) {
      setSelectedArchivedAccountUploadId(remainingArchives[0].uploadId);
    } else {
      setSelectedArchivedAccountUploadId('');
      setShowAccountArchiveViewer(false);
    }
    await loadManagedUsers();
  };

  const handleUserRoleToggle = (userId, roleId) => {
    const target = managedUsers.find((user) => user.user_id === userId);
    if (!target) return;

    const currentRoleIds = normalizeAssignedRoles(Array.isArray(target.role_ids) ? target.role_ids : [target.role_id]);
    const toggledRoleIds = currentRoleIds.includes(roleId)
      ? currentRoleIds.filter((id) => id !== roleId)
      : [...currentRoleIds, roleId];
    const nextRoleIds = normalizeAssignedRoles(toggledRoleIds);

    if (!nextRoleIds.length) {
      setUserAdminMessage('A user must have at least one role.');
      return;
    }

    const primaryRoleId = nextRoleIds.includes('admin')
      ? 'admin'
      : nextRoleIds.includes(target.role_id)
      ? target.role_id
      : nextRoleIds[0];
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

  const handleResetUserPermission = (userId, permissionId) => {
    const id = userPermissionId(userId, permissionId);
    const nextUserPermissions = { ...userPermissions };
    delete nextUserPermissions[id];
    setUserPermissions(nextUserPermissions);

    setManagedUsers((current) => current.map((user) => {
      if (user.user_id !== userId) return user;
      return {
        ...user,
        permissions: effectiveUserPermissions(rolePermissions, nextUserPermissions, userId, user.role_ids || [user.role_id]),
      };
    }));
    setHasPermissionDraftChanges(true);
    setUserAdminMessage('Permission reset to role default. Click Save changes to apply.');
  };

  const handleResetAllUserPermissions = (userId) => {
    const nextUserPermissions = Object.entries(userPermissions).reduce((acc, [id, record]) => {
      if (record.user_id !== userId) acc[id] = record;
      return acc;
    }, {});
    setUserPermissions(nextUserPermissions);

    setManagedUsers((current) => current.map((user) => {
      if (user.user_id !== userId) return user;
      return {
        ...user,
        permissions: effectiveUserPermissions(rolePermissions, nextUserPermissions, userId, user.role_ids || [user.role_id]),
      };
    }));
    setHasPermissionDraftChanges(true);
    setUserAdminMessage('All custom permissions reset to role defaults. Click Save changes to apply.');
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
        updates[`${userRecordPath(user)}/role_id`] = user.role_id;
        updates[`${userRecordPath(user)}/role_ids`] = currentRoleIds;
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
    const target = managedUsers.find((user) => user.user_id === userId);
    if (!target) return;

    const now = new Date().toISOString();
    const liveUserEntry = Object.entries(adminLiveData.users || {}).find(([key, user]) =>
      key === userId || user?.user_id === userId
    );
    const userKey = liveUserEntry?.[0] || target.user_key || userId;
    const timestampField = status === 'active' ? 'activated_at' : 'deactivated_at';
    const updates = {
      [`users/${userKey}/status`]: status,
      [`users/${userKey}/${timestampField}`]: now,
    };
    const studentEntry = Object.entries(adminLiveData.students || {}).find(([, student]) => student?.user_id === userId);
    const facultyEntry = Object.entries(adminLiveData.faculties || {}).find(([, faculty]) => faculty?.user_id === userId);

    if (studentEntry) {
      updates[`students/${studentEntry[0]}/status`] = status;
      updates[`students/${studentEntry[0]}/${timestampField}`] = now;
    }
    if (facultyEntry) {
      updates[`faculties/${facultyEntry[0]}/status`] = status;
      updates[`faculties/${facultyEntry[0]}/${timestampField}`] = now;
    }

    if (status === 'active') {
      updates[`users/${userKey}/deactivated_at`] = null;
      updates[`users/${userKey}/archived_at`] = null;
      if (studentEntry) {
        updates[`students/${studentEntry[0]}/deactivated_at`] = null;
        updates[`students/${studentEntry[0]}/archived_at`] = null;
      }
      if (facultyEntry) {
        updates[`faculties/${facultyEntry[0]}/deactivated_at`] = null;
        updates[`faculties/${facultyEntry[0]}/archived_at`] = null;
      }
    }

    await update(ref(database), updates);
    setManagedUsers((current) => current.map((user) =>
      user.user_id === userId ? { ...user, status } : user
    ));
    setUserAdminMessage(status === 'inactive' ? 'Account deactivated.' : 'Account reactivated.');
    await loadManagedUsers();
  };

  const handleResetSelectedUserPassword = async () => {
    if (!selectedUser) return;

    const temporaryPassword = generateTemporaryPassword();
    await update(ref(database), {
      [`${userRecordPath(selectedUser)}/password`]: temporaryPassword,
      [`${userRecordPath(selectedUser)}/password_reset_at`]: new Date().toISOString(),
      [`${userRecordPath(selectedUser)}/password_reset_by`]: currentUser?.uid || 'admin',
    });

    const credentials = {
      email: selectedUser.username,
      password: temporaryPassword,
    };
    setPasswordResetToast(credentials);
    setUserAdminMessage(`Temporary password generated for ${selectedUser.display_name}.`);
  };

  const handleCopyResetCredentials = async () => {
    if (!passwordResetToast) return;
    const text = `Email: ${passwordResetToast.email}\nPassword: ${passwordResetToast.password}`;
    await navigator.clipboard.writeText(text);
    setUserAdminMessage('Reset credentials copied.');
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
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                  <p className="mt-3 text-4xl font-bold text-slate-950">{metric.value}</p>
                </div>
                <div className={`rounded-lg p-3 ${metric.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-sm text-slate-600">{metric.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <SectionPanel
          title="Faculty Activity"
          description="Live faculty location and class status from desktop logins."
          action={
            <button type="button" onClick={() => setActiveTab('reports')} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FaChartLine className="h-4 w-4 text-blue-600" />
              View reports
            </button>
          }
        >
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
                {filteredFaculty.slice(0, 6).map((faculty) => (
                  <tr key={faculty.name} className="hover:bg-slate-50">
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
          {filteredFaculty.length > 6 && (
            <button type="button" onClick={() => setActiveTab('reports')} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
              View {filteredFaculty.length - 6} more faculty records
            </button>
          )}
        </SectionPanel>

        <div className="space-y-6">
          <SectionPanel title="Admin Workflows" description="Common setup actions.">
            <div className="grid gap-3">
              {[
                ['Create account', 'accounts', FaUserPlus, 'Internal signup'],
                ['Manage roles', 'users', FaUserShield, 'Permissions'],
                ['Upload users', 'batch', FaUpload, 'Batch accounts'],
                ['Manage rooms', 'rooms', FaLayerGroup, 'Room status'],
              ].map(([label, tab, Icon, detail]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span>
                    <span className="block font-semibold text-slate-950">{label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{detail}</span>
                  </span>
                  <Icon className="h-4 w-4 text-blue-600" />
                </button>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel title="Room Snapshot">
            <div className="space-y-3">
              {roomRows.slice(0, 4).map((room) => (
                <div key={room.room_id || room.room_name} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{room.room_name || room.room_id}</p>
                    <p className="text-xs text-slate-500">{[room.building, room.floor].filter(Boolean).join(' - ') || 'No location details'}</p>
                  </div>
                  <StatusBadge status={room.room_status || 'Available'} />
                </div>
              ))}
              {!roomRows.length && <p className="text-sm text-slate-500">No rooms saved yet.</p>}
              {roomRows.length > 4 && (
                <button type="button" onClick={() => setActiveTab('rooms')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Manage all {roomRows.length} rooms
                </button>
              )}
            </div>
          </SectionPanel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {liveReportRows.map((report) => (
          <button
            key={report.name}
            type="button"
            onClick={() => setActiveTab('reports')}
            className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{report.name}</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">{report.detail}</p>
                <p className="mt-1 text-xs text-slate-500">{report.updated}</p>
              </div>
              <StatusBadge status={report.status} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionPanel title="Frequently Tracked Faculty" description="Ranked by desktop login scans.">
          <div className="space-y-3">
            {dashboardInsights.frequentlyTrackedFaculty.map((faculty, index) => (
              <div key={faculty.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{faculty.name}</p>
                    <p className="truncate text-xs text-slate-500">{faculty.room}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-950">{faculty.count}</p>
                  <p className="text-xs text-slate-500">scan{faculty.count === 1 ? '' : 's'}</p>
                </div>
              </div>
            ))}
            {!dashboardInsights.frequentlyTrackedFaculty.length && (
              <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">No faculty login scans recorded yet.</p>
            )}
          </div>
        </SectionPanel>

        <SectionPanel title="Frequently Used Rooms" description="Based on login session room assignments.">
          <div className="space-y-3">
            {dashboardInsights.frequentlyUsedRooms.map((room, index) => (
              <div key={room.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">#{index + 1}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-950">{room.name}</p>
                    <p className="truncate text-xs text-slate-500">{room.floor}</p>
                  </div>
                  <StatusBadge status={room.status} />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, room.count * 12)}%` }} />
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">{room.count} recorded use{room.count === 1 ? '' : 's'}</p>
              </div>
            ))}
            {!dashboardInsights.frequentlyUsedRooms.length && (
              <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">Room usage will appear after faculty login sessions.</p>
            )}
          </div>
        </SectionPanel>

        <SectionPanel title="Maintenance Watch" description="Rooms under maintenance, ranked by prior usage.">
          <div className="space-y-3">
            {dashboardInsights.maintenanceRooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between gap-4 rounded-md border border-amber-100 bg-amber-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{room.name}</p>
                  <p className="truncate text-xs text-amber-700">{room.floor} - {room.count} prior use{room.count === 1 ? '' : 's'}</p>
                </div>
                <StatusBadge status={room.status} />
              </div>
            ))}
            {!dashboardInsights.maintenanceRooms.length && (
              <p className="rounded-md bg-emerald-50 px-3 py-4 text-sm font-medium text-emerald-700">No rooms are currently under maintenance.</p>
            )}
            <button type="button" onClick={() => setActiveTab('rooms')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Update room statuses
            </button>
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

      <SectionPanel title={userForm.role === 'student' ? 'Student Directory' : 'Faculty Directory'}>
        <div className="mb-4 max-w-md">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={userForm.role === 'student' ? 'Search students' : 'Search faculty'} className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              {userForm.role === 'student' ? (
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">Student Number</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3">Status</th>
                </tr>
              ) : (
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-3 pr-4">Faculty</th>
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Current Room</th>
                  <th className="pb-3">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userForm.role === 'student' ? (
                <>
                  {filteredStudents.map((student) => (
                    <tr key={`${student.studentNumber}-${student.email}`}>
                      <td className="py-3 pr-4 font-medium text-slate-950">{student.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{student.studentNumber}</td>
                      <td className="py-3 pr-4 text-slate-600">{student.email}</td>
                      <td className="py-3"><StatusBadge status={student.status} /></td>
                    </tr>
                  ))}
                  {!filteredStudents.length && (
                    <tr>
                      <td className="py-6 text-sm text-slate-500" colSpan="4">No student records found.</td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  {filteredFaculty.map((faculty) => (
                    <tr key={faculty.name}>
                      <td className="py-3 pr-4 font-medium text-slate-950">{faculty.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{faculty.department}</td>
                      <td className="py-3 pr-4 text-slate-600">{faculty.room}</td>
                      <td className="py-3"><StatusBadge status={faculty.status} /></td>
                    </tr>
                  ))}
                  {!filteredFaculty.length && (
                    <tr>
                      <td className="py-6 text-sm text-slate-500" colSpan="4">No faculty records found.</td>
                    </tr>
                  )}
                </>
              )}
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
                    <button type="button" onClick={handleResetSelectedUserPassword} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                      <FaKey className="h-3.5 w-3.5" />
                      Reset Password
                    </button>
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">User Permissions</h4>
                      <p className="mt-1 text-xs text-slate-500">These settings override the selected user's role defaults.</p>
                    </div>
                    {Object.values(userPermissions).some((permission) => permission.user_id === selectedUser.user_id) && (
                      <button
                        type="button"
                        onClick={() => handleResetAllUserPermissions(selectedUser.user_id)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Reset all to defaults
                      </button>
                    )}
                  </div>
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
                            {hasOverride && (
                              <button
                                type="button"
                                onClick={() => handleResetUserPermission(selectedUser.user_id, permission.permission_id)}
                                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                              >
                                Reset to default
                              </button>
                            )}
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
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Active batches', accountUploadStats.active, 'bg-emerald-50 text-emerald-700'],
            ['Inactive batches', accountUploadStats.inactive, 'bg-amber-50 text-amber-700'],
            ['Archived batches', accountUploadStats.archived, 'bg-slate-100 text-slate-700'],
            ['Grouped accounts', accountUploadStats.totalAccounts, 'bg-blue-50 text-blue-700'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xl font-bold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-600 p-3 text-white">
                <FaFileUpload className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Upload account list</h3>
                <p className="mt-1 text-sm text-slate-500">Use the template to prevent missing columns and duplicate account data.</p>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-blue-100 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
              Required columns: <span className="font-semibold text-slate-700">{batchColumns.join(', ')}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="School Year">
                <input
                  className={fieldClass()}
                  value={batchUploadContext.schoolYear}
                  onChange={(event) => setBatchUploadContext({ ...batchUploadContext, schoolYear: event.target.value })}
                  placeholder="2026-2027"
                />
              </Field>
              <Field label="Term">
                <input
                  className={fieldClass()}
                  value={batchUploadContext.term}
                  onChange={(event) => setBatchUploadContext({ ...batchUploadContext, term: event.target.value })}
                  placeholder="1st Semester"
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={handleDownloadBatchTemplate}
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              <FaDownload className="h-3.5 w-3.5" />
              Download Template
            </button>
            <input className="mt-5 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700" type="file" accept=".xlsx,.xls,.csv" onChange={handleBatchFile} />
            {batchResult && <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{batchResult}</p>}
            <button type="button" disabled={!batchRows.length || isUploadingBatch} onClick={handleBatchCreate} className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <FaUpload className="h-3.5 w-3.5" />
              {isUploadingBatch ? 'Creating Accounts...' : 'Create Batch Accounts'}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">File Preview</h3>
                <p className="mt-1 text-xs text-slate-500">{batchRows.length ? `${batchRows.length} row${batchRows.length === 1 ? '' : 's'} loaded for validation` : 'Upload a file to review rows before import.'}</p>
              </div>
              <div className="flex items-center gap-2">
                {batchRows.length > 0 && (
                  <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{batchRows.length} rows</span>
                )}
                <button
                  type="button"
                  disabled={!batchWorkbookPreview}
                  onClick={() => setShowBatchDocumentPreview(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaEye className="h-3.5 w-3.5 text-blue-600" />
                  Open File View
                </button>
              </div>
            </div>
            <div className="overflow-x-auto p-4">
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
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Uploaded account groups</h3>
              <p className="mt-1 text-sm text-slate-500">Deactivate, archive, or delete accounts by School Year and Term.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_auto_auto_auto_auto]">
              <select
                className={fieldClass()}
                value={selectedAccountUploadId}
                onChange={(event) => setSelectedAccountUploadId(event.target.value)}
              >
                <option value="">Select upload group</option>
                {manageableAccountUploadGroups.map((group) => (
                  <option key={group.uploadId} value={group.uploadId}>
                    {group.schoolYear || 'Unknown SY'} - {group.term || 'Unknown Term'} - {group.count} account{group.count === 1 ? '' : 's'} - {group.status}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!selectedAccountUploadId} onClick={() => handleAccountUploadAction('activate')} className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                Set Active
              </button>
              <button type="button" disabled={!selectedAccountUploadId} onClick={() => handleAccountUploadAction('deactivate')} className="rounded-md border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                Deactivate
              </button>
              <button type="button" disabled={!selectedAccountUploadId} onClick={() => handleAccountUploadAction('archive')} className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Archive
              </button>
              <button type="button" disabled={!selectedAccountUploadId} onClick={() => handleAccountUploadAction('delete')} className="rounded-md border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-950">Archived account uploads</h4>
                <p className="mt-1 text-sm text-slate-500">Open archived account groups in a workbook-style preview before restoring or deleting.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={!archivedAccountUploadGroups.length} onClick={handleOpenAccountArchiveViewer} className="rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  View Archives
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-3 pr-4">School Year</th>
                  <th className="pb-3 pr-4">Term</th>
                  <th className="pb-3 pr-4">Accounts</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountUploadGroups.slice(0, 8).map((group) => (
                  <tr key={group.uploadId}>
                    <td className="py-3 pr-4 font-medium text-slate-950">{group.schoolYear || 'Unknown'}</td>
                    <td className="py-3 pr-4 text-slate-600">{group.term || 'Unknown'}</td>
                    <td className="py-3 pr-4 text-slate-600">{group.count}</td>
                    <td className="py-3 pr-4"><StatusBadge status={group.status || 'active'} /></td>
                    <td className="py-3 text-slate-600">{group.uploadedAt ? new Date(group.uploadedAt).toLocaleString() : 'Unknown'}</td>
                  </tr>
                ))}
                {!accountUploadGroups.length && (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan="5">No grouped account uploads yet.</td>
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
      {passwordResetToast && (
        <div className="fixed right-5 top-20 z-[70] w-80 rounded-lg border border-blue-100 bg-white p-4 shadow-2xl shadow-slate-400/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Password reset ready</p>
              <p className="mt-1 text-xs text-slate-500">Copy and send these temporary credentials.</p>
            </div>
            <button type="button" onClick={() => setPasswordResetToast(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close password reset notice">
              <FaTimes className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
            <p className="truncate"><span className="font-semibold">Email:</span> {passwordResetToast.email}</p>
            <p className="mt-1 break-all"><span className="font-semibold">Password:</span> {passwordResetToast.password}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyResetCredentials}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FaCopy className="h-3.5 w-3.5" />
            Copy email and password
          </button>
        </div>
      )}
      {batchImportPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-base font-semibold text-slate-950">Review batch import</p>
                <p className="mt-1 text-sm text-slate-500">
                  Valid rows will be created. Duplicate or invalid rows will be discarded.
                </p>
              </div>
              <button type="button" onClick={handleCancelBatchImport} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close batch import review">
                <FaTimes className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-emerald-700">Ready to import</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-800">{batchImportPlan.acceptedRows.length}</p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-amber-700">Will be skipped</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-800">{batchImportPlan.skippedRows.length}</p>
                </div>
              </div>

              {batchImportPlan.skippedRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Skipped rows</p>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    {batchImportPlan.skippedRows.map((item) => (
                      <div key={`${item.rowNumber}-${item.row.email}-${item.row.facultyId}-${item.row.studentNumber}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <p className="text-sm font-semibold text-slate-950">Row {item.rowNumber}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[item.row.role, item.row.studentNumber || item.row.facultyId, item.row.email].filter(Boolean).join(' | ')}
                        </p>
                        <p className="mt-2 text-sm text-amber-700">{item.issues.join(' | ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!batchImportPlan.acceptedRows.length && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  No valid rows are available to import. Fix the file and upload again.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleCancelBatchImport} className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={!batchImportPlan.acceptedRows.length || isUploadingBatch}
                onClick={handleConfirmBatchImport}
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isUploadingBatch ? 'Importing...' : 'Proceed with Import'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showBatchDocumentPreview && batchWorkbookPreview && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/55 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-white px-5 py-3 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Workbook Preview</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">{batchWorkbookPreview.fileName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedBatchPreviewSheet}
                onChange={(event) => setSelectedBatchPreviewSheet(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {batchWorkbookPreview.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowBatchDocumentPreview(false)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#ededed] p-8">
            <div className="mx-auto w-fit min-w-[52rem] border border-slate-400 bg-white p-10 shadow-2xl shadow-slate-900/20">
              <div className="min-h-[70rem] w-fit min-w-[46rem] overflow-visible">
                <table className="border-collapse font-[Calibri,Arial,sans-serif] text-[12px] text-slate-950">
                  <colgroup>
                    {(batchWorkbookPreview.sheets.find((sheet) => sheet.name === selectedBatchPreviewSheet)?.columnWidths || []).map((width, index) => (
                      <col key={`${selectedBatchPreviewSheet}-col-${index}`} style={{ width: `${width}px` }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {(batchWorkbookPreview.sheets.find((sheet) => sheet.name === selectedBatchPreviewSheet)?.rows || []).map((row) => (
                      <tr key={`${selectedBatchPreviewSheet}-row-${row.index}`} style={{ height: `${row.height}px` }}>
                        {row.cells.map((cell) => (
                          <td
                            key={cell.key}
                            rowSpan={cell.rowSpan}
                            colSpan={cell.colSpan}
                            className="min-w-10 border border-slate-900 px-1.5 py-0.5 align-middle leading-tight"
                            style={{
                              minHeight: `${row.height}px`,
                              ...cell.style,
                            }}
                            title={String(cell.value || '')}
                          >
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {batchSuccessModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <FaCheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-950">Batch import complete</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Created {batchSuccessModal.created} account{batchSuccessModal.created === 1 ? '' : 's'}.
                    {batchSuccessModal.skippedRows.length ? ` Skipped ${batchSuccessModal.skippedRows.length} duplicate/invalid row${batchSuccessModal.skippedRows.length === 1 ? '' : 's'}.` : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleCloseBatchSuccess} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close batch import success">
                <FaTimes className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {batchSuccessModal.skippedRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Skipped rows</p>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    {batchSuccessModal.skippedRows.map((item) => (
                      <div key={`${item.rowNumber}-${item.row.email}-${item.row.facultyId}-${item.row.studentNumber}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <p className="text-sm font-semibold text-slate-950">Row {item.rowNumber}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[item.row.role, item.row.studentNumber || item.row.facultyId, item.row.email].filter(Boolean).join(' | ')}
                        </p>
                        <p className="mt-2 text-sm text-amber-700">{item.issues.join(' | ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {batchSuccessModal.failed.length > 0 && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  Failed {batchSuccessModal.failed.length}: {batchSuccessModal.failed.slice(0, 3).join(' | ')}
                  {batchSuccessModal.failed.length > 3 ? ` | +${batchSuccessModal.failed.length - 3} more` : ''}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={handleCloseBatchSuccess} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {batchActionModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                batchActionModal.tone === 'red' ? 'bg-red-50 text-red-600'
                  : batchActionModal.tone === 'amber' ? 'bg-amber-50 text-amber-600'
                    : batchActionModal.tone === 'slate' ? 'bg-slate-100 text-slate-600'
                      : 'bg-blue-50 text-blue-600'
              }`}>
                {batchActionModal.tone === 'red' ? <FaTrash className="h-5 w-5" /> : <FaCheckCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-950">{batchActionModal.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{batchActionModal.message}</p>
                <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{batchActionModal.groupLabel}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  {batchActionModal.count} linked account{batchActionModal.count === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setBatchActionModal(null)} className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAccountUploadAction(batchActionModal.action, true)}
                className={`rounded-md px-4 py-2.5 text-sm font-semibold text-white ${
                  batchActionModal.tone === 'red' ? 'bg-red-600 hover:bg-red-700'
                    : batchActionModal.tone === 'amber' ? 'bg-amber-600 hover:bg-amber-700'
                      : batchActionModal.tone === 'slate' ? 'bg-slate-700 hover:bg-slate-800'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {batchActionModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {archiveActionModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                archiveActionModal.tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {archiveActionModal.tone === 'red' ? <FaTrash className="h-5 w-5" /> : <FaCheckCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-950">{archiveActionModal.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{archiveActionModal.message}</p>
                <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{archiveActionModal.groupLabel}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  {archiveActionModal.count} archived account{archiveActionModal.count === 1 ? '' : 's'}
                </div>
                {archiveActionModal.action === 'delete' && (
                  <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700">
                    This deletes the archived database records for this upload. This action cannot be restored afterward.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setArchiveActionModal(null)} className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (archiveActionModal.action === 'restore') {
                    handleRestoreArchivedAccountUpload(true);
                  } else {
                    handleDeleteArchivedAccountUpload(true);
                  }
                }}
                className={`rounded-md px-4 py-2.5 text-sm font-semibold text-white ${
                  archiveActionModal.tone === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {archiveActionModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {batchNoticeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="px-6 py-5 text-center">
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                batchNoticeModal.type === 'error' ? 'bg-red-50 text-red-600'
                  : batchNoticeModal.type === 'warning' ? 'bg-amber-50 text-amber-600'
                    : batchNoticeModal.type === 'success' ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-blue-50 text-blue-600'
              }`}>
                {batchNoticeModal.type === 'error' || batchNoticeModal.type === 'warning'
                  ? <FaTimes className="h-6 w-6" />
                  : <FaCheckCircle className="h-6 w-6" />}
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-950">{batchNoticeModal.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{batchNoticeModal.message}</p>
            </div>
            <div className="flex justify-center border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setBatchNoticeModal(null)} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {showAccountArchiveViewer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex h-[86vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Archive Workbook</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Archived Account Upload Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleRestoreArchivedAccountUpload()} disabled={!canActOnSelectedArchive} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Restore Upload
                </button>
                <button type="button" onClick={() => handleDeleteArchivedAccountUpload()} disabled={!canActOnSelectedArchive} className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Delete Archive
                </button>
                <button type="button" onClick={() => setShowAccountArchiveViewer(false)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(260px,1fr)_auto] md:items-center">
              <select
                value={selectedArchivedAccountUploadId}
                onChange={(event) => setSelectedArchivedAccountUploadId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {archivedAccountUploadGroups.map((group) => (
                  <option key={group.uploadId} value={group.uploadId}>
                    {group.schoolYear || 'Unknown SY'} - {group.term || 'Unknown Term'} - {group.count} account{group.count === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                {accountArchiveViewerRows.length} row{accountArchiveViewerRows.length === 1 ? '' : 's'} loaded
              </div>
              {selectedArchivedAccountUploadId && !canActOnSelectedArchive && (
                <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  This archive selection has no linked rows. Restore and delete are disabled until a valid archive is selected.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <div className="min-w-[1120px] border border-slate-300 bg-white font-sans text-sm shadow-sm">
                <div className="grid grid-cols-[44px_110px_150px_150px_150px_180px_290px_120px] bg-slate-200 text-center text-xs font-bold text-slate-700">
                  {['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => (
                    <div key={letter || 'corner'} className="border-r border-b border-slate-300 px-2 py-2">{letter}</div>
                  ))}
                </div>
                <div className="grid grid-cols-[44px_110px_150px_150px_150px_180px_290px_120px] bg-yellow-50 text-center font-bold text-slate-950">
                  <div className="border-r border-b border-slate-300 bg-slate-100 px-2 py-2 text-xs text-slate-600">1</div>
                  <div className="col-span-7 border-b border-slate-300 px-2 py-3">STI Locator Archived Account Upload</div>
                </div>
                <div className="grid grid-cols-[44px_110px_150px_150px_150px_180px_290px_120px] bg-blue-100 text-xs font-bold uppercase text-slate-900">
                  {['2', 'Role', 'ID', 'First Name', 'Middle Name', 'Last Name', 'Email', 'Status'].map((header, index) => (
                    <div key={header} className={`${index === 0 ? 'bg-slate-100 text-center text-slate-600' : ''} border-r border-b border-slate-300 px-2 py-2`}>
                      {header}
                    </div>
                  ))}
                </div>
                {accountArchiveViewerRows.length ? (
                  accountArchiveViewerRows.map((row, index) => (
                    <div key={`${row.email}-${row.accountId}-${index}`} className="grid grid-cols-[44px_110px_150px_150px_150px_180px_290px_120px] bg-white text-slate-800 odd:bg-green-50/50">
                      {[index + 3, row.role, row.accountId, row.firstName, row.middleName, row.lastName, row.email, row.status].map((cell, cellIndex) => (
                        <div key={`${cellIndex}-${cell}`} className={`${cellIndex === 0 ? 'bg-slate-100 text-center text-xs font-semibold text-slate-600' : ''} min-h-9 truncate border-r border-b border-slate-300 px-2 py-2`} title={String(cell || '')}>
                          {cell || ''}
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No archived account rows found for this upload.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
                    <button type="button" onClick={() => openUserProfile(navigate)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">My profile</button>
                    <button type="button" onClick={() => changeCurrentUserPassword(database, currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">Change password</button>
                    <div className="my-2 border-t border-slate-200" />
                    <button type="button" onClick={() => openThemeSettings(navigate)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">Theme settings</button>
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
