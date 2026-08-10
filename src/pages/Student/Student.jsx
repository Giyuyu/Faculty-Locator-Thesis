import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdApps, MdClose, MdPeople, MdSchool } from 'react-icons/md';
import { FaBook, FaChevronDown, FaUserCircle } from 'react-icons/fa';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import ProfileLink from '../../components/ProfileLink';
import QuickStartGuide, { STUDENT_GUIDE_STEPS } from '../../components/QuickStartGuide';
import logo from '../../assets/sti_logo.png';
import { buildTrackerData, getReflectableSchedules } from '../../utils/trackerData';

const statusClasses = {
  'In-Class': 'bg-blue-100 text-blue-800 ring-blue-200',
  Available: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Offline: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const statusBorders = {
  'In-Class': 'border-l-blue-500',
  Available: 'border-l-emerald-500',
  Offline: 'border-l-transparent',
};

function Student() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [currentUser, setCurrentUser] = useState(null);
  const [quickGuideOpen, setQuickGuideOpen] = useState(false);
  const [facultyLocations, setFacultyLocations] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (!user) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(user);
    const isAdmin = parsedUser.userType === 'admin' || parsedUser.roleIds?.includes('admin');
    if (!isAdmin && !parsedUser.permissions?.access_student_module) {
      navigate('/home');
      return;
    }

    setCurrentUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    const guideKey = 'quickStartSeen:student';
    if (localStorage.getItem(guideKey) !== 'true') {
      setQuickGuideOpen(true);
      localStorage.setItem(guideKey, 'true');
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onValue(ref(database), (snapshot) => {
      try {
        const data = snapshot.val() || {};
        const { facultyLocations: locations } = buildTrackerData(data);
        const subjects = data.subjects || {};
        const rooms = data.rooms || {};
        const faculties = data.faculties || {};
        const facultyById = Object.values(faculties).reduce((acc, faculty) => {
          if (faculty?.faculty_id) acc[faculty.faculty_id] = faculty;
          return acc;
        }, {});

        const currentSchedules = getReflectableSchedules(data.schedules || {}, data.schedule_uploads || {});
        const schedules = Object.values(currentSchedules)
          .filter(Boolean)
          .map((schedule) => {
            const subject = subjects[schedule.subject_id] || {};
            const room = rooms[schedule.room_id] || {};
            const faculty = facultyById[schedule.faculty_id] || {};
            return {
              scheduleId: schedule.schedule_id,
              facultyId: schedule.faculty_id,
              facultyName: [faculty.first_name, faculty.middle_name, faculty.last_name].filter(Boolean).join(' '),
              subject: subject.subject_name || subject.subject_code || schedule.subject_name || schedule.subject_id || 'TBD',
              day: schedule.day || 'TBD',
              startTime: schedule.start_time || 'TBD',
              endTime: schedule.end_time || 'TBD',
              section: schedule.section || 'TBD',
              room: room.room_name || schedule.room_name || schedule.room_id || 'TBD',
              semester: schedule.term || schedule.semester || '',
              term: schedule.term || schedule.semester || '',
              schoolYear: schedule.school_year || '',
            };
          })
          .sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.startTime).localeCompare(String(b.startTime)));

        setFacultyLocations(locations);
        setScheduleRows(schedules);
        setLoading(false);
        setError('');
      } catch (err) {
        console.error('Error loading student faculty data:', err);
        setFacultyLocations([]);
        setScheduleRows([]);
        setLoading(false);
        setError('Failed to load faculty status.');
      }
    }, () => {
      setFacultyLocations([]);
      setScheduleRows([]);
      setLoading(false);
      setError('Failed to connect to database.');
    });

    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return facultyLocations.filter((faculty) => {
      const matchesSearch = !term || [faculty.name, faculty.subject, faculty.department]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesStatus = selectedStatus === 'All' || faculty.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [facultyLocations, searchTerm, selectedStatus]);

  const selectedFacultySchedules = selectedFaculty
    ? scheduleRows.filter((schedule) => schedule.facultyId === selectedFaculty.id)
    : [];
  const statuses = ['All', 'In-Class', 'Available', 'Offline'];

  const closeQuickGuide = () => {
    localStorage.setItem('quickStartSeen:student', 'true');
    setQuickGuideOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-14 text-slate-950">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 shadow-sm" data-tour="module-navbar">
          <div className="flex h-14 w-full items-center justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="h-9 w-9 shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 items-center gap-3">
                <img src={logo} alt="STI Locator" className="h-9 w-auto" />
                <p className="hidden truncate text-sm font-semibold text-slate-900 sm:block">STI Locator</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-slate-600">
              <button
                type="button"
                onClick={() => setQuickGuideOpen(true)}
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Open student guide"
                title="Quick start guide"
                data-tour="guide"
              >
                <FaBook className="h-4 w-4" />
              </button>
              <Link to="/home" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Modules" data-tour="module-switcher">
                <MdApps className="h-5 w-5" />
              </Link>
              <div data-tour="notifications">
                <NotificationBell database={database} audience="student" />
              </div>
              {currentUser && <div data-tour="profile"><ProfileLink user={currentUser} /></div>}
            </div>
          </div>
        </header>

        <QuickStartGuide
          open={quickGuideOpen}
          onClose={closeQuickGuide}
          user={currentUser}
          steps={STUDENT_GUIDE_STEPS}
        />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 text-center" data-tour="student-overview">
            <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text pb-2 pt-4 text-4xl font-bold leading-relaxed text-transparent">
              Faculty Status
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              View faculty availability and open a card to see their schedule.
            </p>
          </div>

          <div className="mb-8 rounded-2xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-lg" data-tour="student-filters">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
                <input
                  type="text"
                  placeholder="Search by faculty name, subject, or department..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 px-4 py-3 transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 px-4 py-3 transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-600">Showing {filteredData.length} of {facultyLocations.length} faculty members</p>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white/80 py-12 text-center shadow-lg">
              <MdSchool className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Loading faculty status...</h3>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white/80 py-12 text-center shadow-lg">
              <h3 className="text-lg font-semibold text-red-700">{error}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-tour="student-cards">
              {filteredData.map((faculty) => (
                <button
                  key={faculty.id}
                  type="button"
                  onClick={() => setSelectedFaculty(faculty)}
                  className={`min-h-72 overflow-hidden rounded-2xl border border-white/20 border-l-4 bg-white/80 text-left shadow-lg backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${statusBorders[faculty.status] || statusBorders.Offline}`}
                >
                  <div className="flex h-full flex-col p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <MdPeople className="h-7 w-7" />
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses[faculty.status] || statusClasses.Offline}`}>
                        {faculty.statusLabel}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">{faculty.name}</h3>
                    <p className="mt-1 truncate text-sm text-gray-600">{faculty.department}</p>
                    <p className="mt-4 line-clamp-2 min-h-10 text-sm font-medium text-blue-600">{faculty.subject}</p>

                    <div className="mt-auto border-t border-slate-200 pt-4">
                      <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase text-slate-400">Current room</p>
                          <p className="mt-1 truncate text-base font-semibold text-slate-900">{faculty.room}</p>
                        </div>
                        {faculty.hasClass && (
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-medium uppercase text-slate-400">Class time</p>
                            <p className="mt-1 text-xs font-semibold text-slate-600">{faculty.startTime} - {faculty.endTime}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && !filteredData.length && (
            <div className="py-12 text-center">
              <MdPeople className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-xl font-semibold text-gray-900">No faculty found</h3>
              <p className="mt-1 text-gray-600">Try adjusting your search or status filter.</p>
            </div>
          )}
        </main>

      {selectedFaculty && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
              <div>
                <h2 className="text-2xl font-bold">{selectedFaculty.name}</h2>
                <p className="mt-1 text-blue-100">{selectedFaculty.department}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFaculty(null)}
                className="rounded-md p-2 hover:bg-white/10"
                aria-label="Close schedule"
              >
                <MdClose className="h-6 w-6" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-6">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${statusClasses[selectedFaculty.status] || statusClasses.Offline}`}>
                  {selectedFaculty.statusLabel}
                </span>
                <span className="text-sm text-slate-600">{selectedFaculty.subject}</span>
                <span className="text-sm text-slate-600">Current room: {selectedFaculty.room}</span>
              </div>

              <h3 className="mb-3 text-lg font-semibold text-slate-950">Faculty Schedule</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                      <th className="pb-3 pr-4">Day</th>
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Subject</th>
                      <th className="pb-3 pr-4">Section</th>
                      <th className="pb-3">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedFacultySchedules.map((schedule) => (
                      <tr key={schedule.scheduleId}>
                        <td className="py-3 pr-4 font-medium text-slate-900">{schedule.day}</td>
                        <td className="py-3 pr-4 text-slate-600">{schedule.startTime} - {schedule.endTime}</td>
                        <td className="py-3 pr-4 text-slate-600">{schedule.subject}</td>
                        <td className="py-3 pr-4 text-slate-600">{schedule.section}</td>
                        <td className="py-3 text-slate-600">{schedule.room}</td>
                      </tr>
                    ))}
                    {!selectedFacultySchedules.length && (
                      <tr>
                        <td className="py-6 text-sm text-slate-500" colSpan="5">No schedule assigned to this faculty.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Student;
