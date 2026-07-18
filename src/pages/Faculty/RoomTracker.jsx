import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdApps, MdPeople, MdSchedule, MdLogout, MdLocationOn, MdSchool, MdCheckCircle, MdCancel, MdSearch } from 'react-icons/md';
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

// Function to determine floor from room number
function getFloorFromRoom(room) {
  if (!room || typeof room !== 'string') return 'Unknown';

  // Remove any prefixes like RM, LAB, etc.
  let cleanRoom = room.replace(/^(RM|LAB|ROOM)\s*/i, '').trim();

  // Special case: 101 is Ground Floor
  if (cleanRoom === '101') {
    return 'Ground Floor';
  }

  // Get first digit to determine floor
  const firstDigit = cleanRoom.charAt(0);
  const floorNumber = parseInt(firstDigit);

  if (isNaN(floorNumber) || floorNumber < 1 || floorNumber > 6) {
    return 'Not Available';
  }

  // Convert number to ordinal (1st, 2nd, 3rd, etc.)
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = (floorNumber % 10 === 1 && floorNumber !== 11) ? 'st' :
                (floorNumber % 10 === 2 && floorNumber !== 12) ? 'nd' :
                (floorNumber % 10 === 3 && floorNumber !== 13) ? 'rd' : 'th';

  return `${floorNumber}${suffix} Floor`;
}

function RoomTracker() {
  const navigate = useNavigate();

  // Add custom styles for animated background
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes move {
        0% { background-position: 0 0; }
        100% { background-position: -400px 0; }
      }
      .animate-[move_10s_linear_infinite] {
        animation: move 10s linear infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('moduleSidebarOpen') === 'true');
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  });
  const [roomLocations, setRoomLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (
      currentUser.userType !== 'admin' &&
      !currentUser.roleIds?.includes('admin') &&
      !currentUser.permissions?.access_faculty_module &&
      !currentUser.permissions?.manage_rooms
    ) {
      navigate('/home');
    }
  }, [currentUser, navigate]);


  // Fetch rooms and live occupancy from the Python desktop app schema.
  useEffect(() => {
    const trackerRef = ref(database);

    const unsubscribe = onValue(trackerRef, (snapshot) => {
      try {
        const { roomLocations: rooms } = buildTrackerData(snapshot.val() || {});
        setRoomLocations(rooms);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching room locations:', err);
        setRoomLocations([]);
        setLoading(false);
        setError('Failed to load room data');
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setRoomLocations([]);
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

  const openRoomModal = (room) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
  };


  const filteredData = useMemo(() => {
    return roomLocations.filter(item => {
      const matchesSearch = item.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.floor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFloor = selectedFloor === 'All' || item.floor === selectedFloor;
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;

      return matchesSearch && matchesFloor && matchesStatus;
    });
  }, [searchTerm, selectedFloor, selectedStatus, roomLocations]);

  const floors = ['All', 'Ground Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor'];
  const statuses = ['All', 'Occupied', 'Available', 'Reserved', 'Under Maintenance'];
  const roomStatusStyles = {
    Occupied: {
      cardBorder: 'border-l-4 border-l-red-500 dark:border-l-red-400',
      badge: 'bg-red-500 text-white border-2 border-red-600',
      modalBadge: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      icon: MdCancel,
      label: 'Occupied',
      description: (room) => room.occupants.map(o => o.name).join(', '),
    },
    Available: {
      cardBorder: '',
      badge: 'bg-green-500 text-white border-2 border-green-600',
      modalBadge: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      icon: MdCheckCircle,
      label: 'Available',
      description: () => 'Available',
    },
    Reserved: {
      cardBorder: 'border-l-4 border-l-violet-500 dark:border-l-violet-400',
      badge: 'bg-violet-500 text-white border-2 border-violet-600',
      modalBadge: 'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200',
      icon: MdCancel,
      label: 'Reserved',
      description: () => 'Reserved',
    },
    'Under Maintenance': {
      cardBorder: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
      badge: 'bg-amber-500 text-white border-2 border-amber-600',
      modalBadge: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
      icon: MdCancel,
      label: 'Under Maintenance',
      description: () => 'Under maintenance',
    },
  };
  const getRoomStatusStyle = (status) => roomStatusStyles[status] || roomStatusStyles.Available;

  return (
     <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-14 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <div className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-[width] duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-0 border-r-0 shadow-none'}`}>
        <div className={`relative h-full w-72 px-4 py-5 transition-opacity duration-200 ease-in-out ${isSidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'}`}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <MdLocationOn className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">STI Locator</p>
              <p className="text-xs text-slate-500">Faculty Module</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="mt-8 space-y-1">
            <Link to="/faculty" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <MdPeople className="h-5 w-5" />
              <span>Faculty Tracker</span>
            </Link>
            <div className="flex items-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-lg">
              <MdLocationOn className="h-5 w-5" />
              <span>Room Tracker</span>
            </div>
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
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-relaxed pt-4 pb-2 relative">
            Room Tracker
            <div className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1440 320%22><path fill=%22%234f46e5%22 fill-opacity=%220.1%22 d=%22M0,160L48,170.7C96,181,192,203,288,202.7C384,203,480,181,576,176C672,171,768,181,864,165.3C960,150,1056,107,1152,90.7C1248,75,1344,85,1440,96L1440,320L0,320Z%22/%3E</svg>')] animate-[move_10s_linear_infinite]"></div>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real-time tracking of room availability and occupancy
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/20 p-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by room number or floor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                />
                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Floor Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Floor</label>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
              >
                {floors.map(floor => (
                  <option key={floor} value={floor} className="bg-white dark:bg-gray-800">{floor}</option>
                ))}
              </select>
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
            Showing {filteredData.length} of {roomLocations.length} rooms
          </p>
        </div>

         {/* Room Cards Grid */}
         {loading ? (
           <div className="text-center py-12">
             <div className="text-6xl mb-4 opacity-50">
               <MdSchool className="text-gray-400 dark:text-gray-600" />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading room locations...</h3>
             <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch real-time data</p>
           </div>
         ) : error ? (
           <div className="text-center py-12">
             <div className="text-6xl mb-4 opacity-50">
               <MdCancel className="text-gray-400 dark:text-gray-600" />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error loading data</h3>
             <p className="text-gray-600 dark:text-gray-400">{error}</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
             {filteredData.map((room) => (
              (() => {
                const statusStyle = getRoomStatusStyle(room.status);
                const StatusIcon = statusStyle.icon;
                return (
               <div
                 key={room.room}
                 className={`group border border-slate-100 bg-white/80 dark:border-gray-700 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                   statusStyle.cardBorder
                 }`}
                 onClick={() => openRoomModal(room)}
               >
                 <div className="p-6 sm:p-8">
                   {/* Icon and Status */}
                   <div className="flex items-center justify-between mb-4">
                     <MdSchool className="text-3xl text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-300" />
                     <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-md ${
                       statusStyle.badge
                     }`}>
                       <StatusIcon className="w-5 h-5 mr-1" />
                       {statusStyle.label}
                     </span>
                   </div>

                   {/* Room Info */}
                   <div className="space-y-2">
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-300">{room.room}</h3>
                     <p className="text-sm text-blue-600 dark:text-blue-400">
                       {statusStyle.description(room)}
                     </p>
                     {room.status === 'Occupied' && (
                       <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                         {room.occupants.some(o => o.hasClass)
                           ? room.occupants.filter(o => o.hasClass).map(o => `${o.subject} (${o.startTime} - ${o.endTime})`).join(', ')
                           : 'Occupied without active class'}
                       </p>
                     )}
                   </div>

                   {/* Floor */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-500">Floor</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{room.floor}</div>
                    </div>
                  </div>
                </div>
                );
              })()
                  ))}
           </div>
         )}
 
          {/* No Results */}
         {filteredData.length === 0 && !loading && !error && (
           <div className="text-center py-12">
             <div className="text-6xl mb-4 opacity-50">
               <MdSearch className="text-gray-400 dark:text-gray-600" />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No rooms found</h3>
             <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
           </div>
         )}

        {/* Modal */}
        {isModalOpen && selectedRoom && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedRoom.room} Details</h2>
                    <p className="text-blue-100 dark:text-blue-200">{selectedRoom.floor}</p>
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
                         <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                           getRoomStatusStyle(selectedRoom.status).modalBadge
                         }`}>
                           {(() => {
                             const statusStyle = getRoomStatusStyle(selectedRoom.status);
                             const StatusIcon = statusStyle.icon;
                             return (
                               <>
                                 <StatusIcon className="w-5 h-5 mr-1" />
                                 {statusStyle.label}
                               </>
                             );
                           })()}
                         </span>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Occupants:</strong> {selectedRoom.occupants.length}</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Floor:</strong> {selectedRoom.floor}</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100"><strong>Building:</strong> {selectedRoom.building}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Occupants List */}
                {selectedRoom.occupants.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Current Occupants</h3>
                    <div className="space-y-3">
                      {selectedRoom.occupants.map((occupant) => (
                        <div key={occupant.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{occupant.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{occupant.subject}</p>
                              {occupant.hasClass ? (
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {occupant.startTime} - {occupant.endTime}{occupant.section ? ` • ${occupant.section}` : ''}
                                </p>
                              ) : (
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Occupying room, no active class</p>
                              )}
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              occupant.status === 'In-Class'
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            }`}>
                              {occupant.statusLabel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

export default RoomTracker;
