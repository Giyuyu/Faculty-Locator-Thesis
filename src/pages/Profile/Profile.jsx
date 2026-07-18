import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaSave, FaUserCircle } from 'react-icons/fa';
import { MdApps, MdArrowBack, MdDarkMode, MdLightMode } from 'react-icons/md';
import { get, ref, update } from 'firebase/database';
import Swal from 'sweetalert2';
import { database } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import logo from '../../assets/sti_logo.png';
import {
  changeCurrentUserPassword,
  setThemeSetting,
  signOutCurrentUser,
} from '../../utils/profileActions';

const emptyProfile = {
  first_name: '',
  middle_name: '',
  last_name: '',
  department: '',
  email: '',
  student_number: '',
};

function profileName(profile, fallback) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || fallback || 'User';
}

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedSection = new URLSearchParams(location.search).get('section') === 'theme' ? 'theme' : 'profile';
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [form, setForm] = useState({
    username: '',
    profileType: '',
    profileKey: '',
    ...emptyProfile,
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    setCurrentUser(JSON.parse(storedUser));
  }, [navigate]);

  useEffect(() => {
    const syncTheme = (event) => {
      setTheme(event.detail || localStorage.getItem('theme') || 'light');
    };

    window.addEventListener('themechange', syncTheme);
    return () => window.removeEventListener('themechange', syncTheme);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const loadProfile = async () => {
      setLoading(true);
      const userId = currentUser.uid || currentUser.user_id;
      const [userSnapshot, facultiesSnapshot, studentsSnapshot] = await Promise.all([
        userId ? get(ref(database, `users/${userId}`)) : Promise.resolve(null),
        get(ref(database, 'faculties')),
        get(ref(database, 'students')),
      ]);

      const userRecord = userSnapshot?.exists?.() ? userSnapshot.val() : {};
      const faculties = facultiesSnapshot.exists() ? facultiesSnapshot.val() : {};
      const students = studentsSnapshot.exists() ? studentsSnapshot.val() : {};
      const linkedFaculty = Object.entries(faculties).find(([, item]) => item?.user_id === userId);
      const linkedStudent = Object.entries(students).find(([, item]) => item?.user_id === userId);
      const linked = linkedFaculty || linkedStudent;
      const [profileKey, profileData] = linked || ['', {}];

      setForm({
        username: userRecord.username || currentUser.username || '',
        profileType: linkedFaculty ? 'faculties' : linkedStudent ? 'students' : '',
        profileKey,
        ...emptyProfile,
        ...profileData,
      });
      setLoading(false);
    };

    loadProfile().catch(() => {
      setLoading(false);
      Swal.fire('Unable to load profile', 'Please refresh the page and try again.', 'error');
    });
  }, [currentUser]);

  const roles = useMemo(() => (
    (currentUser?.roleIds || [currentUser?.userType]).filter(Boolean).join(', ') || 'Not available'
  ), [currentUser]);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!currentUser) return;

    const userId = currentUser.uid || currentUser.user_id;
    if (!userId) {
      Swal.fire('Unable to save', 'User ID is missing. Please sign in again.', 'error');
      return;
    }

    setSaving(true);
    const updates = {
      [`users/${userId}/username`]: form.username,
      [`users/${userId}/updated_at`]: new Date().toISOString(),
    };

    if (form.profileType && form.profileKey) {
      const profileUpdate = {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        email: form.email,
        updated_at: new Date().toISOString(),
      };

      if (form.profileType === 'faculties') {
        profileUpdate.department = form.department;
      }

      if (form.profileType === 'students') {
        profileUpdate.student_number = form.student_number;
      }

      Object.entries(profileUpdate).forEach(([key, value]) => {
        updates[`${form.profileType}/${form.profileKey}/${key}`] = value;
      });
    }

    try {
      await update(ref(database), updates);
      const nextUser = {
        ...currentUser,
        username: form.username,
        email: form.email || currentUser.email,
        name: profileName(form, form.username),
      };
      localStorage.setItem('currentUser', JSON.stringify(nextUser));
      setCurrentUser(nextUser);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profile saved',
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      Swal.fire('Unable to save', error.message || 'Profile update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const chooseTheme = (nextTheme) => {
    setTheme(nextTheme);
    setThemeSetting(nextTheme);
  };

  const handleLogout = () => signOutCurrentUser(navigate);

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 pt-14 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 w-full items-center justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/home" className="rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Back to modules">
              <MdArrowBack className="h-5 w-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <img src={logo} alt="STI Locator" className="h-9 w-auto" />
              <p className="hidden truncate text-sm font-semibold text-slate-900 dark:text-white sm:block">STI Locator</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-slate-600 dark:text-slate-300">
            <Link to="/home" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Modules">
              <MdApps className="h-5 w-5" />
            </Link>
            <NotificationBell database={database} audience={currentUser.userType} />
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="flex items-center gap-2"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <FaUserCircle className="h-9 w-9 text-slate-300" />
                <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 md:inline">{currentUser.name || 'User'}</span>
                <FaChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 z-50 w-56 rounded-sm border border-slate-200 bg-white py-2 text-sm text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" role="menu">
                  <Link to="/profile" className="block w-full px-6 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800" role="menuitem">My profile</Link>
                  <button type="button" onClick={() => changeCurrentUserPassword(database, currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800" role="menuitem">Change password</button>
                  <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                  <Link to="/profile?section=theme" className="block w-full px-6 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800" role="menuitem">Theme settings</Link>
                  <button type="button" onClick={handleLogout} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800" role="menuitem">Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <FaUserCircle className="h-12 w-12 text-slate-300" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{currentUser.name || 'User'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{currentUser.username || currentUser.email}</p>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            <Link to="/profile" className={`block rounded-md px-3 py-2 text-sm font-medium ${selectedSection === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              My profile
            </Link>
            <Link to="/profile?section=theme" className={`block rounded-md px-3 py-2 text-sm font-medium ${selectedSection === 'theme' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              Theme settings
            </Link>
          </nav>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {selectedSection === 'profile' ? (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Account</p>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">My Profile</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review and update your account information.</p>
              </div>

              {loading ? (
                <div className="rounded-md bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">Loading profile...</div>
              ) : (
                <form onSubmit={saveProfile} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Username</span>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.username} onChange={(event) => updateField('username', event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Role</span>
                      <input className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" value={roles} readOnly />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">First Name</span>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.first_name} onChange={(event) => updateField('first_name', event.target.value)} disabled={!form.profileType} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Middle Name</span>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.middle_name} onChange={(event) => updateField('middle_name', event.target.value)} disabled={!form.profileType} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Last Name</span>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.last_name} onChange={(event) => updateField('last_name', event.target.value)} disabled={!form.profileType} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                      <input type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.email} onChange={(event) => updateField('email', event.target.value)} disabled={!form.profileType} />
                    </label>
                    {form.profileType === 'faculties' && (
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Department</span>
                        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.department} onChange={(event) => updateField('department', event.target.value)} />
                      </label>
                    )}
                    {form.profileType === 'students' && (
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Student Number</span>
                        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={form.student_number} onChange={(event) => updateField('student_number', event.target.value)} />
                      </label>
                    )}
                  </div>

                  {!form.profileType && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      No faculty or student profile is linked to this account. Only the username can be edited here.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                      <FaSave className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Appearance</p>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Theme Settings</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the display mode for this browser.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseTheme('light')}
                  className={`rounded-lg border p-5 text-left transition ${theme === 'light' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                >
                  <MdLightMode className="mb-4 h-7 w-7 text-amber-500" />
                  <p className="font-semibold text-slate-950 dark:text-white">Light mode</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Clean white surfaces for regular daytime use.</p>
                </button>
                <button
                  type="button"
                  onClick={() => chooseTheme('dark')}
                  className={`rounded-lg border p-5 text-left transition ${theme === 'dark' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                >
                  <MdDarkMode className="mb-4 h-7 w-7 text-blue-500" />
                  <p className="font-semibold text-slate-950 dark:text-white">Dark mode</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lower brightness for darker environments.</p>
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default Profile;
