const normalizeLookup = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

export const facultyDisplayName = (faculty) => [
  faculty?.first_name,
  faculty?.middle_name,
  faculty?.last_name,
].filter(Boolean).join(' ').trim() || faculty?.email || faculty?.faculty_id || 'Not Available';

export const getFloorFromRoomName = (roomName) => {
  if (!roomName || typeof roomName !== 'string') return 'Not Available';

  const cleanRoom = roomName.replace(/^(RM|LAB|ROOM)\s*/i, '').trim();
  if (cleanRoom === '101') return 'Ground Floor';

  const floorNumber = Number.parseInt(cleanRoom.charAt(0), 10);
  if (Number.isNaN(floorNumber) || floorNumber < 1 || floorNumber > 6) {
    return 'Not Available';
  }

  const suffix = (floorNumber % 10 === 1 && floorNumber !== 11) ? 'st'
    : (floorNumber % 10 === 2 && floorNumber !== 12) ? 'nd'
      : (floorNumber % 10 === 3 && floorNumber !== 13) ? 'rd'
        : 'th';

  return `${floorNumber}${suffix} Floor`;
};

const getRoomRecord = (rooms, roomId, roomName) => {
  if (roomId && rooms?.[roomId]) return rooms[roomId];
  if (!roomName) return null;

  return Object.values(rooms || {}).find((room) =>
    normalizeLookup(room.room_name) === normalizeLookup(roomName)
  ) || null;
};

const getFacultyById = (faculties, facultyId) => {
  if (facultyId && faculties?.[facultyId]) return faculties[facultyId];
  return Object.values(faculties || {}).find((faculty) => faculty.faculty_id === facultyId) || null;
};

const getSubjectName = (subjects, subjectId) => {
  const subject = subjects?.[subjectId];
  return subject?.subject_name || subject?.subject_code || subjectId || '';
};

const getScheduleRecord = (schedules, scheduleId) => {
  if (scheduleId && schedules?.[scheduleId]) return schedules[scheduleId];
  return Object.values(schedules || {}).find((schedule) => schedule.schedule_id === scheduleId) || null;
};

export const latestActiveUploadId = (uploads = {}) => {
  const latest = Object.values(uploads || {})
    .filter((upload) => (upload?.status || 'active') === 'active')
    .sort((a, b) => new Date(b.uploaded_at || b.imported_at || 0) - new Date(a.uploaded_at || a.imported_at || 0))[0];

  return latest?.schedule_upload_id || latest?.import_batch_id || '';
};

export const getReflectableSchedules = (schedules = {}, uploads = {}) => {
  const currentUploadId = latestActiveUploadId(uploads);

  return Object.values(schedules || {}).reduce((acc, schedule) => {
    if (!schedule?.schedule_id) return acc;
    if ((schedule.status || 'active') !== 'active') return acc;

    const scheduleUploadId = schedule.import_batch_id || schedule.original_import_batch_id || '';
    if (currentUploadId && scheduleUploadId !== currentUploadId) return acc;

    acc[schedule.schedule_id] = schedule;
    return acc;
  }, {});
};

const normalizeScheduleDays = (dayValue) => {
  const dayMap = {
    M: 'Monday',
    MON: 'Monday',
    MONDAY: 'Monday',
    T: 'Tuesday',
    TU: 'Tuesday',
    TUE: 'Tuesday',
    TUESDAY: 'Tuesday',
    W: 'Wednesday',
    WED: 'Wednesday',
    WEDNESDAY: 'Wednesday',
    TH: 'Thursday',
    THU: 'Thursday',
    THUR: 'Thursday',
    THURSDAY: 'Thursday',
    F: 'Friday',
    FRI: 'Friday',
    FRIDAY: 'Friday',
    S: 'Saturday',
    SA: 'Saturday',
    SAT: 'Saturday',
    SATURDAY: 'Saturday',
    SU: 'Sunday',
    SUN: 'Sunday',
    SUNDAY: 'Sunday',
  };
  const raw = String(dayValue || '').trim();
  if (!raw) return [];

  const compact = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (compact === 'TTH' || compact === 'TUTH' || compact === 'TUESTHURS') return ['Tuesday', 'Thursday'];
  if (compact === 'MWF') return ['Monday', 'Wednesday', 'Friday'];
  if (compact === 'MW') return ['Monday', 'Wednesday'];

  return raw
    .replace(/\band\b/gi, ',')
    .split(/[,/&+-]+|\s{2,}/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .map((part) => dayMap[part] || dayMap[part.slice(0, 3)] || part)
    .filter(Boolean);
};

const parseScheduleTime = (value) => {
  const cleaned = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d)(AM|PM)$/i, '$1 $2');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] || '0', 10);
  const meridiem = match[3];
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const isNowInSchedule = (schedule, now = new Date()) => {
  const today = now.toLocaleDateString('en-US', { weekday: 'long' });
  if (!normalizeScheduleDays(schedule?.day).includes(today)) return false;

  const start = parseScheduleTime(schedule?.start_time);
  const end = parseScheduleTime(schedule?.end_time);
  if (start === null || end === null) return false;

  const current = (now.getHours() * 60) + now.getMinutes();
  return end < start
    ? current >= start || current <= end
    : current >= start && current <= end;
};

const getCurrentSchedule = (schedules, facultyId) => {
  if (!facultyId) return null;
  return Object.values(schedules || {})
    .filter((schedule) => schedule?.faculty_id === facultyId && isNowInSchedule(schedule))
    .sort((a, b) => parseScheduleTime(a.start_time) - parseScheduleTime(b.start_time))[0] || null;
};

const getActiveSession = (sessions, facultyId) => {
  return Object.values(sessions || {})
    .filter((session) => session?.faculty_id === facultyId && session?.session_status !== 'Logged-Out')
    .sort((a, b) => new Date(b.login_time || 0) - new Date(a.login_time || 0))[0] || null;
};

const getStatusLabel = (status) => {
  if (status === 'In-Class') return 'In Class';
  if (status === 'Available') return 'In Room';
  return 'Offline';
};

const getStatusTone = (status) => {
  if (status === 'In-Class') return 'blue';
  if (status === 'Available') return 'green';
  return 'slate';
};

const buildFacultyLocation = ({ faculty, status, activeSession, rooms, subjects, schedules }) => {
  const facultyId = faculty?.faculty_id || status?.faculty_id || activeSession?.faculty_id || '';
  const storedSchedule = getScheduleRecord(schedules, status?.schedule_id || activeSession?.schedule_id);
  const liveSchedule = activeSession ? getCurrentSchedule(schedules, facultyId) : null;
  const schedule = liveSchedule || storedSchedule;
  const roomId = status?.current_room_id || activeSession?.room_id || schedule?.room_id || '';
  const room = getRoomRecord(rooms, roomId, schedule?.room_name);
  const roomName = room?.room_name || schedule?.room_name || roomId || 'Not in room';
  const subjectId = liveSchedule?.subject_id || status?.current_subject_id || activeSession?.subject_id || schedule?.subject_id || '';
  const storedStatus = status?.current_status || (activeSession ? activeSession.session_status : 'Offline');
  const currentStatus = activeSession ? (schedule?.subject_id ? 'In-Class' : 'Available') : storedStatus;
  const hasClass = currentStatus === 'In-Class' && subjectId;

  return {
    id: facultyId,
    name: facultyDisplayName(faculty),
    roomId,
    room: currentStatus === 'Offline' ? 'Not in room' : roomName,
    floor: currentStatus === 'Offline' ? 'Not Available' : (room?.floor || getFloorFromRoomName(roomName)),
    status: currentStatus,
    statusLabel: getStatusLabel(currentStatus),
    statusTone: getStatusTone(currentStatus),
    loginTime: status?.last_login_time || activeSession?.login_time || '',
    logoutTime: status?.last_logout_time || activeSession?.logout_time || '',
    updatedDate: status?.updated_date || '',
    department: faculty?.department || 'Not Available',
    subject: hasClass ? getSubjectName(subjects, subjectId) : (currentStatus === 'Available' ? 'Occupying room, no active class' : 'No active class'),
    subjectId,
    scheduleId: schedule?.schedule_id || status?.schedule_id || activeSession?.schedule_id || '',
    startTime: hasClass ? (schedule?.start_time || '') : '',
    endTime: hasClass ? (schedule?.end_time || '') : '',
    section: hasClass ? (schedule?.section || '') : '',
    semester: hasClass ? (schedule?.term || schedule?.semester || '') : '',
    term: hasClass ? (schedule?.term || schedule?.semester || '') : '',
    schoolYear: hasClass ? (schedule?.school_year || '') : '',
    isActive: currentStatus !== 'Offline',
    hasClass,
  };
};

export const buildTrackerData = (data = {}) => {
  const faculties = data.faculties || {};
  const statuses = data.faculty_status || {};
  const sessions = data.faculty_login_sessions || {};
  const rooms = data.rooms || {};
  const subjects = data.subjects || {};
  const schedules = getReflectableSchedules(data.schedules || {}, data.schedule_uploads || {});

  const statusByFaculty = Object.values(statuses).reduce((acc, status) => {
    if (status?.faculty_id) acc[status.faculty_id] = status;
    return acc;
  }, {});

  const facultyIds = new Set([
    ...Object.values(faculties).map((faculty) => faculty?.faculty_id).filter(Boolean),
    ...Object.values(statuses).map((status) => status?.faculty_id).filter(Boolean),
    ...Object.values(sessions).map((session) => session?.faculty_id).filter(Boolean),
  ]);

  const facultyLocations = [...facultyIds]
    .map((facultyId) => buildFacultyLocation({
      faculty: getFacultyById(faculties, facultyId) || { faculty_id: facultyId },
      status: statusByFaculty[facultyId],
      activeSession: getActiveSession(sessions, facultyId),
      rooms,
      subjects,
      schedules,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const roomLocations = Object.values(rooms)
    .filter(Boolean)
    .map((room) => {
      const occupants = facultyLocations.filter((faculty) =>
        faculty.isActive && (
          faculty.roomId === room.room_id ||
          normalizeLookup(faculty.room) === normalizeLookup(room.room_name)
        )
      );

      return {
        id: room.room_id,
        room: room.room_name || room.room_id,
        building: room.building || 'Not Available',
        floor: room.floor || getFloorFromRoomName(room.room_name),
        roomStatus: room.room_status || '',
        status: occupants.length ? 'Occupied' : (room.room_status || 'Available'),
        occupants,
      };
    })
    .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));

  return { facultyLocations, roomLocations };
};
