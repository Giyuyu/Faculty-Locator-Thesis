import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBook,
  FaChevronDown,
  FaCheckCircle,
  FaChalkboardTeacher,
  FaUserCircle,
  FaUserGraduate,
  FaUserShield,
} from 'react-icons/fa';
import { database } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import logo from '../../assets/sti_logo.png';
import heroPoster from '../../assets/sti_hero2.jpg';
import facultyVideo from '../../assets/videos/Faculty.mp4';
import studentVideo from '../../assets/videos/Student.mp4';
import {
  changeCurrentUserPassword,
  showUserProfile,
  signOutCurrentUser,
  toggleThemeSetting,
} from '../../utils/profileActions';

const defaultHeroVideo = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const modules = [
  {
    id: 'admin',
    title: 'Admin',
    label: 'CONTROL',
    heroLabel: 'CHECK',
    description: 'Users, roles, permissions, floors, rooms, and batch uploads.',
    path: '/admin',
    permission: 'access_admin_module',
    icon: FaUserShield,
    checklist: ['Internal Signup', 'Batch Upload', 'Roles and Permissions', 'Floors and Rooms', 'Account Status'],
  },
  {
    id: 'faculty',
    title: 'Faculty',
    label: 'TEACH',
    heroLabel: 'TRACK',
    description: 'Faculty tracker, schedules, and room monitoring tools.',
    path: '/faculty',
    permission: 'access_faculty_module',
    icon: FaChalkboardTeacher,
    videoSrc: facultyVideo,
    checklist: ['Faculty Locator', 'Room Tracker', 'Schedule Uploads', 'Availability Status', 'Campus Monitoring'],
  },
  {
    id: 'student',
    title: 'Student',
    label: 'LOCATE',
    heroLabel: 'FIND',
    description: 'Faculty locator and room availability for students.',
    path: '/student',
    permission: 'access_student_module',
    icon: FaUserGraduate,
    videoSrc: studentVideo,
    checklist: ['Find Faculty', 'View Rooms', 'Check Availability', 'Browse Schedules', 'Campus Guide'],
  },
];

function Home() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      navigate('/login');
      return;
    }

    setCurrentUser(JSON.parse(storedUser));
  }, [navigate]);

  const availableModules = useMemo(() => {
    if (!currentUser) return [];
    const isAdmin = currentUser.userType === 'admin' || currentUser.roleIds?.includes('admin');
    if (isAdmin) return modules;

    return modules.filter((module) => currentUser.permissions?.[module.permission]);
  }, [currentUser]);

  useEffect(() => {
    if (availableModules.length && !availableModules.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(availableModules[0].id);
    }
  }, [availableModules, selectedModuleId]);

  const selectedModule = availableModules.find((module) => module.id === selectedModuleId) || availableModules[0];
  const heroVideo = selectedModule?.videoSrc || defaultHeroVideo;

  const handleEnter = () => {
    if (selectedModule) {
      navigate(selectedModule.path);
    }
  };

  const handleLogout = () => {
    signOutCurrentUser(navigate);
  };

  if (!currentUser) return null;

  return (
    <div className="h-screen overflow-hidden bg-white pt-14 text-slate-950">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-100 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-9 w-9 shrink-0" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <img src={logo} alt="STI Locator" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">STI Locator</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-slate-600">
          <button type="button" onClick={handleEnter} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Open selected module">
            <FaBook className="h-4 w-4" />
          </button>
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
              <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 md:inline">
                {currentUser.name || 'User'}
              </span>
              <FaChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 rounded-sm border border-slate-200 bg-white py-2 text-sm text-slate-600 shadow-xl" role="menu">
                <button type="button" onClick={() => showUserProfile(currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">
                  My profile
                </button>
                <button type="button" onClick={() => changeCurrentUserPassword(database, currentUser)} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">
                  Change password
                </button>
                <div className="my-2 border-t border-slate-200" />
                <button type="button" onClick={toggleThemeSetting} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">
                  Theme settings
                </button>
                <button type="button" onClick={handleLogout} className="block w-full px-6 py-2.5 text-left hover:bg-slate-50" role="menuitem">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="relative h-[calc(100vh-17rem)] overflow-hidden">
        <video
          key={heroVideo}
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
          autoPlay
          muted
          loop
          playsInline
          poster={heroPoster}
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-white/10" />
        <div className="absolute inset-0 bg-slate-900/5" />

        <div className="relative z-10 flex h-full items-center px-6 py-5 sm:px-12 lg:px-16">
          <div className="max-w-sm">
            <div className="mb-4">
              <img src={logo} alt="STI Locator" className="h-16 w-auto" />
              <p className="mt-1 text-2xl font-black text-[#27336f]">{selectedModule?.heroLabel || 'CHECK'}</p>
            </div>
            <h1 className="sr-only">STI Locator Main Selection</h1>
            <div className="space-y-1.5">
              {(selectedModule?.checklist || []).map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <FaCheckCircle className="h-4 w-4 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleEnter}
              disabled={!selectedModule}
              className="mt-4 inline-flex min-w-36 justify-center rounded-full bg-[#27336f] px-7 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-400/40 hover:bg-[#1f2858] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enter
            </button>
          </div>
        </div>
      </section>

      <section id="modules" className="h-56 overflow-hidden border-t border-slate-100 px-6 py-4 sm:px-10 lg:px-16">
        {availableModules.length ? (
          <div className="grid h-full grid-cols-3 gap-5">
            {availableModules.map((module) => {
              const Icon = module.icon;
              const isSelected = selectedModuleId === module.id;
              return (
                <button
                  type="button"
                  key={module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={`group h-full min-w-0 rounded-xl p-4 text-left transition duration-300 ${
                    isSelected
                      ? 'bg-[#fffafa] shadow-[18px_18px_28px_rgba(239,68,68,0.30),-18px_-18px_28px_rgba(99,102,241,0.20)] ring-2 ring-red-200'
                      : 'bg-white shadow-2xl shadow-slate-300/70 ring-1 ring-slate-100 hover:-translate-y-1 hover:shadow-slate-400/70'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={`h-7 w-7 shrink-0 ${isSelected ? 'text-red-500' : 'text-[#27336f]'}`} />
                    <div>
                      <p className="text-2xl font-light text-slate-400">STI</p>
                      <p className="text-xl font-black text-[#27336f]">{module.label}</p>
                    </div>
                  </div>
                  <h2 className="mt-3 truncate text-sm font-semibold text-slate-950">{module.title} Module</h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{module.description}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            <p className="font-semibold">No modules available</p>
            <p className="mt-1 text-sm">Ask an administrator to assign a role or module access permission to your account.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
