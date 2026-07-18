import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdApps, MdPeople, MdSchedule, MdLogout, MdLocationOn } from 'react-icons/md';
import { FaBars, FaChevronDown, FaUserCircle } from 'react-icons/fa';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import logo from '../../assets/sti_logo.png';
import { buildTrackerData } from '../../utils/trackerData';
import {
  changeCurrentUserPassword,
  openThemeSettings,
  openUserProfile,
  signOutCurrentUser,
} from '../../utils/profileActions';

function Faculty() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('moduleSidebarOpen') === 'true');
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [facultyLocations, setFacultyLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentFaculty = useMemo(() => {
    return facultyLocations.find(f => f.name === currentUser?.name);
  }, [facultyLocations, currentUser]);

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const parsedUser = JSON.parse(user);
      const isAdmin = parsedUser.userType === 'admin' || parsedUser.roleIds?.includes('admin');
      if (!isAdmin && !parsedUser.permissions?.access_faculty_module) {
        navigate('/home');
        return;
      }
      setCurrentUser(parsedUser);
    } else {
      navigate('/login');
    }
  }, [navigate]);


  // Fetch live faculty locations from the Python desktop app schema.
  useEffect(() => {
    const trackerRef = ref(database);

    const unsubscribe = onValue(trackerRef, (snapshot) => {
      try {
        const { facultyLocations: locations } = buildTrackerData(snapshot.val() || {});
        setFacultyLocations(locations);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching faculty locations:', err);
        setFacultyLocations([]);
        setLoading(false);
        setError('Failed to load faculty data');
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setFacultyLocations([]);
      setLoading(false);
      setError('Failed to connect to database');
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOutCurrentUser(navigate);
  };
  const setSidebarPreference = (open) => {
    localStorage.setItem('moduleSidebarOpen', String(open));
    setIsSidebarOpen(open);
  };

  const openFacultyModal = (faculty) => {
    setSelectedFaculty(faculty);
    setIsModalOpen(true);
  };


  const filteredData = useMemo(() => {
    return facultyLocations.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || item.statusLabel === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus, facultyLocations]);

  const statuses = ['All', 'In Class', 'In Room', 'Offline'];
  const statusClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    green: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    slate: 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200',
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-14 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <div className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-[width] duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-0 border-r-0 shadow-none'}`}>
        <div className={`relative h-full w-72 px-4 py-5 transition-opacity duration-200 ease-in-out ${isSidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'}`}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <MdPeople className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">STI Locator</p>
              <p className="text-xs text-slate-500">Faculty Module</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="mt-8 space-y-1">
            <div className="flex items-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-lg">
              <MdPeople className="h-5 w-5" />
              <span>Faculty Tracker</span>
            </div>
            <Link to="/room-tracker" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <MdLocationOn className="h-5 w-5" />
              <span>Room Tracker</span>
            </Link>
            <Link to="/faculty-schedules" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <MdSchedule className="h-5 w-5" />
              <span>Schedules</span>
            </Link>
          </nav>
        </div>

        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 shadow-sm">
          <div className="flex h-14 w-full items-center justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => setSidebarPreference(!isSidebarOpen)}
                className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Toggle navigation"
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
                  <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 md:inline">{currentUser ? currentUser.name : 'Faculty Member'}</span>
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-relaxed pt-4 pb-2">
            Faculty Tracker
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real-time tracking of faculty locations
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/20 p-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by faculty name or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                />
                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
              >
                {statuses.map(status => (
                  <option key={status} value={status} className="bg-white dark:bg-gray-800">{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-8">
          <p className="text-gray-600 dark:text-gray-400">
            Showing {filteredData.length} of {facultyLocations.length} faculty members
          </p>
        </div>

        {/* Faculty Cards Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⏳</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading faculty locations...</h3>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch real-time data</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error loading data</h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredData.map((faculty) => (
              <div
                key={faculty.id}
                className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                  faculty.status === 'In-Class'
                    ? 'border-l-4 border-l-blue-500 dark:border-l-blue-400'
                    : faculty.status === 'Available'
                      ? 'border-l-4 border-l-green-500 dark:border-l-green-400'
                    : ''
                }`}
                onClick={() => openFacultyModal(faculty)}
              >
                <div className="p-6 sm:p-8">
                  {/* Avatar and Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">👨‍🏫</div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[faculty.statusTone]}`}>
                      {faculty.statusLabel}
                    </span>
                  </div>

                  {/* Faculty Info */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{faculty.name}</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{faculty.subject}</p>
                    {faculty.hasClass && (
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {faculty.startTime} - {faculty.endTime}{faculty.section ? ` • ${faculty.section}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Room and Floor */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-500">{faculty.isActive ? 'Current Room' : 'Location'}</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{faculty.room}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-500">Floor</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{faculty.floor}</p>
                      </div>
                    </div>
                  </div>

                  {/* Login Time */}
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 dark:text-gray-500">Logged in at</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {faculty.loginTime && faculty.isActive ? new Date(faculty.loginTime).toLocaleTimeString() : 'Not logged in'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {filteredData.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No faculty found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Modal */}
        {isModalOpen && selectedFaculty && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedFaculty.name} Details</h2>
                    <p className="text-blue-100 dark:text-blue-200">Room {selectedFaculty.room} • {selectedFaculty.floor}</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-2 transition-colors cursor-pointer"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
                {/* Current Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Current Status</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusClasses[selectedFaculty.statusTone]}`}>
                          {selectedFaculty.statusLabel}
                        </span>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Subject:</strong> {selectedFaculty.subject}</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Department:</strong> {selectedFaculty.department}</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Current Room:</strong> {selectedFaculty.room}</p>
                          {selectedFaculty.hasClass && (
                            <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Time:</strong> {selectedFaculty.startTime} - {selectedFaculty.endTime}</p>
                          )}
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Login Time:</strong> {selectedFaculty.loginTime && selectedFaculty.isActive ? new Date(selectedFaculty.loginTime).toLocaleString() : 'Not logged in'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default Faculty;
