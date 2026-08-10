import React, { useEffect, useMemo, useState } from 'react';
import {
  MdAccessTime,
  MdClose,
  MdChevronRight,
  MdCoPresent,
  MdFullscreen,
  MdFullscreenExit,
  MdHistory,
  MdHome,
  MdLocationOn,
  MdMeetingRoom,
  MdPeople,
  MdPersonOff,
  MdPersonOutline,
  MdSchool,
  MdSearch,
  MdTouchApp,
} from 'react-icons/md';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
import logo from '../../assets/sti_logo.png';
import { buildTrackerData, facultyDisplayName, getReflectableSchedules } from '../../utils/trackerData';

const facultyStatusStyles = {
  'In-Class': 'bg-blue-50 text-blue-700 ring-blue-200',
  Available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Offline: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const roomStatusStyles = {
  Available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Occupied: 'bg-red-50 text-red-700 ring-red-200',
  Reserved: 'bg-violet-50 text-violet-700 ring-violet-200',
  'Under Maintenance': 'bg-amber-50 text-amber-800 ring-amber-200',
};

const activeFilterStyles = {
  All: 'border-blue-600 bg-white text-blue-700 ring-1 ring-blue-100 shadow-sm',
  'In-Class': 'border-blue-600 bg-white text-blue-700 ring-1 ring-blue-100 shadow-sm',
  Available: 'border-emerald-600 bg-white text-emerald-700 ring-1 ring-emerald-100 shadow-sm',
  Offline: 'border-slate-500 bg-white text-slate-700 ring-1 ring-slate-100 shadow-sm',
  Occupied: 'border-red-600 bg-white text-red-700 ring-1 ring-red-100 shadow-sm',
  Reserved: 'border-violet-600 bg-white text-violet-700 ring-1 ring-violet-100 shadow-sm',
  'Under Maintenance': 'border-amber-500 bg-white text-amber-700 ring-1 ring-amber-100 shadow-sm',
};

const activeFilterIconStyles = {
  All: 'bg-blue-600 text-white',
  'In-Class': 'bg-blue-600 text-white',
  Available: 'bg-emerald-600 text-white',
  Offline: 'bg-slate-600 text-white',
  Occupied: 'bg-red-600 text-white',
  Reserved: 'bg-violet-600 text-white',
  'Under Maintenance': 'bg-amber-500 text-white',
};

const kioskCopy = {
  en: {
    language: 'English',
    welcomeEyebrow: 'STI Campus Directory',
    welcomeTitle: 'Find your way around campus.',
    welcomeText: 'Locate faculty members, check room availability, and view current teaching schedules.',
    start: 'Touch to Start',
    faculty: 'Faculty',
    rooms: 'Rooms',
    directory: 'Live Campus Directory',
    facultyTitle: 'Faculty Locator',
    roomTitle: 'Room Finder',
    facultySearch: 'Search name, department, subject, or room',
    roomSearch: 'Search room, building, faculty, or status',
    clear: 'Clear filters',
    live: 'Live',
    home: 'Return to welcome screen',
  },
  fil: {
    language: 'Filipino',
    welcomeEyebrow: 'Direktoryo ng STI Campus',
    welcomeTitle: 'Hanapin ang kailangan mo sa campus.',
    welcomeText: 'Hanapin ang faculty, tingnan ang available na silid, at suriin ang kasalukuyang iskedyul.',
    start: 'Pindutin para Magsimula',
    faculty: 'Faculty',
    rooms: 'Mga Silid',
    directory: 'Live na Direktoryo',
    facultyTitle: 'Hanapin ang Faculty',
    roomTitle: 'Hanapin ang Silid',
    facultySearch: 'Maghanap ng pangalan, departamento, subject, o silid',
    roomSearch: 'Maghanap ng silid, gusali, faculty, o status',
    clear: 'Alisin ang filter',
    live: 'Live',
    home: 'Bumalik sa welcome screen',
  },
};

const dayOrder = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const normalizeRoomStatus = (room) => {
  const configuredStatus = String(room.roomStatus || '').toLowerCase();
  if (configuredStatus.includes('maintenance')) return 'Under Maintenance';
  if (configuredStatus.includes('reserve')) return 'Reserved';
  return room.status === 'Occupied' ? 'Occupied' : 'Available';
};

const formatClock = (date) => date.toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const formatDate = (date) => date.toLocaleDateString([], {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const getInitials = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'ST';

function Kiosk() {
  const [hasStarted, setHasStarted] = useState(false);
  const [language, setLanguage] = useState('en');
  const [activeView, setActiveView] = useState('faculty');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [facultyLocations, setFacultyLocations] = useState([]);
  const [roomLocations, setRoomLocations] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!hasStarted) return undefined;

    let idleTimer;
    const returnToWelcome = () => {
      setHasStarted(false);
      setSelectedFaculty(null);
      setSelectedRoom(null);
      setSearchTerm('');
      setStatusFilter('All');
      setActiveView('faculty');
    };
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(returnToWelcome, 30000);
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimer);
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [hasStarted]);

  useEffect(() => {
    const unsubscribe = onValue(ref(database), (snapshot) => {
      try {
        const data = snapshot.val() || {};
        const trackerData = buildTrackerData(data);
        const subjects = data.subjects || {};
        const rooms = data.rooms || {};
        const faculties = data.faculties || {};
        const facultyById = Object.values(faculties).reduce((acc, faculty) => {
          if (faculty?.faculty_id) acc[faculty.faculty_id] = faculty;
          return acc;
        }, {});

        const schedules = Object.values(getReflectableSchedules(
          data.schedules || {},
          data.schedule_uploads || {},
        )).map((schedule) => {
          const subject = subjects[schedule.subject_id] || {};
          const room = rooms[schedule.room_id] || {};
          const faculty = facultyById[schedule.faculty_id] || {};
          return {
            scheduleId: schedule.schedule_id,
            facultyId: schedule.faculty_id,
            facultyName: facultyDisplayName(faculty),
            subject: subject.subject_name || subject.subject_code || schedule.subject_name || schedule.subject_id || 'TBD',
            subjectCode: subject.subject_code || schedule.subject_code || '',
            day: schedule.day || 'TBD',
            startTime: schedule.start_time || 'TBD',
            endTime: schedule.end_time || 'TBD',
            section: schedule.section || 'TBD',
            room: room.room_name || schedule.room_name || schedule.room_id || 'TBD',
            term: schedule.term || schedule.semester || '',
            schoolYear: schedule.school_year || '',
          };
        }).sort((a, b) => (
          (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99)
          || String(a.startTime).localeCompare(String(b.startTime))
        ));

        setFacultyLocations(trackerData.facultyLocations);
        setRoomLocations(trackerData.roomLocations);
        setScheduleRows(schedules);
        setLastSynced(new Date());
        setLoading(false);
        setError('');
      } catch (loadError) {
        console.error('Unable to load kiosk data:', loadError);
        setLoading(false);
        setError('Live campus data is temporarily unavailable.');
      }
    }, () => {
      setLoading(false);
      setError('Unable to connect to the live campus tracker.');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedFaculty && !selectedRoom) return undefined;
    const closeTimer = window.setTimeout(() => {
      setSelectedFaculty(null);
      setSelectedRoom(null);
    }, 120000);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedFaculty(null);
        setSelectedRoom(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(closeTimer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedFaculty, selectedRoom]);

  const filteredFaculty = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return facultyLocations.filter((faculty) => (
      (statusFilter === 'All' || faculty.status === statusFilter)
      && (!query || [faculty.name, faculty.department, faculty.subject, faculty.room, faculty.previousRoom]
        .some((value) => String(value || '').toLowerCase().includes(query)))
    ));
  }, [facultyLocations, searchTerm, statusFilter]);

  const filteredRooms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return roomLocations.filter((room) => (
      (statusFilter === 'All' || normalizeRoomStatus(room) === statusFilter)
      && (
        !query
        || [room.room, room.building, room.floor, normalizeRoomStatus(room)]
          .some((value) => String(value || '').toLowerCase().includes(query))
        || room.occupants.some((faculty) => faculty.name.toLowerCase().includes(query))
      )
    ));
  }, [roomLocations, searchTerm, statusFilter]);

  const selectedFacultySchedules = useMemo(() => (
    selectedFaculty
      ? scheduleRows.filter((schedule) => schedule.facultyId === selectedFaculty.id)
      : []
  ), [scheduleRows, selectedFaculty]);

  const facultyCounts = useMemo(() => ({
    total: facultyLocations.length,
    inClass: facultyLocations.filter((faculty) => faculty.status === 'In-Class').length,
    inRoom: facultyLocations.filter((faculty) => faculty.status === 'Available').length,
    offline: facultyLocations.filter((faculty) => faculty.status === 'Offline').length,
  }), [facultyLocations]);

  const roomCounts = useMemo(() => ({
    total: roomLocations.length,
    available: roomLocations.filter((room) => normalizeRoomStatus(room) === 'Available').length,
    occupied: roomLocations.filter((room) => normalizeRoomStatus(room) === 'Occupied').length,
    unavailable: roomLocations.filter((room) => ['Reserved', 'Under Maintenance'].includes(normalizeRoomStatus(room))).length,
  }), [roomLocations]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  };

  const switchView = (view) => {
    setActiveView(view);
    setSearchTerm('');
    setStatusFilter('All');
    setSelectedFaculty(null);
    setSelectedRoom(null);
  };

  const startKiosk = () => {
    setHasStarted(true);
  };

  const visibleCount = activeView === 'faculty' ? filteredFaculty.length : filteredRooms.length;
  const totalCount = activeView === 'faculty' ? facultyLocations.length : roomLocations.length;
  const copy = kioskCopy[language];

  if (!hasStarted) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-slate-950">
        <div className="absolute inset-0 bg-slate-50" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-blue-600"
          style={{ clipPath: 'polygon(64% 0, 100% 0, 100% 100%, 43% 100%)' }}
          aria-hidden="true"
        />
        <div className="absolute inset-y-0 right-0 w-[52%] overflow-hidden" aria-hidden="true">
          <div className="absolute right-[8%] top-[18%] grid w-[68%] grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
              <span
                key={cell}
                className={`block h-24 rounded-lg border border-white/25 ${
                  cell === 1 || cell === 7 ? 'bg-yellow-400' : 'bg-white/10'
                } ${cell === 4 ? 'animate-pulse' : ''}`}
              />
            ))}
          </div>
          <div className="absolute bottom-[12%] right-[11%] flex items-center gap-5 text-white/90">
            <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/25 bg-white/10">
              <MdPeople className="h-10 w-10" />
            </span>
            <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/25 bg-white/10">
              <MdMeetingRoom className="h-10 w-10" />
            </span>
            <span className="h-2 w-32 bg-yellow-400" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-2 w-[43%] bg-yellow-400" aria-hidden="true" />

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-t-4 border-yellow-400 border-b border-slate-200 bg-white/90 px-6 py-5 shadow-sm sm:px-10 lg:px-14">
            <div className="flex items-center gap-4">
              <img src={logo} alt="STI Locator" className="h-16 w-auto rounded-lg shadow-sm" />
              <div>
                <p className="text-2xl font-bold text-slate-950">STI Locator</p>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Campus Kiosk</p>
              </div>
            </div>

            <div className="flex rounded-md border border-slate-200 bg-slate-100 p-1" aria-label="Language">
              {[
                ['en', 'English'],
                ['fil', 'Filipino'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`min-h-11 rounded px-4 text-sm font-bold transition ${
                    language === code
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-blue-700'
                  }`}
                  aria-pressed={language === code}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <main className="flex flex-1 items-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">{copy.welcomeEyebrow}</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                {copy.welcomeTitle}
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-slate-700 sm:text-xl">
                {copy.welcomeText}
              </p>

              <button
                type="button"
                onClick={startKiosk}
                className="mt-9 flex min-h-20 min-w-72 items-center justify-center gap-4 rounded-lg bg-blue-600 px-9 text-xl font-bold text-white shadow-xl transition hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-blue-600">
                  <MdTouchApp className="h-7 w-7" />
                </span>
                {copy.start}
              </button>
            </div>
          </main>

          <footer className="flex items-end justify-between gap-5 px-6 pb-7 sm:px-10 lg:px-14">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
              {loading ? 'Connecting to campus directory' : 'Campus directory ready'}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-white">{formatClock(clock)}</p>
              <p className="text-sm text-blue-100">{formatDate(clock)}</p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-t-4 border-yellow-400 border-b border-slate-200 bg-white text-slate-950 shadow-sm">
        <div className="mx-auto flex min-h-20 max-w-[1720px] items-center gap-4 px-4 py-2 lg:px-8">
          <button
            type="button"
            onClick={() => setHasStarted(false)}
            className="flex shrink-0 items-center gap-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <img src={logo} alt="STI Locator" className="h-12 w-auto rounded-md" />
            <div className="hidden sm:block">
              <p className="text-xl font-bold text-slate-950">STI Locator</p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Campus Kiosk</p>
            </div>
          </button>

          <div className="mx-auto flex overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm">
            <button
              type="button"
              onClick={() => switchView('faculty')}
              className={`flex min-h-12 min-w-36 items-center justify-center gap-2 px-5 text-base font-bold transition-colors ${
                activeView === 'faculty' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-blue-700'
              }`}
            >
              <MdPeople className="h-6 w-6" />
              {copy.faculty}
            </button>
            <button
              type="button"
              onClick={() => switchView('rooms')}
              className={`flex min-h-12 min-w-36 items-center justify-center gap-2 border-l border-slate-200 px-5 text-base font-bold transition-colors ${
                activeView === 'rooms' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-blue-700'
              }`}
            >
              <MdMeetingRoom className="h-6 w-6" />
              {copy.rooms}
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden text-right lg:block">
              <p className="text-lg font-bold tabular-nums text-slate-950">{formatClock(clock)}</p>
              <p className="text-xs text-slate-500">{formatDate(clock)}</p>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullscreen ? <MdFullscreenExit className="h-6 w-6" /> : <MdFullscreen className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => setHasStarted(false)}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              aria-label={copy.home}
              title={copy.home}
            >
              <MdHome className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-[1660px]">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
            <div className="grid gap-4 border-b border-slate-200 px-5 py-5 lg:grid-cols-[minmax(310px,0.65fr)_minmax(440px,1.45fr)] lg:items-center lg:px-6">
              <div>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-[inset_0_-3px_0_rgba(15,23,42,0.18)]">
                    {activeView === 'faculty' ? <MdPeople className="h-7 w-7" /> : <MdMeetingRoom className="h-7 w-7" />}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{copy.directory}</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-950">
                      {activeView === 'faculty' ? copy.facultyTitle : copy.roomTitle}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="relative">
                <MdSearch className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={activeView === 'faculty' ? copy.facultySearch : copy.roomSearch}
                  className="h-14 w-full rounded-md border border-slate-300 bg-slate-50 pl-14 pr-5 text-base outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex flex-1 flex-wrap gap-2">
                {(activeView === 'faculty'
                  ? [
                    ['All', facultyCounts.total, MdPeople],
                    ['In-Class', facultyCounts.inClass, MdCoPresent],
                    ['Available', facultyCounts.inRoom, MdPersonOutline],
                    ['Offline', facultyCounts.offline, MdPersonOff],
                  ]
                  : [
                    ['All', roomCounts.total, MdMeetingRoom],
                    ['Available', roomCounts.available, MdMeetingRoom],
                    ['Occupied', roomCounts.occupied, MdPeople],
                    ['Under Maintenance', roomLocations.filter((room) => normalizeRoomStatus(room) === 'Under Maintenance').length, MdMeetingRoom],
                    ['Reserved', roomLocations.filter((room) => normalizeRoomStatus(room) === 'Reserved').length, MdAccessTime],
                  ]).map(([label, count, Icon]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setStatusFilter(label)}
                      className={`flex min-h-14 min-w-40 flex-1 items-center gap-3 rounded-md border px-4 text-sm font-bold transition lg:max-w-56 ${
                        statusFilter === label
                          ? activeFilterStyles[label]
                          : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-px hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800'
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        statusFilter === label ? activeFilterIconStyles[label] : 'bg-slate-50 text-slate-600'
                      }`}
                      >
                        {React.createElement(Icon, { className: 'h-5 w-5' })}
                      </span>
                      {label}
                      <span className="ml-auto text-base font-bold tabular-nums">
                        {count}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white">
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
                </span>
                <div>
                  <p className="font-bold uppercase text-slate-700">{copy.live}</p>
                  {lastSynced && <p className="font-normal">as of {formatClock(lastSynced)}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-1">
            <p className="text-sm font-medium text-slate-600">
              Showing {visibleCount} of {totalCount} {activeView === 'faculty' ? 'faculty members' : 'rooms'}
            </p>
            {(searchTerm || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                }}
                className="text-sm font-bold text-blue-700 hover:text-blue-900"
              >
                {copy.clear}
              </button>
            )}
          </div>

          {loading && (
            <div className="mt-5 grid animate-pulse gap-5 xl:grid-cols-2" aria-label="Loading live campus information">
              {[1, 2].map((item) => (
                <div key={item} className="min-h-80 rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-md bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-5 w-2/3 rounded bg-slate-200" />
                      <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                    <div className="h-12 rounded bg-slate-100" />
                    <div className="h-12 rounded bg-slate-100" />
                  </div>
                  <div className="mt-5 h-4 w-1/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
              <p className="text-lg font-bold">Tracker unavailable</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && activeView === 'faculty' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredFaculty.map((faculty) => (
                <button
                  key={faculty.id}
                  type="button"
                  onClick={() => setSelectedFaculty(faculty)}
                  className="group relative min-h-60 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${
                    faculty.status === 'In-Class'
                      ? 'bg-blue-600'
                      : faculty.status === 'Available' ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  />
                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                          faculty.status === 'In-Class'
                            ? 'bg-blue-50 text-blue-800'
                            : faculty.status === 'Available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                        >
                          {getInitials(faculty.name)}
                          <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-white ${
                            faculty.status === 'In-Class'
                              ? 'bg-blue-500'
                              : faculty.status === 'Available' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-lg font-bold leading-tight text-slate-950">{faculty.name}</h2>
                          <p className="mt-1 truncate text-sm font-medium text-blue-600">{faculty.department || 'Faculty'}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase ring-1 ${facultyStatusStyles[faculty.status] || facultyStatusStyles.Offline}`}>
                        {faculty.statusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 border-y border-slate-200 py-4">
                      <div className="flex min-w-0 items-center gap-4 border-r border-slate-200 pr-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <MdLocationOn className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase text-slate-400">Current room</p>
                          <p className="mt-1 truncate text-sm font-bold text-slate-800">{faculty.room}</p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-4 pl-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <MdSchool className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase text-slate-400">Current subject</p>
                          <p className="mt-1 truncate text-sm font-bold text-slate-800">{faculty.subject}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-3 truncate text-sm text-slate-500">
                        <MdHistory className="h-6 w-6 shrink-0 text-blue-600" />
                        Previous room: <span className="truncate font-semibold text-slate-700">{faculty.previousRoom || 'No previous room'}</span>
                      </p>
                      <span className="ml-3 flex min-h-10 shrink-0 items-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm">
                        Details <MdChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && activeView === 'rooms' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredRooms.map((room) => {
                const displayStatus = normalizeRoomStatus(room);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className="group relative min-h-52 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 pl-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className={`absolute inset-y-0 left-0 w-1.5 ${
                      displayStatus === 'Available'
                        ? 'bg-emerald-500'
                        : displayStatus === 'Occupied'
                          ? 'bg-red-500'
                          : displayStatus === 'Reserved' ? 'bg-violet-500' : 'bg-amber-500'
                    }`}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                          displayStatus === 'Available'
                            ? 'bg-emerald-50 text-emerald-700'
                            : displayStatus === 'Occupied'
                              ? 'bg-red-50 text-red-700'
                              : displayStatus === 'Reserved'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-amber-50 text-amber-700'
                        }`}
                        >
                          <MdMeetingRoom className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-2xl font-bold text-slate-950">{room.room}</h2>
                          <p className="mt-1 truncate text-sm text-slate-500">{room.building} / {room.floor}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase ring-1 ${roomStatusStyles[displayStatus] || roomStatusStyles.Available}`}>
                        {displayStatus}
                      </span>
                    </div>
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-xs font-bold uppercase text-slate-400">
                        {room.occupants.length ? 'Current occupant' : 'Current occupancy'}
                      </p>
                      <p className="mt-2 line-clamp-2 min-h-10 text-base font-semibold text-slate-700">
                        {room.occupants.length
                          ? room.occupants.map((faculty) => faculty.name).join(', ')
                          : 'No faculty currently logged in'}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <span className="flex min-h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm">
                        Room details <MdChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !error && visibleCount === 0 && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-white py-16 text-center">
              <MdSearch className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-lg font-bold">No matching results</p>
              <p className="mt-1 text-sm text-slate-500">Try another faculty name, room, subject, or status.</p>
            </div>
          )}
        </section>
      </main>

      {selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-blue-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b-4 border-yellow-400 bg-blue-700 px-6 py-5 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white text-lg font-bold text-blue-700 shadow-sm">
                  {getInitials(selectedFaculty.name)}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Faculty directory</p>
                  <h2 className="mt-1 text-2xl font-bold">{selectedFaculty.name}</h2>
                  <p className="mt-1 text-sm text-white/80">{selectedFaculty.department}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFaculty(null)}
                className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10"
                aria-label="Close faculty details"
              >
                <MdClose className="h-7 w-7" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto bg-slate-50/70 p-6">
              <div className="grid overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="border-b border-slate-200 p-4 sm:border-r lg:border-b-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Status</p>
                  <p className="mt-2 font-bold text-blue-700">{selectedFaculty.statusLabel}</p>
                </div>
                <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Current Room</p>
                  <p className="mt-2 font-bold text-slate-950">{selectedFaculty.room}</p>
                </div>
                <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Previous Room</p>
                  <p className="mt-2 font-bold text-slate-950">{selectedFaculty.previousRoom}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Current Subject</p>
                  <p className="mt-2 line-clamp-2 font-bold text-slate-950">{selectedFaculty.subject}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">Active Teaching Schedule</h3>
                  <p className="mt-1 text-sm text-slate-500">Only schedules from the active upload are displayed.</p>
                </div>
                <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                  {selectedFacultySchedules.length} classes
                </span>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-left text-xs font-bold uppercase tracking-[0.1em] text-blue-800">
                    <tr>
                      <th className="px-4 py-3">Day</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Section</th>
                      <th className="px-4 py-3">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedFacultySchedules.map((schedule) => (
                      <tr key={schedule.scheduleId}>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-950">{schedule.day}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{schedule.startTime} - {schedule.endTime}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-semibold">{schedule.subject}</p>
                          {schedule.subjectCode && <p className="text-xs text-slate-400">{schedule.subjectCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{schedule.section}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{schedule.room}</td>
                      </tr>
                    ))}
                    {!selectedFacultySchedules.length && (
                      <tr>
                        <td colSpan="5" className="px-4 py-10 text-center text-slate-500">
                          No active schedule is assigned to this faculty member.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm sm:p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-blue-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b-4 border-yellow-400 bg-blue-700 px-6 py-5 text-white">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm">
                  <MdMeetingRoom className="h-8 w-8" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Campus room</p>
                  <h2 className="mt-1 text-2xl font-bold">{selectedRoom.room}</h2>
                  <p className="mt-1 text-sm text-white/80">{selectedRoom.building} / {selectedRoom.floor}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10"
                aria-label="Close room details"
              >
                <MdClose className="h-7 w-7" />
              </button>
            </div>
            <div className="bg-slate-50/70 p-6">
              <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Current Status</p>
                  <p className="mt-1 text-lg font-bold text-blue-700">{normalizeRoomStatus(selectedRoom)}</p>
                </div>
                <MdMeetingRoom className="h-10 w-10 text-blue-600" />
              </div>

              <h3 className="mt-6 text-lg font-bold">Current Occupants</h3>
              <div className="mt-3 space-y-3">
                {selectedRoom.occupants.map((faculty) => (
                  <button
                    key={faculty.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoom(null);
                      setSelectedFaculty(faculty);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-blue-100 bg-white px-4 py-4 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                        <MdPeople className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950">{faculty.name}</p>
                        <p className="truncate text-sm text-slate-500">{faculty.subject}</p>
                      </div>
                    </div>
                    {faculty.hasClass && (
                      <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-600">
                        <MdAccessTime className="h-5 w-5" />
                        {faculty.startTime} - {faculty.endTime}
                      </div>
                    )}
                  </button>
                ))}
                {!selectedRoom.occupants.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center text-slate-500">
                    No faculty member is currently logged into this room.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Kiosk;
