import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdApps, MdPeople, MdSchedule, MdLogout, MdCloudUpload, MdLocationOn, MdAccessTime, MdEventBusy, MdClass, MdEventNote, MdCheck, MdDeleteSweep } from 'react-icons/md';
import { FaBars, FaChevronDown, FaEye, FaUserCircle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { ref, set, get, push, update, onValue } from 'firebase/database';
import { database } from '../../firebase';
import NotificationBell from '../../components/NotificationBell';
import logo from '../../assets/sti_logo.png';
import {
  changeCurrentUserPassword,
  openThemeSettings,
  openUserProfile,
  signOutCurrentUser,
} from '../../utils/profileActions';

let debugLogs = '';

const sanitizeId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '') || `id_${Date.now()}`;

const normalizeLookup = (value) => String(value || '').trim().toLowerCase();

const buildSubjectCode = (subjectName) => {
  const words = String(subjectName || '').match(/[A-Za-z0-9]+/g) || [];
  const prefix = words.slice(0, 3).map((word) => word.slice(0, 3).toUpperCase()).join('');
  return prefix || 'SUBJ';
};

const facultyDisplayName = (faculty) => [
  faculty?.first_name,
  faculty?.middle_name,
  faculty?.last_name,
].filter(Boolean).join(' ').trim();

const normalizeFacultyId = (value) => String(value || '').trim().toUpperCase();

const normalizePersonName = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b(mr|mrs|ms|dr|prof|engr)\.?\b/g, ' ')
  .replace(/[^a-z,\s-]/g, ' ')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const nameTokens = (value) => normalizePersonName(value)
  .replace(/,/g, ' ')
  .split(' ')
  .filter((token) => token.length > 1);

const buildFacultySearchEntries = (faculty) => {
  const firstName = faculty?.first_name || '';
  const middleName = faculty?.middle_name || '';
  const lastName = faculty?.last_name || '';
  const fullName = facultyDisplayName(faculty);
  return [
    fullName,
    [lastName, firstName, middleName].filter(Boolean).join(' '),
    [lastName, firstName].filter(Boolean).join(' '),
    [lastName, ', ', firstName].filter(Boolean).join(''),
    [firstName, lastName].filter(Boolean).join(' '),
    lastName,
    faculty?.email,
    faculty?.faculty_id,
  ].filter(Boolean);
};

const facultyNameScore = (inputName, faculty) => {
  const input = normalizePersonName(inputName);
  if (!input) return 0;

  const entries = buildFacultySearchEntries(faculty).map(normalizePersonName);
  if (entries.some((entry) => entry && entry === input)) return 100;
  if (entries.some((entry) => entry && (entry.includes(input) || input.includes(entry)))) return 85;

  const inputTokens = new Set(nameTokens(inputName));
  if (!inputTokens.size) return 0;
  const facultyTokens = new Set(nameTokens(facultyDisplayName(faculty)));
  const matches = [...inputTokens].filter((token) => facultyTokens.has(token));
  const lastName = normalizePersonName(faculty?.last_name);
  const hasLastName = lastName && inputTokens.has(lastName);

  if (hasLastName && matches.length >= 2) return 80;
  if (hasLastName) return 65;
  if (matches.length >= 2) return 60;
  if (matches.length === 1) return 35;
  return 0;
};

const findFacultyByName = (inputName, faculties) => {
  const matches = Object.values(faculties || {})
    .map((faculty) => ({ faculty, score: facultyNameScore(inputName, faculty) }))
    .filter((match) => match.score >= 60)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.faculty || null;
};

const INITIAL_SCHEDULE_UPLOAD_CONTEXT = {
  schoolYear: '',
  term: '',
};

const ARCHIVE_RETENTION_DAYS = 30;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const latestActiveUploadId = (uploads = {}) => {
  const latest = Object.values(uploads)
    .filter((upload) => (upload?.status || 'active') === 'active')
    .sort((a, b) => new Date(b.uploaded_at || b.imported_at || 0) - new Date(a.uploaded_at || a.imported_at || 0))[0];
  return latest?.schedule_upload_id || latest?.import_batch_id || '';
};

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
  const sheets = workbook.SheetNames.map((sheetName) => {
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

function FacultySchedules() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('moduleSidebarOpen') === 'true');
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  });
  const [schedules, setSchedules] = useState([]);
  const [facultyDirectory, setFacultyDirectory] = useState({});
  const [scheduleUploadRecords, setScheduleUploadRecords] = useState({});

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (
      currentUser.userType !== 'admin' &&
      !currentUser.roleIds?.includes('admin') &&
      !currentUser.permissions?.view_schedules &&
      !currentUser.permissions?.upload_schedules &&
      !currentUser.permissions?.access_faculty_module
    ) {
      navigate('/home');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const facultiesRef = ref(database, 'faculties');
    const unsubscribe = onValue(facultiesRef, (snapshot) => {
      setFacultyDirectory(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const uploadsRef = ref(database, 'schedule_uploads');
    const unsubscribe = onValue(uploadsRef, (snapshot) => {
      setScheduleUploadRecords(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (currentUser) {
      // Load from cache first for immediate display
      const cached = localStorage.getItem(`schedules_${currentUser.uid}`);
      if (cached) {
        setSchedules(JSON.parse(cached));
      }

      // Set up realtime listener for global last updated
      const lastUpdateRef = ref(database, 'lastScheduleUpdate');
      const unsubscribeLast = onValue(lastUpdateRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setLastUpdatedBy(data.name);
        }
      });

      const schedulesRef = ref(database, 'schedules');
      const unsubscribe = onValue(schedulesRef, async (snapshot) => {
        if (!snapshot.exists()) {
          setSchedules([]);
          localStorage.setItem(`schedules_${currentUser.uid}`, JSON.stringify([]));
          return;
        }

        const [subjectsSnapshot, roomsSnapshot, facultiesSnapshot, scheduleUploadsSnapshot] = await Promise.all([
          get(ref(database, 'subjects')),
          get(ref(database, 'rooms')),
          get(ref(database, 'faculties')),
          get(ref(database, 'schedule_uploads')),
        ]);

        const subjects = subjectsSnapshot.val() || {};
        const rooms = roomsSnapshot.val() || {};
        const faculties = facultiesSnapshot.val() || {};
        const scheduleUploads = scheduleUploadsSnapshot.val() || {};
        const currentActiveUploadId = latestActiveUploadId(scheduleUploads);
        setFacultyDirectory(faculties);
        const facultyById = Object.values(faculties).reduce((acc, faculty) => {
          acc[faculty.faculty_id] = faculty;
          return acc;
        }, {});

        const allSchedules = Object.values(snapshot.val())
          .filter(Boolean)
          .filter((schedule) => (schedule.status || 'active') === 'active')
          .filter((schedule) => !currentActiveUploadId || schedule.import_batch_id === currentActiveUploadId || schedule.original_import_batch_id === currentActiveUploadId)
          .map((schedule) => {
            const subject = subjects[schedule.subject_id] || {};
            const room = rooms[schedule.room_id] || {};
            const assignedFaculty = facultyById[schedule.faculty_id] || {};
            const instructorName = facultyDisplayName(assignedFaculty) || schedule.instructor_name || schedule.faculty_id || 'Unassigned';
            return {
              scheduleId: schedule.schedule_id,
              facultyId: schedule.faculty_id,
              subjectId: schedule.subject_id,
              roomId: schedule.room_id,
              section: schedule.section || 'TBD',
              subject: subject.subject_name || schedule.subject_name || schedule.subject_id || 'TBD',
              room: room.room_name || schedule.room_name || schedule.room_id || 'TBD',
              time: `${schedule.start_time || 'TBD'} - ${schedule.end_time || 'TBD'}`,
              startTime: schedule.start_time || 'TBD',
              endTime: schedule.end_time || 'TBD',
              day: schedule.day || 'TBD',
              instructor: instructorName,
              assignedFacultyName: instructorName,
              term: schedule.term || schedule.semester || '',
              schoolYear: schedule.school_year || '',
              status: schedule.status || 'active',
              importBatchId: schedule.import_batch_id || '',
              originalImportBatchId: schedule.original_import_batch_id || schedule.import_batch_id || '',
              importedAt: schedule.imported_at || '',
              importedBy: schedule.imported_by || '',
            };
          });

        setSchedules(allSchedules);
        localStorage.setItem(`schedules_${currentUser.uid}`, JSON.stringify(allSchedules));
      });

      // Cleanup listeners on unmount
      return () => {
        unsubscribe();
        unsubscribeLast();
      };
    }
  }, [currentUser]);
  const [importError, setImportError] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showViewSchedules, setShowViewSchedules] = useState(false);
  const [showArchiveViewer, setShowArchiveViewer] = useState(false);
  const [archiveViewerRows, setArchiveViewerRows] = useState([]);
  const [archiveViewerBatchId, setArchiveViewerBatchId] = useState('');
  const [archiveViewerLoading, setArchiveViewerLoading] = useState(false);
  const [showSheetSelection, setShowSheetSelection] = useState(false);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [workbookData, setWorkbookData] = useState(null);
  const [scheduleWorkbookPreview, setScheduleWorkbookPreview] = useState(null);
  const [selectedSchedulePreviewSheet, setSelectedSchedulePreviewSheet] = useState('');
  const [showScheduleDocumentPreview, setShowScheduleDocumentPreview] = useState(false);
  const [scheduleDocumentPreviewLoading, setScheduleDocumentPreviewLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedDays, setSelectedDays] = useState('All');
  const [selectedDisplayType, setSelectedDisplayType] = useState('All');
  const [selectedInstructor, setSelectedInstructor] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [lastUpdatedBy, setLastUpdatedBy] = useState('');
  const [scheduleUploadContext, setScheduleUploadContext] = useState(INITIAL_SCHEDULE_UPLOAD_CONTEXT);
  const [selectedScheduleUploadId, setSelectedScheduleUploadId] = useState('');

  const currentFaculty = useMemo(() => {
    // Since we don't have facultyLocations here, we can't compute it
    // For consistency, perhaps just show "Logged In"
    return null;
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Memoized filtered preview data
  const filteredPreviewData = useMemo(() => {
    return previewData.filter(schedule => {
      const matchesFilters =
        (selectedInstructor === 'All' || schedule.instructor === selectedInstructor) &&
        (selectedSubject === 'All' || schedule.subject === selectedSubject) &&
        (selectedSection === 'All' || schedule.section === selectedSection);

      const matchesSearch = debouncedSearchTerm === '' ||
        Object.values(schedule).some(value =>
          value && value.toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );

      return matchesFilters && matchesSearch;
    });
  }, [previewData, selectedInstructor, selectedSubject, selectedSection, debouncedSearchTerm]);

  // Memoized filtered view data
  const filteredViewData = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesFilters =
        (selectedInstructor === 'All' || schedule.instructor === selectedInstructor) &&
        (selectedSubject === 'All' || schedule.subject === selectedSubject) &&
        (selectedSection === 'All' || schedule.section === selectedSection) &&
        (selectedDays === 'All' || schedule.day === selectedDays);

      const matchesSearch = debouncedSearchTerm === '' ||
        Object.values(schedule).some(value =>
          value && value.toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );

      return matchesFilters && matchesSearch;
    });
  }, [schedules, selectedInstructor, selectedSubject, selectedSection, selectedDays, debouncedSearchTerm]);

  // Function to get start time for sorting
  const getStartTime = (timeStr) => {
    if (!timeStr) return '23:59';
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!match) return '23:59';
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[4].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const handleLogout = () => {
    signOutCurrentUser(navigate);
  };
  const setSidebarPreference = (open) => {
    localStorage.setItem('moduleSidebarOpen', String(open));
    setIsSidebarOpen(open);
  };

  // Function to parse time
  const parseTime = (timeStr) => {
    if (!timeStr) return { start: '', end: '' };
    const parts = timeStr.split(' - ');
    const result = { start: parts[0] || '', end: parts[1] || '' };
    return result;
  };

  // Function to convert Excel serial time to readable format
  const excelTimeToString = (serial) => {
    const totalSeconds = Math.round(serial * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const cellToString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const isExcelTimeValue = (value) => {
    if (value === '' || value === null || value === undefined) return false;
    const numericValue = typeof value === 'number' ? value : Number(String(value).trim());
    return !Number.isNaN(numericValue) && numericValue >= 0 && numericValue < 1;
  };

  const normalizeTimeText = (value) => {
    if (isExcelTimeValue(value)) {
      return excelTimeToString(typeof value === 'number' ? value : Number(String(value).trim()));
    }

    let text = cellToString(value)
      .replace(/1899[-/]12[-/]30/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return '';

    text = text.replace(/\b([AP])\.?\s*M\.?\b/gi, (_, period) => `${period.toUpperCase()}M`);

    const compactMatch = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*([AP]M)?$/i);
    if (compactMatch && compactMatch[3]) {
      const hours = Number(compactMatch[1]);
      const minutes = compactMatch[2] || '00';
      const period = compactMatch[3].toUpperCase();
      return `${hours}:${minutes.padStart(2, '0')} ${period}`;
    }

    const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
    if (timeMatch) {
      let hours = Number(timeMatch[1]);
      const minutes = timeMatch[2];
      let period = timeMatch[3]?.toUpperCase();

      if (!period && hours > 12) {
        period = 'PM';
        hours -= 12;
      } else if (!period) {
        return `${hours}:${minutes}`;
      }

      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${period}`;
    }

    return text.replace(/(\d)([AP]M)\b/i, '$1 $2').replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase());
  };

  const isTimeLike = (value) => {
    if (isExcelTimeValue(value)) return true;
    const text = cellToString(value).replace(/\s+/g, '').toUpperCase();
    if (!text) return false;
    if (text.includes('/') || text.includes('LAB') || text.includes('ROOM') || text.includes('COURT')) return false;
    return /^(\d{1,2})(:?(\d{2}))?([AP]\.?M\.?)?$/.test(text) && (text.includes(':') || /[AP]\.?M\.?$/.test(text));
  };

  const splitTimeRange = (value) => {
    const text = cellToString(value).replace(/[–—]/g, '-').trim();
    const parts = text.split(/\s*(?:-|to)\s*/i).filter(Boolean);
    return parts.length >= 2 ? [parts[0], parts[1]] : null;
  };

  // Function to add hours to a time string
  const addHoursToTime = (timeStr, hoursToAdd) => {
    const normalizedTime = normalizeTimeText(timeStr);
    const match = normalizedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return timeStr;

    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[4] ? match[4].toUpperCase() : null;

    // Convert to 24-hour format if period is specified
    if (period) {
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    } else {
      // Assume 24-hour format
    }

    // Add hours
    hours += hoursToAdd;

    // Handle overflow (wrap around 24 hours)
    if (hours >= 24) hours -= 24;

    // Convert back to 12-hour format
    const newPeriod = hours >= 12 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;

    return `${displayHours}:${minutes} ${newPeriod}`;
  };

  // Function to format single time
  const formatSingleTime = (timeStr) => {
    debugLogs += 'LOG: formatSingleTime input: ' + timeStr + '\n';
    const normalizedInput = normalizeTimeText(timeStr);
    const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;
    const match = normalizedInput.match(timeRegex);
    if (match) {
      const [, hour, minute, , period] = match;
      let hourNum = parseInt(hour);
      let periodUpper = period ? period.toUpperCase() : null;
      let displayHours;

      if (periodUpper) {
        // 12-hour format with AM/PM
        displayHours = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
      } else {
        // 24-hour format
        if (hourNum >= 12) {
          periodUpper = 'PM';
          displayHours = hourNum === 12 ? 12 : hourNum - 12;
        } else {
          periodUpper = 'AM';
          displayHours = hourNum === 0 ? 12 : hourNum;
        }
      }

      const result = `${displayHours}:${minute.toString().padStart(2, '0')} ${periodUpper}`;
      debugLogs += 'LOG: formatSingleTime output: ' + result + '\n';
      return result;
    }

    // Otherwise, return as is with space before AM/PM
    const result = normalizedInput.replace(/(\d+)(AM|PM)/i, '$1 $2');
    debugLogs += 'LOG: formatSingleTime output (fallback): ' + result + '\n';
    return result;
  };

  // Function to format time strings properly
  const formatTime = (timeStr) => {
    const timeRegex = /^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)$/i;
    debugLogs += 'LOG: formatTime input: ' + timeStr + '\n';
    if (!timeStr) return '';

    // Handle Excel date serial numbers (like 1899-12-30)
    if (timeStr.includes('1899-12-30') || timeStr.includes('1899/12/30')) {
      return timeStr.replace(/1899[-/]12[-/]30/g, '').trim();
    }

    // Handle Excel serial time numbers (decimal numbers)
    const numValue = parseFloat(timeStr);
    if (!isNaN(numValue) && numValue >= 0 && numValue < 1) {
      return excelTimeToString(numValue);
    }

    // Clean up extra spaces
    let cleaned = timeStr.replace(/\s+/g, ' ').trim();
    debugLogs += 'LOG: formatTime cleaned: ' + cleaned + '\n';

    // If contains ' - ', split and format each part
    if (cleaned.includes(' - ')) {
      const [start, end] = cleaned.split(' - ');
      debugLogs += 'LOG: formatTime split start: ' + start + ' end: ' + end + '\n';
      const formattedStart = formatSingleTime(start.trim());
      const formattedEnd = formatSingleTime(end.trim());
      const result = `${formattedStart} - ${formattedEnd}`;
      debugLogs += 'LOG: formatTime output: ' + result + '\n';
      return result;
    } else if (cleaned.includes('-') && timeRegex.test(cleaned)) {
      const [start, end] = cleaned.split('-').map(s => s.trim());
      const formattedStart = formatSingleTime(start);
      const formattedEnd = formatSingleTime(end);
      const result = formattedStart + ' - ' + formattedEnd;
      debugLogs += 'LOG: formatTime output (dash): ' + result + '\n';
      return result;
    } else {
      const result = formatSingleTime(cleaned);
      debugLogs += 'LOG: formatTime output (single): ' + result + '\n';
      return result;
    }
  };

  // Function to expand day ranges and normalize to full day names
  const expandDayRange = (day) => {
    const dayMap = {
      'M': 'Monday',
      'T': 'Tuesday',
      'W': 'Wednesday',
      'TH': 'Thursday',
      'F': 'Friday',
      'S': 'Saturday',
      'SU': 'Sunday',
      'TUE': 'Tuesday',
      'WED': 'Wednesday',
      'THU': 'Thursday',
      'FRI': 'Friday',
      'SAT': 'Saturday',
      'SUN': 'Sunday'
    };

    const normalized = day.toUpperCase().trim();

    // Handle strings with separators (and, comma)
    if (normalized.includes(' AND ') || normalized.includes(',')) {
      const separators = /\s*AND\s*|,/i;
      const parts = normalized.split(separators).map(p => p.trim()).filter(p => p);
      const expanded = [];
      parts.forEach(part => {
        if (dayMap[part]) {
          expanded.push(dayMap[part]);
        } else {
          expanded.push(part); // Keep original if not mapped
        }
      });
      return expanded.length > 0 ? expanded : [day];
    }

    // Handle common day ranges
    const rangeMap = {
      'MT': ['Monday', 'Tuesday'],
      'TF': ['Tuesday', 'Friday'],
      'MW': ['Monday', 'Wednesday'],
      'TTH': ['Tuesday', 'Thursday'],
      'WF': ['Wednesday', 'Friday'],
      'MTH': ['Monday', 'Thursday'],
      'MTW': ['Monday', 'Tuesday', 'Wednesday'],
      'TWF': ['Tuesday', 'Wednesday', 'Friday'],
      'MWTH': ['Monday', 'Wednesday', 'Thursday'],
       'MTF': ['Monday', 'Tuesday', 'Friday'],
       'MWF': ['Monday', 'Wednesday', 'Friday'],
       'TTHF': ['Tuesday', 'Thursday', 'Friday'],
       'MTTH': ['Monday', 'Tuesday', 'Thursday'],
       'MTWF': ['Monday', 'Tuesday', 'Wednesday', 'Friday'],
       'MTHF': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };

    if (rangeMap[normalized]) {
      return rangeMap[normalized];
    }

    // Single day
    if (dayMap[normalized]) {
      return [dayMap[normalized]];
    }

    // If no match, return as array with original
    return [day];
  };


  const handleImportClick = () => {
    if (!currentUser?.permissions?.upload_schedules) return;
    if (!scheduleUploadContext.schoolYear.trim() || !scheduleUploadContext.term.trim()) {
      setImportError('School Year and Term are required before importing schedules.');
      return;
    }
    fileInputRef.current.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    debugLogs += 'LOG: File selected: ' + file.name + '\n';

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.xlsm')) {
      setImportError('Please select an Excel file (.xlsx, .xls, or .xlsm)');
      setScheduleWorkbookPreview(null);
      setSelectedSchedulePreviewSheet('');
      setShowScheduleDocumentPreview(false);
      return;
    }

    setProcessingFile(true);
    setImportError('');
    debugLogs += 'LOG: Starting file processing\n';

    const reader = new FileReader();
    reader.onload = (e) => {
      debugLogs += 'LOG: File read successfully\n';
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
      debugLogs += 'LOG: Workbook loaded with sheets: ' + workbook.SheetNames.join(', ') + '\n';

      const workbookPreview = buildWorkbookDocumentPreview(workbook, file.name);
      setScheduleWorkbookPreview(workbookPreview);
      setSelectedSchedulePreviewSheet(workbookPreview.sheets[0]?.name || '');
      setShowScheduleDocumentPreview(false);

      // Show sheet selection if multiple sheets
      if (workbook.SheetNames.length > 1) {
        setAvailableSheets(workbook.SheetNames);
        setWorkbookData(workbook);
        setShowSheetSelection(true);
      } else {
        // Single sheet, process directly
        processSheet(workbook, workbook.SheetNames[0]);
      }
      setProcessingFile(false);
    };
    reader.onerror = () => {
      setProcessingFile(false);
      setImportError('Unable to read the selected Excel file.');
      setScheduleWorkbookPreview(null);
      setSelectedSchedulePreviewSheet('');
      setShowScheduleDocumentPreview(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const processSheet = (workbook, sheetName) => {
    debugLogs += 'LOG: Processing sheet: ' + sheetName + '\n';
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with raw option for faster processing
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
    debugLogs += 'LOG: Sheet has ' + jsonData.length + ' rows\n';

    if (jsonData.length < 2) {
      setImportError('The selected sheet appears to be empty or has no data rows');
      return;
    }

    // Find the header row (the row that contains 'course description', 'subject description', or similar)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) { // Check first 10 rows
      const row = jsonData[i];
      if (row && row.some(cell => {
        const cellStr = (cell || '').toString().toLowerCase();
        return cellStr.includes('course description') || cellStr.includes('subject description') || cellStr.includes('subject');
      })) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      setImportError('Could not find header row containing course description');
      return;
    }

    const headers = jsonData[headerRowIndex].map(h => (h || '').toString().trim().toLowerCase());

    // Map possible header variations to our expected keys
    const headerMappings = {
      section: ['section', 'class', 'group'],
      course_description: ['course description', 'course_description', 'subject', 'description', 'course desc', 'subject description', 'subject_description'],
      room: ['room', 'location', 'classroom'],
      time: ['time', 'schedule', 'period', 'start time', 'from'],
      day: ['day', 'weekday', 'date'],
      instructor: ['instructor', 'faculty', 'teacher', 'professor'],
      faculty_id: ['faculty id', 'faculty_id', 'faculty code', 'faculty_code', 'instructor id', 'instructor_id'],
      end_time: ['end time', 'end_time', 'end', 'finish time', 'to time', 'to'],
      semester: ['semester', 'term'],
      school_year: ['school year', 'school_year', 'sy', 'academic year', 'academic_year']
    };

    const headerIndex = {};
    const requiredHeaders = ['section', 'course_description', 'room', 'time', 'day', 'instructor'];
    const optionalHeaders = ['faculty_id', 'end_time', 'semester', 'school_year'];

    const allHeaders = [...requiredHeaders, ...optionalHeaders];

    allHeaders.forEach(expectedHeader => {
      let foundIndex = -1;
      const possibleHeaders = headerMappings[expectedHeader];

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (possibleHeaders.includes(header)) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1 && requiredHeaders.includes(expectedHeader)) {
        setImportError(`Missing required column: ${expectedHeader} (acceptable variations: ${possibleHeaders.join(', ')})`);
        return;
      }
      headerIndex[expectedHeader] = foundIndex;
    });

    const importedSchedules = [];
    let currentSection = '';

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row.length >= requiredHeaders.length) {
        const section = cellToString(row[headerIndex.section]);
        const courseDesc = cellToString(row[headerIndex.course_description]);
        let time = cellToString(row[headerIndex.time]);
        const day = cellToString(row[headerIndex.day]);
        const instructor = cellToString(row[headerIndex.instructor]);
        const facultyId = headerIndex.faculty_id !== -1 ? normalizeFacultyId(cellToString(row[headerIndex.faculty_id])) : '';
        const semester = headerIndex.semester !== -1 ? cellToString(row[headerIndex.semester]) : '';
        const schoolYear = headerIndex.school_year !== -1 ? cellToString(row[headerIndex.school_year]) : '';

        // Update current section if this row has a section
        if (section) {
          currentSection = section;
        }

        // Handle room - sometimes it's in the next column if time spans multiple cells
        let room = cellToString(row[headerIndex.room]);

        // If room is empty but there's data in adjacent cells, try to find the room
        if (!room && headerIndex.room + 1 < row.length) {
          room = cellToString(row[headerIndex.room + 1]);
        }
        if (!room && headerIndex.room + 2 < row.length) {
          room = cellToString(row[headerIndex.room + 2]);
        }

        // Handle time columns - look for end time in time column, end_time column, or adjacent
        let startTime = '';
        let endTime = '';
        debugLogs += 'LOG: Row ' + i + ' looking for end time starting from time column\n';

        // Get time from time column
        const timeCell = cellToString(row[headerIndex.time]);
        debugLogs += 'LOG: Row ' + i + ' time column: ' + timeCell + '\n';

        // Check if there's a separate end_time column
        if (headerIndex.end_time !== -1) {
          const endTimeCell = cellToString(row[headerIndex.end_time]);
          debugLogs += 'LOG: Row ' + i + ' end_time column: ' + endTimeCell + '\n';
          if (endTimeCell) {
            startTime = timeCell;
            endTime = endTimeCell;
            debugLogs += 'LOG: Row ' + i + ' using separate columns: start=' + startTime + ' end=' + endTime + '\n';
          }
        }

        // If no separate end_time column or it's empty, check for range in time column
        const timeRange = splitTimeRange(timeCell);
        if (!endTime && timeRange) {
          const parts = timeRange;
          startTime = parts[0].trim();
          endTime = parts[1].trim();
          debugLogs += 'LOG: Row ' + i + ' parsed range from time column: start=' + startTime + ' end=' + endTime + '\n';
        } else if (!endTime) {
          // Look for end time in adjacent columns first
          let foundEndInAdjacent = false;
          for (let j = 1; j <= 4; j++) {
            if (headerIndex.time + j < row.length) {
              const candidateCell = cellToString(row[headerIndex.time + j]);
              debugLogs += 'LOG: Row ' + i + ' checking adjacent j=' + j + ' candidate: ' + candidateCell + '\n';
              if (isTimeLike(row[headerIndex.time + j])) {
                endTime = candidateCell;
                debugLogs += 'LOG: Row ' + i + ' found end time in adjacent: ' + candidateCell + '\n';
                foundEndInAdjacent = true;
                break;
              } else {
                debugLogs += 'LOG: Row ' + i + ' adjacent candidate does not match time pattern\n';
              }
            }
          }

          if (foundEndInAdjacent) {
            // Use time column as start time
            if (isTimeLike(row[headerIndex.time])) {
              startTime = timeCell;
              debugLogs += 'LOG: Row ' + i + ' start time from time column: ' + startTime + '\n';
            }
          } else {
            // No end time in adjacent, treat time column as start time
            if (isTimeLike(row[headerIndex.time])) {
              startTime = timeCell;
              debugLogs += 'LOG: Row ' + i + ' start time from time column (no adjacent): ' + startTime + '\n';
            } else {
              debugLogs += 'LOG: Row ' + i + ' time column not valid time\n';
            }
          }
        }

        // If found a time, parse it to extract end time
        if (endTime) {
          const endRange = splitTimeRange(endTime);
          if (endRange) {
            debugLogs += 'LOG: Row ' + i + ' time has " - ", taking end part\n';
            endTime = endRange[1].trim();
          } else {
            debugLogs += 'LOG: Row ' + i + ' time is single, using as endTime\n';
          }
        } else if (startTime) {
          // If only start time, assume 2-hour duration
          endTime = addHoursToTime(startTime, 2);
          debugLogs += 'LOG: Row ' + i + ' only start time found, assumed 2 hours: end=' + endTime + '\n';
        } else {
          debugLogs += 'LOG: Row ' + i + ' no time found, skipping\n';
          continue;
        }

        startTime = normalizeTimeText(startTime);
        endTime = normalizeTimeText(endTime);

        // Combine start and end times
        if (startTime && endTime) {
          time = startTime + ' - ' + endTime;
        } else {
          time = 'TBD';
        }
        debugLogs += 'LOG: Row ' + i + ' startTime: ' + startTime + ' endTime: ' + endTime + ' combined time: ' + time + '\n';

        // Skip empty rows
        if (courseDesc && day) {
          const expandedDays = expandDayRange(day);
          const formattedTime = formatTime(time);
          const { start: formattedStart, end: formattedEnd } = parseTime(formattedTime);
          expandedDays.forEach(expandedDay => {
            const schedule = {
              section: currentSection || 'TBD',
              subject: courseDesc,
              room: room || 'TBD',
              time: formattedTime || 'TBD',
              startTime: formattedStart || 'TBD',
              endTime: formattedEnd || 'TBD',
              day: expandedDay,
              instructor: instructor || 'TBD',
              facultyId,
              term: semester || scheduleUploadContext.term.trim() || 'TBD',
              schoolYear: schoolYear || scheduleUploadContext.schoolYear.trim() || 'TBD'
            };
            debugLogs += 'LOG: Processed schedule for row ' + i + ' day ' + expandedDay + ': ' + JSON.stringify(schedule) + '\n';
            importedSchedules.push(schedule);
          });
        }
      }
    }

    if (importedSchedules.length === 0) {
      setImportError('No valid schedule data found in the selected sheet');
      return;
    }

    // Remove duplicates
    const uniqueSchedules = importedSchedules.filter((schedule, index, self) =>
      index === self.findIndex(s =>
        s.section === schedule.section &&
        s.subject === schedule.subject &&
        s.day === schedule.day &&
        s.time === schedule.time &&
        s.room === schedule.room &&
        normalizeFacultyId(s.facultyId) === normalizeFacultyId(schedule.facultyId)
      )
    );

    const facultyById = Object.values(facultyDirectory).reduce((acc, faculty) => {
      if (faculty?.faculty_id) acc[normalizeFacultyId(faculty.faculty_id)] = faculty;
      return acc;
    }, {});
    const matchedPreview = uniqueSchedules.map((schedule) => {
      const matchedFaculty = schedule.facultyId
        ? facultyById[normalizeFacultyId(schedule.facultyId)]
        : findFacultyByName(schedule.instructor, facultyDirectory);
      return {
        ...schedule,
        facultyId: schedule.facultyId || matchedFaculty?.faculty_id || '',
        assignedFacultyName: matchedFaculty ? facultyDisplayName(matchedFaculty) : '',
        facultyMatchStatus: schedule.facultyId
          ? (matchedFaculty ? 'matched_by_id' : 'unmatched_id')
          : (matchedFaculty ? 'matched_by_name' : 'unmatched_name'),
      };
    });

    // Show preview
    setPreviewData(matchedPreview);
    setShowPreview(true);
    setImportError('');
  };

  const handleSheetSelect = (sheetName) => {
    setSelectedSheet(sheetName);
    setShowSheetSelection(false);
    processSheet(workbookData, sheetName);
  };

  const confirmImport = async () => {
    if (!scheduleUploadContext.schoolYear.trim() || !scheduleUploadContext.term.trim()) {
      setImportError('School Year and Term are required before saving schedules.');
      return;
    }

    setImportLoading(true);
    setImportProgress(0);

    // Start progress animation
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const [
        facultiesSnapshot,
        roomsSnapshot,
        subjectsSnapshot,
        scheduleUploadsSnapshot,
      ] = await Promise.all([
        get(ref(database, 'faculties')),
        get(ref(database, 'rooms')),
        get(ref(database, 'subjects')),
        get(ref(database, 'schedule_uploads')),
      ]);

      const faculties = facultiesSnapshot.val() || {};
      const rooms = roomsSnapshot.val() || {};
      const subjects = subjectsSnapshot.val() || {};
      const existingScheduleUploads = scheduleUploadsSnapshot.val() || {};
      setFacultyDirectory(faculties);
      const existingSubjectByName = Object.values(subjects).reduce((acc, subject) => {
        acc[normalizeLookup(subject.subject_name)] = subject;
        acc[normalizeLookup(subject.subject_code)] = subject;
        return acc;
      }, {});
      const existingRoomByName = Object.values(rooms).reduce((acc, room) => {
        acc[normalizeLookup(room.room_name)] = room;
        acc[normalizeLookup(room.room_id)] = room;
        return acc;
      }, {});

      const updates = {};
      const uploadSchoolYear = scheduleUploadContext.schoolYear.trim();
      const uploadTerm = scheduleUploadContext.term.trim();
      const importBatchId = sanitizeId(`schedule_upload_${uploadSchoolYear}_${uploadTerm}_${currentUser.uid}_${Date.now()}`);
      const importedAt = new Date().toISOString();

      const previouslyActiveUploadIds = Object.values(existingScheduleUploads)
        .filter((upload) => (upload?.status || 'active') === 'active')
        .map((upload) => upload.schedule_upload_id || upload.import_batch_id)
        .filter(Boolean);
      const newUploadStatus = previouslyActiveUploadIds.length ? 'inactive' : 'active';
      const facultyById = Object.values(faculties).reduce((acc, faculty) => {
        if (faculty?.faculty_id) acc[normalizeFacultyId(faculty.faculty_id)] = faculty;
        return acc;
      }, {});

      previewData.forEach((schedule) => {
        const providedFacultyId = normalizeFacultyId(schedule.facultyId);
        const matchedFaculty = providedFacultyId
          ? facultyById[providedFacultyId]
          : findFacultyByName(schedule.instructor, faculties);
        const assignedFacultyId = matchedFaculty?.faculty_id || providedFacultyId || '';
        const subjectName = schedule.subject || 'TBD';
        const subjectRecord = existingSubjectByName[normalizeLookup(subjectName)];
        const subjectId = subjectRecord?.subject_id || sanitizeId(`subj_${subjectName}`);
        const subjectCode = subjectRecord?.subject_code || buildSubjectCode(subjectName);

        if (!subjectRecord) {
          updates[`subjects/${subjectId}`] = {
            subject_id: subjectId,
            subject_code: subjectCode,
            subject_name: subjectName,
            import_batch_id: importBatchId,
            school_year: uploadSchoolYear,
            term: uploadTerm,
            imported_at: importedAt,
            imported_by: currentUser.uid,
          };
          existingSubjectByName[normalizeLookup(subjectName)] = updates[`subjects/${subjectId}`];
          existingSubjectByName[normalizeLookup(subjectCode)] = updates[`subjects/${subjectId}`];
        }

        const roomName = schedule.room || 'TBD';
        const roomRecord = existingRoomByName[normalizeLookup(roomName)];
        const roomId = roomRecord?.room_id || '';

        const scheduleId = sanitizeId([
          'sched',
          assignedFacultyId || 'unassigned',
          subjectId,
          roomId || roomName,
          schedule.day,
          schedule.startTime,
          schedule.endTime,
          schedule.section,
          schedule.term,
          schedule.schoolYear,
        ].join('_'));

        updates[`schedules/${scheduleId}`] = {
          schedule_id: scheduleId,
          faculty_id: assignedFacultyId,
          instructor_name: schedule.instructor || '',
          subject_id: subjectId,
          room_id: roomId,
          room_name: roomName,
          day: schedule.day || 'TBD',
          start_time: schedule.startTime || 'TBD',
          end_time: schedule.endTime || 'TBD',
          section: schedule.section || 'TBD',
          term: schedule.term || uploadTerm || 'TBD',
          school_year: schedule.schoolYear || uploadSchoolYear || 'TBD',
          status: newUploadStatus,
          import_batch_id: importBatchId,
          imported_at: importedAt,
          imported_by: currentUser.uid,
          imported_by_name: currentUser.name || currentUser.username || 'Uploader',
        };
        updates[`schedule_upload_index/${importBatchId}/${scheduleId}`] = true;
      });

      updates[`schedule_uploads/${importBatchId}`] = {
        schedule_upload_id: importBatchId,
        import_batch_id: importBatchId,
        school_year: uploadSchoolYear,
        term: uploadTerm,
        uploaded_at: importedAt,
        uploaded_by: currentUser.uid,
        uploaded_by_name: currentUser.name || currentUser.username || 'Uploader',
        schedule_count: previewData.length,
        status: newUploadStatus,
      };

      await update(ref(database), updates);

      // Update global last updated
      await update(ref(database, 'lastScheduleUpdate'), {
        name: currentUser.name,
        time: importedAt,
        import_batch_id: importBatchId,
      });

      // Stop animation and set to complete
      clearInterval(progressInterval);
      setImportProgress(100);

      // Show 100% for a moment before closing
      await new Promise(resolve => setTimeout(resolve, 800));

      setShowPreview(false);
      setPreviewData([]);
      setScheduleUploadContext(INITIAL_SCHEDULE_UPLOAD_CONTEXT);
      // Reset file input to allow multiple imports
      fileInputRef.current.value = '';
      setImportError('');
      Swal.fire({
        title: 'Success!',
        text: newUploadStatus === 'active'
          ? `Successfully imported ${previewData.length} schedule entries and set them as active.`
          : `Successfully imported ${previewData.length} schedule entries as inactive. Review first, then click Set Active when ready.`,
        icon: 'success',
        confirmButtonText: 'OK'
      });
    } catch (error) {
      console.error('Error saving schedules:', error);
      clearInterval(progressInterval);
      setImportProgress(0);
      Swal.fire({
        title: 'Error!',
        text: 'Failed to save schedules. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      setImportLoading(false);
    }
  };

  const cancelImport = () => {
    setShowPreview(false);
    setPreviewData([]);
    // Reset file input to allow re-import
    fileInputRef.current.value = '';
    setImportError('');
  };

  const selectDay = (day) => {
    console.log('Selecting day:', day);
    setSelectedDays(day);
  };

  const startEditingPreview = (index) => {
    const data = showPreview ? previewData : schedules;
    const schedule = data[index];
    const { start: startTime, end: endTime } = parseTime(schedule.time);
    setEditingRow(index);
    setEditForm({ ...schedule, startTime, endTime });
  };

  const startEditingSchedule = (schedule) => {
    const { start: startTime, end: endTime } = parseTime(schedule.time);
    const index = schedules.findIndex((item) => item.scheduleId === schedule.scheduleId);
    setEditingRow(index);
    setEditForm({ ...schedule, startTime, endTime });
  };

  const cancelEditingPreview = () => {
    setEditingRow(null);
    setEditForm({});
  };

  const updatePreviewFaculty = (index, facultyId) => {
    const faculty = facultyDirectory[facultyId] || Object.values(facultyDirectory).find((item) => item.faculty_id === facultyId);
    const assignedFacultyName = faculty ? facultyDisplayName(faculty) : '';
    setPreviewData((current) => current.map((schedule, scheduleIndex) => (
      scheduleIndex === index
        ? {
          ...schedule,
          facultyId,
          assignedFacultyName,
          instructor: assignedFacultyName || schedule.instructor,
          facultyMatchStatus: facultyId ? 'manual' : 'unmatched_name',
        }
        : schedule
    )));
  };

  const saveEditingPreview = async () => {
    if (showPreview) {
      // For import preview
      const time = editForm.startTime && editForm.endTime ? `${editForm.startTime} - ${editForm.endTime}` : editForm.startTime || editForm.endTime;
      const updatedData = [...previewData];
      updatedData[editingRow] = { ...editForm, time };
      setPreviewData(updatedData);
    } else if (showViewSchedules) {
      const canEdit = canManageSchedules;

      if (!canEdit) {
        Swal.fire({
          title: 'Permission Denied',
          text: 'You need schedule upload permission to edit or reassign schedules.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        setEditingRow(null);
        setEditForm({});
        return;
      }

      try {
        const [subjectsSnapshot, roomsSnapshot] = await Promise.all([
          get(ref(database, 'subjects')),
          get(ref(database, 'rooms')),
        ]);
        const subjects = subjectsSnapshot.val() || {};
        const rooms = roomsSnapshot.val() || {};
        const subjectRecord = Object.values(subjects).find((subject) =>
          normalizeLookup(subject.subject_name) === normalizeLookup(editForm.subject) ||
          normalizeLookup(subject.subject_code) === normalizeLookup(editForm.subject)
        );
        const subjectId = subjectRecord?.subject_id || sanitizeId(`subj_${editForm.subject}`);
        const subjectCode = subjectRecord?.subject_code || buildSubjectCode(editForm.subject);
        const roomRecord = Object.values(rooms).find((room) =>
          normalizeLookup(room.room_name) === normalizeLookup(editForm.room) ||
          normalizeLookup(room.room_id) === normalizeLookup(editForm.room)
        );
        const roomId = roomRecord?.room_id || '';
        const roomName = editForm.room || 'TBD';
        const assignedFacultyId = editForm.facultyId || editForm.faculty_id || '';
        const assignedFaculty = assignedFacultyId
          ? facultyDirectory[assignedFacultyId] || Object.values(facultyDirectory).find((faculty) => faculty.faculty_id === assignedFacultyId)
          : null;
        const assignedFacultyName = assignedFaculty ? facultyDisplayName(assignedFaculty) : '';
        const scheduleId = editForm.scheduleId || editForm.schedule_id || sanitizeId([
          'sched',
          assignedFacultyId || 'unassigned',
          subjectId,
          roomId || roomName,
          editForm.day,
          editForm.startTime,
          editForm.endTime,
          editForm.section,
        ].join('_'));
        const importBatchId = editForm.importBatchId || editForm.import_batch_id || editForm.originalImportBatchId || editForm.original_import_batch_id || '';
        const importedAt = editForm.importedAt || editForm.imported_at || '';
        const importedBy = editForm.importedBy || editForm.imported_by || '';
        const updates = {
          [`schedules/${scheduleId}`]: {
            schedule_id: scheduleId,
            faculty_id: assignedFacultyId,
            subject_id: subjectId,
            room_id: roomId,
            room_name: roomName,
            day: editForm.day || 'TBD',
            start_time: editForm.startTime || 'TBD',
            end_time: editForm.endTime || 'TBD',
            section: editForm.section || 'TBD',
            term: editForm.term || editForm.semester || 'TBD',
            school_year: editForm.schoolYear || editForm.school_year || 'TBD',
            status: editForm.status || 'active',
            instructor_name: assignedFacultyName || editForm.instructor || '',
            ...(importBatchId ? {
              import_batch_id: importBatchId,
              original_import_batch_id: importBatchId,
            } : {}),
            ...(importedAt ? { imported_at: importedAt } : {}),
            ...(importedBy ? { imported_by: importedBy } : {}),
          },
        };
        if (importBatchId) {
          updates[`schedule_upload_index/${importBatchId}/${scheduleId}`] = true;
        }

        if (!subjectRecord) {
          updates[`subjects/${subjectId}`] = {
            subject_id: subjectId,
            subject_code: subjectCode,
            subject_name: editForm.subject || 'TBD',
            ...(importBatchId ? { import_batch_id: importBatchId } : {}),
            ...(importedAt ? { imported_at: importedAt } : {}),
            ...(importedBy ? { imported_by: importedBy } : {}),
          };
        }

        await update(ref(database), updates);

        const updatedSchedule = {
          ...editForm,
          scheduleId,
          facultyId: assignedFacultyId,
          assignedFacultyName,
          instructor: assignedFacultyName || editForm.instructor || 'Unassigned',
          subjectId,
          roomId,
          room: roomName,
          time: `${editForm.startTime || 'TBD'} - ${editForm.endTime || 'TBD'}`,
          startTime: editForm.startTime || 'TBD',
          endTime: editForm.endTime || 'TBD',
          day: editForm.day || 'TBD',
          section: editForm.section || 'TBD',
          subject: editForm.subject || 'TBD',
          term: editForm.term || editForm.semester || 'TBD',
          schoolYear: editForm.schoolYear || editForm.school_year || 'TBD',
        };
        setSchedules((current) => current.map((schedule) =>
          schedule.scheduleId === scheduleId ? updatedSchedule : schedule
        ));

        await update(ref(database, 'lastScheduleUpdate'), {
          name: currentUser.name,
          time: new Date().toISOString()
        });

        Swal.fire({
          title: 'Success!',
          text: 'Schedule updated successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } catch (error) {
        console.error('Error updating schedule:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to update schedule. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
    setEditingRow(null);
    setEditForm({});
  };

  const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const facultyName = currentUser?.name || 'Faculty Member';
  const canManageSchedules = Boolean(currentUser?.permissions?.upload_schedules);
  const isAdminUser = currentUser?.userType === 'admin' || currentUser?.roleIds?.includes('admin');
  const currentFacultyRecord = Object.values(facultyDirectory).find((faculty) => faculty.user_id === currentUser?.uid);
  const currentFacultyId = currentFacultyRecord?.faculty_id || currentUser?.facultyId || '';
  const isOwnSchedule = (schedule) => currentFacultyId && schedule.facultyId === currentFacultyId;
  const personalSchedules = schedules.filter(isOwnSchedule);
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayCount = personalSchedules.filter((schedule) => schedule.day === todayName).length;
  const uniqueRoomCount = new Set(personalSchedules.map((schedule) => schedule.room).filter(Boolean)).size;
  const visibleDays = selectedDays === 'All' ? scheduleDays : [selectedDays];
  const facultyOptions = Object.values(facultyDirectory)
    .filter((faculty) => faculty.faculty_id)
    .sort((a, b) => facultyDisplayName(a).localeCompare(facultyDisplayName(b)));
  const getScheduleBatchId = (schedule) => (
    schedule.importBatchId ||
    schedule.import_batch_id ||
    schedule.originalImportBatchId ||
    schedule.original_import_batch_id ||
    ''
  );
  const currentScheduleUploadId = latestActiveUploadId(scheduleUploadRecords);
  const scheduleGroupsFromRecords = Object.values(scheduleUploadRecords || {}).reduce((acc, upload) => {
    const id = upload.schedule_upload_id || upload.import_batch_id;
    if (!id) return acc;
    const storedStatus = upload.status || 'active';
    acc[id] = {
      importBatchId: id,
      schoolYear: upload.school_year || '',
      term: upload.term || upload.semester || '',
      importedAt: upload.uploaded_at || upload.imported_at || '',
      importedBy: upload.uploaded_by || '',
      importedByName: upload.uploaded_by_name || '',
      count: Number(upload.schedule_count || 0),
      status: storedStatus === 'active' && currentScheduleUploadId && id !== currentScheduleUploadId ? 'inactive' : storedStatus,
      archivedAt: upload.archived_at || '',
      retentionUntil: upload.retention_until || '',
      hasUploadRecord: true,
    };
    return acc;
  }, {});

  const uploadBatches = Object.values(schedules.reduce((acc, schedule) => {
    const scheduleBatchId = getScheduleBatchId(schedule);
    if (!scheduleBatchId) return acc;
    if (!acc[scheduleBatchId]) {
      acc[scheduleBatchId] = {
        importBatchId: scheduleBatchId,
        schoolYear: schedule.schoolYear || '',
        term: schedule.term || schedule.semester || '',
        importedAt: schedule.importedAt,
        importedBy: schedule.importedBy,
        importedByName: '',
        status: schedule.status || 'active',
        archivedAt: schedule.archivedAt || schedule.archived_at || '',
        retentionUntil: schedule.retentionUntil || schedule.retention_until || '',
        count: 0,
      };
    }
    if (!acc[scheduleBatchId].hasUploadRecord) {
      acc[scheduleBatchId].count += 1;
    }
    if (new Date(schedule.importedAt || 0) > new Date(acc[scheduleBatchId].importedAt || 0)) {
      acc[scheduleBatchId].importedAt = schedule.importedAt;
    }
    return acc;
  }, { ...scheduleGroupsFromRecords })).sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0));
  const activeUploadBatches = uploadBatches.filter((batch) => !['archived', 'deleted'].includes(batch.status));
  const archivedUploadBatches = uploadBatches.filter((batch) => batch.status === 'archived');

  const fetchScheduleUploadRows = async (batchId) => {
    const [batchIndexSnapshot, schedulesSnapshot, subjectsSnapshot, roomsSnapshot, facultiesSnapshot] = await Promise.all([
      get(ref(database, `schedule_upload_index/${batchId}`)),
      get(ref(database, 'schedules')),
      get(ref(database, 'subjects')),
      get(ref(database, 'rooms')),
      get(ref(database, 'faculties')),
    ]);
    const indexedScheduleIds = new Set(Object.keys(batchIndexSnapshot.val() || {}));
    const allScheduleRecords = schedulesSnapshot.val() || {};
    const subjects = subjectsSnapshot.val() || {};
    const rooms = roomsSnapshot.val() || {};
    const faculties = facultiesSnapshot.val() || {};
    const facultyById = Object.values(faculties).reduce((acc, faculty) => {
      if (faculty?.faculty_id) acc[faculty.faculty_id] = faculty;
      return acc;
    }, {});

    return Object.values(allScheduleRecords)
      .filter(Boolean)
      .filter((schedule) =>
        schedule.import_batch_id === batchId ||
        schedule.original_import_batch_id === batchId ||
        indexedScheduleIds.has(schedule.schedule_id)
      )
      .map((schedule) => {
        const subject = subjects[schedule.subject_id] || {};
        const room = rooms[schedule.room_id] || {};
        const faculty = facultyById[schedule.faculty_id] || {};
        return {
          courseCode: subject.subject_code || schedule.subject_code || schedule.subject_id || '',
          courseDescription: subject.subject_name || schedule.subject_name || schedule.subject_id || '',
          day: schedule.day || '',
          startTime: schedule.start_time || '',
          endTime: schedule.end_time || '',
          room: room.room_name || schedule.room_name || schedule.room_id || '',
          instructor: facultyDisplayName(faculty) || schedule.instructor_name || '',
          facultyId: schedule.faculty_id || '',
          section: schedule.section || '',
          schoolYear: schedule.school_year || '',
          term: schedule.term || schedule.semester || '',
        };
      })
      .sort((a, b) =>
        String(a.courseCode).localeCompare(String(b.courseCode), undefined, { numeric: true }) ||
        String(a.day).localeCompare(String(b.day)) ||
        String(a.startTime).localeCompare(String(b.startTime))
      );
  };

  const buildScheduleUploadDocumentPreview = (batch, rows) => {
    const title = `${batch?.schoolYear || 'Unknown SY'} - ${batch?.term || 'Unknown Term'} Schedule Upload`;
    const headers = ['Course Code', 'Course Description', 'Day', 'Start Time', 'End Time', 'Room', 'Instructor', 'Faculty ID', 'Section'];
    const columnWidths = [110, 260, 90, 110, 110, 120, 220, 120, 120];
    const previewRows = [
      {
        index: 1,
        height: 34,
        cells: [{
          key: 'A1',
          value: title,
          rowSpan: 1,
          colSpan: headers.length,
          style: { fontWeight: 700, textAlign: 'center', backgroundColor: '#fff8dc' },
        }],
      },
      {
        index: 2,
        height: 24,
        cells: headers.map((header, index) => ({
          key: `header-${index}`,
          value: header,
          rowSpan: 1,
          colSpan: 1,
          style: { fontWeight: 700, textAlign: 'center', backgroundColor: '#dbeafe' },
        })),
      },
      ...rows.map((row, rowIndex) => ({
        index: rowIndex + 3,
        height: 24,
        cells: [
          row.courseCode,
          row.courseDescription,
          row.day,
          row.startTime,
          row.endTime,
          row.room,
          row.instructor,
          row.facultyId,
          row.section,
        ].map((value, cellIndex) => ({
          key: `row-${rowIndex}-cell-${cellIndex}`,
          value,
          rowSpan: 1,
          colSpan: 1,
          style: rowIndex % 2 === 0 ? { backgroundColor: '#f0fdf4' } : {},
        })),
      })),
    ];

    return {
      fileName: `${batch?.schoolYear || 'schedule'}-${batch?.term || 'upload'}.xlsx`,
      sheets: [{
        name: 'Schedules',
        rows: previewRows,
        columnWidths,
      }],
    };
  };

  const handleOpenScheduleFileView = async () => {
    if (!selectedScheduleUploadId) {
      if (scheduleWorkbookPreview) {
        setShowScheduleDocumentPreview(true);
        return;
      }
      Swal.fire({
        title: 'No file to preview',
        text: 'Upload an Excel file or select a School Year and Term upload first.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    const selectedBatch = activeUploadBatches.find((batch) => batch.importBatchId === selectedScheduleUploadId);
    if (!selectedBatch) {
      Swal.fire({
        title: 'Unavailable upload',
        text: 'Choose an active or inactive upload from the dropdown first.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    setScheduleDocumentPreviewLoading(true);
    try {
      const rows = await fetchScheduleUploadRows(selectedScheduleUploadId);
      if (!rows.length) {
        Swal.fire({
          title: 'No schedules found',
          text: 'This upload has no schedule rows to preview.',
          icon: 'info',
          confirmButtonText: 'OK',
        });
        return;
      }
      const preview = buildScheduleUploadDocumentPreview(selectedBatch, rows);
      setScheduleWorkbookPreview(preview);
      setSelectedSchedulePreviewSheet(preview.sheets[0]?.name || '');
      setShowScheduleDocumentPreview(true);
    } catch (error) {
      console.error('Error opening schedule file view:', error);
      Swal.fire({
        title: 'Failed to open file view',
        text: 'The selected schedule upload could not be loaded. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    } finally {
      setScheduleDocumentPreviewLoading(false);
    }
  };

  const loadArchivedUploadRows = async (batchId) => {
    if (!batchId) {
      setArchiveViewerRows([]);
      return;
    }

    setArchiveViewerLoading(true);
    try {
      const rows = await fetchScheduleUploadRows(batchId);
      setArchiveViewerRows(rows);
    } catch (error) {
      console.error('Error loading archived upload:', error);
      setArchiveViewerRows([]);
      Swal.fire({
        title: 'Failed to load archive',
        text: 'The archived upload could not be opened. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    } finally {
      setArchiveViewerLoading(false);
    }
  };

  const handleScheduleUploadAction = async (action) => {
    if (!activeUploadBatches.length) {
      Swal.fire({
        title: 'No upload batch found',
        text: 'There are no uploaded schedule batches to manage.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    if (!selectedScheduleUploadId) {
      Swal.fire({
        title: 'Select an upload',
        text: 'Choose a School Year and Term upload group first.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    const selectedBatchId = selectedScheduleUploadId;
    const selectedBatch = activeUploadBatches.find((batch) => batch.importBatchId === selectedBatchId);
    if (!selectedBatch) {
      Swal.fire({
        title: 'Unavailable upload',
        text: 'Deleted or archived uploads are not available in this action. Use View Archives to restore archived uploads.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    if (action === 'activate') {
      if (selectedBatch.status === 'active') {
        Swal.fire({
          title: 'Already active',
          text: 'This upload is already the current schedule.',
          icon: 'info',
          confirmButtonText: 'OK',
        });
        return;
      }

      const confirmResult = await Swal.fire({
        title: 'Set active schedule?',
        text: `This will make ${selectedBatch.schoolYear || 'Unknown SY'} ${selectedBatch.term || ''} the current schedule used by Faculty Tracker, Room Tracker, and Student views.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Set Active',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2563eb',
      });

      if (!confirmResult.isConfirmed) return;

      const [indexSnapshot, schedulesSnapshot] = await Promise.all([
        get(ref(database, 'schedule_upload_index')),
        get(ref(database, 'schedules')),
      ]);
      const uploadIndex = indexSnapshot.val() || {};
      const allScheduleRecords = schedulesSnapshot.val() || {};
      const actionTime = new Date().toISOString();
      const updates = {};

      activeUploadBatches.forEach((batch) => {
        const isSelected = batch.importBatchId === selectedBatchId;
        updates[`schedule_uploads/${batch.importBatchId}/status`] = isSelected ? 'active' : 'inactive';
        updates[`schedule_uploads/${batch.importBatchId}/${isSelected ? 'activated_at' : 'deactivated_at'}`] = actionTime;
      });

      Object.values(allScheduleRecords).forEach((schedule) => {
        if (!schedule?.schedule_id) return;
        const scheduleBatchId = schedule.import_batch_id || schedule.original_import_batch_id || '';
        if (!activeUploadBatches.some((batch) => batch.importBatchId === scheduleBatchId)) return;
        updates[`schedules/${schedule.schedule_id}/status`] = scheduleBatchId === selectedBatchId ? 'active' : 'inactive';
        updates[`schedules/${schedule.schedule_id}/${scheduleBatchId === selectedBatchId ? 'activated_at' : 'deactivated_at'}`] = actionTime;
      });

      Object.entries(uploadIndex).forEach(([batchId, indexedSchedules]) => {
        if (!activeUploadBatches.some((batch) => batch.importBatchId === batchId)) return;
        Object.keys(indexedSchedules || {}).forEach((scheduleId) => {
          updates[`schedules/${scheduleId}/status`] = batchId === selectedBatchId ? 'active' : 'inactive';
          updates[`schedules/${scheduleId}/${batchId === selectedBatchId ? 'activated_at' : 'deactivated_at'}`] = actionTime;
        });
      });

      await update(ref(database), updates);
      await update(ref(database, 'lastScheduleUpdate'), {
        name: currentUser.name,
        time: actionTime,
        active_import_batch_id: selectedBatchId,
      });

      Swal.fire({
        title: 'Active schedule updated',
        text: 'The selected upload is now the current schedule.',
        icon: 'success',
        confirmButtonText: 'OK',
      });
      return;
    }

    const batchIndexSnapshot = await get(ref(database, `schedule_upload_index/${selectedBatchId}`));
    const indexedScheduleIds = new Set(Object.keys(batchIndexSnapshot.val() || {}));
    const schedulesSnapshot = await get(ref(database, 'schedules'));
    const allScheduleRecords = schedulesSnapshot.val() || {};
    const selectedBatchSchedules = Object.values(allScheduleRecords)
      .filter(Boolean)
      .filter((schedule) =>
        schedule.import_batch_id === selectedBatchId ||
        schedule.original_import_batch_id === selectedBatchId ||
        indexedScheduleIds.has(schedule.schedule_id)
      );

    const confirmResult = await Swal.fire({
      title: action === 'archive' ? 'Confirm archive' : 'Confirm delete',
      text: `This will ${action} ${selectedBatchSchedules.length} schedule entries from ${selectedBatch?.schoolYear || 'Unknown SY'} ${selectedBatch?.term || ''}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: action === 'archive' ? 'Archive all' : 'Delete all',
      cancelButtonText: 'Cancel',
      confirmButtonColor: action === 'archive' ? '#475569' : '#dc2626',
    });

    if (!confirmResult.isConfirmed) return;

    const subjectsSnapshot = await get(ref(database, 'subjects'));
    const allSubjects = subjectsSnapshot.val() || {};
    const selectedSubjectIds = new Set(selectedBatchSchedules.map((schedule) => schedule.subject_id).filter(Boolean));
    const remainingSubjectIds = new Set(
      Object.values(allScheduleRecords)
        .filter((schedule) => schedule?.import_batch_id !== selectedBatchId && schedule?.original_import_batch_id !== selectedBatchId)
        .map((schedule) => schedule.subject_id)
        .filter(Boolean)
    );
    const updates = {};
    const actionTime = new Date().toISOString();
    const retentionUntil = addDays(actionTime, ARCHIVE_RETENTION_DAYS).toISOString();
    selectedBatchSchedules.forEach((schedule) => {
      if (!schedule.schedule_id) return;
      if (action === 'archive') {
        updates[`schedules/${schedule.schedule_id}/status`] = 'archived';
        updates[`schedules/${schedule.schedule_id}/archived_at`] = actionTime;
        updates[`schedules/${schedule.schedule_id}/retention_until`] = retentionUntil;
      } else {
        updates[`schedules/${schedule.schedule_id}`] = null;
      }
    });
    if (action === 'archive') {
      updates[`schedule_uploads/${selectedBatchId}/status`] = 'archived';
      updates[`schedule_uploads/${selectedBatchId}/archived_at`] = actionTime;
      updates[`schedule_uploads/${selectedBatchId}/retention_until`] = retentionUntil;
    } else {
      updates[`schedule_upload_index/${selectedBatchId}`] = null;
      updates[`schedule_uploads/${selectedBatchId}/status`] = 'deleted';
      updates[`schedule_uploads/${selectedBatchId}/deleted_at`] = new Date().toISOString();
    }
    selectedSubjectIds.forEach((subjectId) => {
      const subject = allSubjects[subjectId];
      const canDeleteSubject = !remainingSubjectIds.has(subjectId) &&
        (!subject?.import_batch_id || subject.import_batch_id === selectedBatchId);
      if (canDeleteSubject) {
        if (action === 'archive') {
          updates[`subjects/${subjectId}/status`] = 'archived';
          updates[`subjects/${subjectId}/archived_at`] = actionTime;
          updates[`subjects/${subjectId}/retention_until`] = retentionUntil;
        } else {
          updates[`subjects/${subjectId}`] = null;
        }
      }
    });

    await update(ref(database), updates);
    await update(ref(database, 'lastScheduleUpdate'), {
      name: currentUser.name,
      time: new Date().toISOString(),
      [`${action}_import_batch_id`]: selectedBatchId,
    });

    Swal.fire({
      title: action === 'archive' ? 'Archived' : 'Deleted',
      text: action === 'archive'
        ? 'The selected upload batch has been archived.'
        : 'The selected upload batch and its unused subjects have been removed.',
      icon: 'success',
      confirmButtonText: 'OK',
    });
  };

  const handleViewArchivedUploads = async () => {
    if (!archivedUploadBatches.length) {
      Swal.fire({
        title: 'No archives found',
        text: 'There are no archived schedule uploads to restore.',
        icon: 'info',
        confirmButtonText: 'OK',
      });
      return;
    }

    const initialBatchId = archiveViewerBatchId || archivedUploadBatches[0].importBatchId;
    setArchiveViewerBatchId(initialBatchId);
    setShowArchiveViewer(true);
    await loadArchivedUploadRows(initialBatchId);
  };

  const handleRestoreArchivedUpload = async () => {
    if (!archiveViewerBatchId) return;

    const result = await Swal.fire({
      title: 'Restore archived upload?',
      text: 'The upload will be restored as inactive. You can review it first, then use Set Active when ready.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
    });

    if (!result.isConfirmed) return;

    const selectedBatchId = archiveViewerBatchId;
    const batchIndexSnapshot = await get(ref(database, `schedule_upload_index/${selectedBatchId}`));
    const indexedScheduleIds = new Set(Object.keys(batchIndexSnapshot.val() || {}));
    const [schedulesSnapshot, subjectsSnapshot] = await Promise.all([
      get(ref(database, 'schedules')),
      get(ref(database, 'subjects')),
    ]);
    const allScheduleRecords = schedulesSnapshot.val() || {};
    const allSubjects = subjectsSnapshot.val() || {};
    const selectedBatchSchedules = Object.values(allScheduleRecords)
      .filter(Boolean)
      .filter((schedule) =>
        schedule.import_batch_id === selectedBatchId ||
        schedule.original_import_batch_id === selectedBatchId ||
        indexedScheduleIds.has(schedule.schedule_id)
      );
    const subjectIds = new Set(selectedBatchSchedules.map((schedule) => schedule.subject_id).filter(Boolean));
    const updates = {};

    selectedBatchSchedules.forEach((schedule) => {
      if (!schedule.schedule_id) return;
      updates[`schedules/${schedule.schedule_id}/status`] = 'inactive';
      updates[`schedules/${schedule.schedule_id}/restored_at`] = new Date().toISOString();
      updates[`schedules/${schedule.schedule_id}/archived_at`] = null;
      updates[`schedules/${schedule.schedule_id}/retention_until`] = null;
    });

    subjectIds.forEach((subjectId) => {
      if (!allSubjects[subjectId]) return;
      updates[`subjects/${subjectId}/status`] = 'inactive';
      updates[`subjects/${subjectId}/restored_at`] = new Date().toISOString();
      updates[`subjects/${subjectId}/archived_at`] = null;
      updates[`subjects/${subjectId}/retention_until`] = null;
    });

    updates[`schedule_uploads/${selectedBatchId}/status`] = 'inactive';
    updates[`schedule_uploads/${selectedBatchId}/restored_at`] = new Date().toISOString();
    updates[`schedule_uploads/${selectedBatchId}/archived_at`] = null;
    updates[`schedule_uploads/${selectedBatchId}/retention_until`] = null;

    await update(ref(database), updates);
    await update(ref(database, 'lastScheduleUpdate'), {
      name: currentUser.name,
      time: new Date().toISOString(),
      restored_import_batch_id: selectedBatchId,
    });

    Swal.fire({
      title: 'Restored',
      text: 'The selected schedule upload has been restored as inactive. Use Set Active when ready.',
      icon: 'success',
      confirmButtonText: 'OK',
    });
  };

  const handleDeleteArchivedUpload = async () => {
    if (!archiveViewerBatchId) return;

    const selectedBatch = archivedUploadBatches.find((batch) => batch.importBatchId === archiveViewerBatchId);
    const result = await Swal.fire({
      title: 'Delete archived upload?',
      text: `This will permanently remove ${selectedBatch?.schoolYear || 'Unknown SY'} ${selectedBatch?.term || ''} from the archive list.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete archive',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) return;

    const selectedBatchId = archiveViewerBatchId;
    const batchIndexSnapshot = await get(ref(database, `schedule_upload_index/${selectedBatchId}`));
    const indexedScheduleIds = new Set(Object.keys(batchIndexSnapshot.val() || {}));
    const [schedulesSnapshot, subjectsSnapshot] = await Promise.all([
      get(ref(database, 'schedules')),
      get(ref(database, 'subjects')),
    ]);
    const allScheduleRecords = schedulesSnapshot.val() || {};
    const allSubjects = subjectsSnapshot.val() || {};
    const selectedBatchSchedules = Object.values(allScheduleRecords)
      .filter(Boolean)
      .filter((schedule) =>
        schedule.import_batch_id === selectedBatchId ||
        schedule.original_import_batch_id === selectedBatchId ||
        indexedScheduleIds.has(schedule.schedule_id)
      );
    const selectedSubjectIds = new Set(selectedBatchSchedules.map((schedule) => schedule.subject_id).filter(Boolean));
    const remainingSubjectIds = new Set(
      Object.values(allScheduleRecords)
        .filter((schedule) => schedule?.import_batch_id !== selectedBatchId && schedule?.original_import_batch_id !== selectedBatchId)
        .map((schedule) => schedule.subject_id)
        .filter(Boolean)
    );
    const updates = {};

    selectedBatchSchedules.forEach((schedule) => {
      if (schedule?.schedule_id) updates[`schedules/${schedule.schedule_id}`] = null;
    });
    selectedSubjectIds.forEach((subjectId) => {
      const subject = allSubjects[subjectId];
      const canDeleteSubject = !remainingSubjectIds.has(subjectId) &&
        (!subject?.import_batch_id || subject.import_batch_id === selectedBatchId);
      if (canDeleteSubject) updates[`subjects/${subjectId}`] = null;
    });
    updates[`schedule_upload_index/${selectedBatchId}`] = null;
    updates[`schedule_uploads/${selectedBatchId}/status`] = 'deleted';
    updates[`schedule_uploads/${selectedBatchId}/deleted_at`] = new Date().toISOString();

    await update(ref(database), updates);
    await update(ref(database, 'lastScheduleUpdate'), {
      name: currentUser.name,
      time: new Date().toISOString(),
      deleted_archived_import_batch_id: selectedBatchId,
    });

    const remainingArchives = archivedUploadBatches.filter((batch) => batch.importBatchId !== selectedBatchId);
    if (remainingArchives.length) {
      const nextBatchId = remainingArchives[0].importBatchId;
      setArchiveViewerBatchId(nextBatchId);
      await loadArchivedUploadRows(nextBatchId);
    } else {
      setArchiveViewerBatchId('');
      setArchiveViewerRows([]);
      setShowArchiveViewer(false);
    }

    Swal.fire({
      title: 'Archive deleted',
      text: 'The archived upload has been removed.',
      icon: 'success',
      confirmButtonText: 'OK',
    });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-14 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <div className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-[width] duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-0 border-r-0 shadow-none'}`}>
        <div className={`relative h-full w-72 px-4 py-5 transition-opacity duration-200 ease-in-out ${isSidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'}`}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <MdSchedule className="h-6 w-6" />
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
            <Link to="/room-tracker" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors">
              <MdLocationOn className="h-5 w-5" />
              <span>Room Tracker</span>
            </Link>
            <div className="flex items-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-lg">
              <MdSchedule className="h-5 w-5" />
              <span>Schedules</span>
            </div>
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

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className={`mb-6 grid gap-4 ${canManageSchedules ? 'xl:grid-cols-[360px_minmax(0,1fr)] xl:items-stretch' : 'xl:grid-cols-1'}`}>
            <div className={`rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/80 ${canManageSchedules ? '' : 'max-w-none'}`}>
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/60">
                Faculty Module
              </div>
              <div className={`${canManageSchedules ? '' : 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'}`}>
                <div>
                  <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-950 dark:text-gray-100">
                    {canManageSchedules ? 'Schedules' : 'My Schedule'}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-gray-400">
                    {canManageSchedules
                      ? 'Import, review, and manage faculty schedules in one clean timetable.'
                      : 'View your assigned classes from the currently active schedule.'}
                  </p>
                </div>
                {!canManageSchedules && (
                  <div className="mt-5 rounded-md bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 lg:mt-0">
                    {personalSchedules.length} assigned class{personalSchedules.length === 1 ? '' : 'es'} in the active schedule
                  </div>
                )}
              </div>
              {canManageSchedules && (
                <div className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                  Active schedule controls what appears in trackers.
                </div>
              )}
            </div>
            {canManageSchedules && (
              <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={scheduleUploadContext.schoolYear}
                    onChange={(event) => setScheduleUploadContext({ ...scheduleUploadContext, schoolYear: event.target.value })}
                    placeholder="School Year e.g. 2026-2027"
                    className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={scheduleUploadContext.term}
                    onChange={(event) => setScheduleUploadContext({ ...scheduleUploadContext, term: event.target.value })}
                    placeholder="Term e.g. 1st Semester"
                    className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[auto_auto_auto_minmax(260px,1fr)]">
                  <button
                    onClick={handleImportClick}
                    disabled={processingFile}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingFile ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing
                      </>
                    ) : (
                      <>
                        <MdCloudUpload className="h-5 w-5" />
                        Import Excel
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowViewSchedules(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <MdSchedule className="h-5 w-5" />
                    View & Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenScheduleFileView}
                    disabled={scheduleDocumentPreviewLoading || (!scheduleWorkbookPreview && !selectedScheduleUploadId)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {scheduleDocumentPreviewLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-slate-600 dark:text-gray-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading
                      </>
                    ) : (
                      <>
                        <FaEye className="h-4 w-4" />
                        Open File View
                      </>
                    )}
                  </button>
                  <select
                    value={selectedScheduleUploadId}
                    onChange={(event) => setSelectedScheduleUploadId(event.target.value)}
                    className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select SY/Term upload</option>
                    {activeUploadBatches.map((batch) => (
                      <option key={batch.importBatchId} value={batch.importBatchId}>
                        {batch.schoolYear || 'Unknown SY'} - {batch.term || 'Unknown Term'} - {batch.count} schedule{batch.count === 1 ? '' : 's'} - {batch.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    onClick={() => handleScheduleUploadAction('activate')}
                    disabled={!activeUploadBatches.length || !selectedScheduleUploadId}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                  >
                    <MdCheck className="h-5 w-5" />
                    Set Active
                  </button>
                  <button
                    onClick={() => handleScheduleUploadAction('archive')}
                    disabled={!activeUploadBatches.length || !selectedScheduleUploadId}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    Archive Upload
                  </button>
                  <button
                    onClick={handleViewArchivedUploads}
                    disabled={!archivedUploadBatches.length}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-300"
                  >
                    View Archives
                  </button>
                  <button
                    onClick={() => handleScheduleUploadAction('delete')}
                    disabled={!activeUploadBatches.length || !selectedScheduleUploadId}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-gray-900 dark:text-red-300"
                  >
                    <MdDeleteSweep className="h-5 w-5" />
                    Delete Upload
                  </button>
                </div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.xlsm"
            className="hidden"
          />

          {importError && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {importError}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'My Classes', value: personalSchedules.length, detail: 'Assigned entries', icon: MdEventNote, accent: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
              { label: 'Today', value: todayCount, detail: todayName, icon: MdAccessTime, accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
              { label: 'Rooms', value: uniqueRoomCount, detail: 'Unique locations', icon: MdLocationOn, accent: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
              { label: 'Last Update', value: lastUpdatedBy || 'None', detail: 'Schedule source', icon: MdCheck, accent: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{item.label}</p>
                      <p className="mt-2 truncate text-2xl font-bold text-slate-950 dark:text-gray-100">{item.value}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{item.detail}</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${item.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>


          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-gray-100">Weekly Schedule</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">Showing schedules linked to {facultyName}.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['All', ...scheduleDays].map((day) => (
                  <button
                    key={day}
                    onClick={() => selectDay(day)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      selectedDays === day
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                    }`}
                  >
                    {day === 'All' ? 'All' : day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>


          {/* Schedule Content */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-gray-100">Schedule List</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">Your teaching schedule organized by day.</p>
              </div>
              <div className="mt-4 lg:mt-0">
                <div className="inline-flex items-center rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {personalSchedules.length} assigned class{personalSchedules.length !== 1 ? 'es' : ''}
                </div>
              </div>
            </div>

            {personalSchedules.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
                {visibleDays.map((day) => {
                  const daySchedules = personalSchedules
                    .filter(schedule => schedule.day === day)
                    .sort((a, b) => getStartTime(a.time).localeCompare(getStartTime(b.time)));

                  // if (daySchedules.length === 0) return null;

                  return (
                    <div key={day} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-700">
                        <div className="flex items-center space-x-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            <MdSchedule className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-950 dark:text-gray-100">{day}</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Teaching schedule</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-gray-700 dark:text-gray-300">{daySchedules.length}</span>
                      </div>
                      {daySchedules.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-gray-700">
                          {daySchedules.map((schedule, index) => (
                          <div key={index} className="p-5 transition hover:bg-slate-50 dark:hover:bg-gray-800">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex-1">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-slate-950 dark:text-gray-100">{schedule.subject}</h4>
                                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    <MdClass className="h-4 w-4" />
                                    {schedule.section}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                  <div className="flex items-center space-x-3 text-slate-600 dark:text-gray-300">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 dark:bg-gray-700">
                                      <MdLocationOn className="h-5 w-5 text-slate-500 dark:text-gray-300" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-gray-100">Room</div>
                                      <div className="text-slate-500 dark:text-gray-400">{schedule.room}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3 text-slate-600 dark:text-gray-300">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 dark:bg-gray-700">
                                      <MdAccessTime className="h-5 w-5 text-slate-500 dark:text-gray-300" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-gray-100">Time</div>
                                      <div className="text-slate-500 dark:text-gray-400">{schedule.time}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        </div>
                      ) : (
                        <div className="flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center">
                          <MdEventBusy className="h-8 w-8 text-slate-300 dark:text-gray-600" />
                          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-gray-300">No schedules for {day}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <MdEventNote className="mx-auto h-12 w-12 text-slate-300 dark:text-gray-600" />
                <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-gray-100">No schedules available</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-gray-400">
                  {isAdminUser
                    ? 'No schedule is assigned to this admin account. Use View Schedules to review all imported records.'
                    : 'No schedule is currently assigned to your faculty account.'}
                </p>
                {canManageSchedules && !isAdminUser && (
                  <button
                    onClick={handleImportClick}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <MdCloudUpload className="h-5 w-5" />
                    Import Schedule
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sheet Selection Modal */}
      {showSheetSelection && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Select Sheet</h2>
                  <p className="text-blue-100 dark:text-blue-200">Choose which sheet to import from</p>
                </div>
                <button
                  onClick={() => setShowSheetSelection(false)}
                  className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-2 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {availableSheets.map((sheetName, index) => (
                  <button
                    key={index}
                    onClick={() => handleSheetSelect(sheetName)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{sheetName}</span>
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleDocumentPreview && scheduleWorkbookPreview && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/55 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-white px-5 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Workbook Preview</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-gray-100">{scheduleWorkbookPreview.fileName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedSchedulePreviewSheet}
                onChange={(event) => setSelectedSchedulePreviewSheet(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {scheduleWorkbookPreview.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowScheduleDocumentPreview(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#ededed] p-8">
            <div className="mx-auto w-fit min-w-[52rem] border border-slate-400 bg-white p-10 shadow-2xl shadow-slate-900/20">
              <div className="min-h-[70rem] w-fit min-w-[46rem] overflow-visible">
                <table className="border-collapse font-[Calibri,Arial,sans-serif] text-[12px] text-slate-950">
                  <colgroup>
                    {(scheduleWorkbookPreview.sheets.find((sheet) => sheet.name === selectedSchedulePreviewSheet)?.columnWidths || []).map((width, index) => (
                      <col key={`${selectedSchedulePreviewSheet}-col-${index}`} style={{ width: `${width}px` }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {(scheduleWorkbookPreview.sheets.find((sheet) => sheet.name === selectedSchedulePreviewSheet)?.rows || []).map((row) => (
                      <tr key={`${selectedSchedulePreviewSheet}-row-${row.index}`} style={{ height: `${row.height}px` }}>
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

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Import Preview</h2>
                  <p className="text-blue-100 dark:text-blue-200">Review the schedule data before importing</p>
                </div>
                <button
                  onClick={() => {
                    cancelImport();
                    setSearchTerm('');
                  }}
                  className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-2 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Found {previewData.length} schedule entries. Import will create or reuse Subjects, Rooms, and schema-based Schedule records.
                </p>
              </div>

              {/* Preview Filters */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filter Preview Data</h4>
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search across all fields..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                    />
                    <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={selectedInstructor}
                    onChange={(e) => setSelectedInstructor(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Instructors</option>
                    {[...new Set(previewData.map(s => s.instructor))].sort().map(instructor => (
                      <option key={instructor} value={instructor}>{instructor}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Subjects</option>
                    {[...new Set(previewData.map(s => s.subject))].sort().map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Sections</option>
                    {[...new Set(previewData.map(s => s.section))].sort().map(section => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Section</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">End Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Instructor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredPreviewData.map((schedule, originalIndex) => {
                        // Find the original index in the full array for editing
                        const index = previewData.findIndex(s =>
                          s.section === schedule.section &&
                          s.subject === schedule.subject &&
                          s.day === schedule.day &&
                          s.time === schedule.time
                        );
                      const isEditing = editingRow === index;

                      // Allow editing in preview modal since user is importing their own data
                      const canEdit = true;

                      // Use stored start and end times for display
                      const startTime = schedule.startTime || '';
                      const endTime = schedule.endTime || '';

                      return (
                        <tr key={originalIndex} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.section || ''}
                                onChange={(e) => setEditForm({...editForm, section: e.target.value})}
                                className="w-full px-2 py-1 text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="Section"
                              />
                            ) : (
                              <span className="text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{schedule.section}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.subject || ''}
                                onChange={(e) => setEditForm({...editForm, subject: e.target.value})}
                                className="w-full px-2 py-1 text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="Subject"
                              />
                            ) : (
                              <span className="text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{schedule.subject}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.room || ''}
                                onChange={(e) => setEditForm({...editForm, room: e.target.value})}
                                className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="Room"
                              />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{schedule.room}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.startTime || ''}
                                onChange={(e) => setEditForm({...editForm, startTime: e.target.value})}
                                className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="Start Time"
                              />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{startTime}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.endTime || ''}
                                onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                                className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="End Time"
                              />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{endTime}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <select
                                value={editForm.day || ''}
                                onChange={(e) => setEditForm({...editForm, day: e.target.value})}
                                className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                              >
                                <option value="">Select Day</option>
                                <option value="Monday">Monday</option>
                                <option value="Tuesday">Tuesday</option>
                                <option value="Wednesday">Wednesday</option>
                                <option value="Thursday">Thursday</option>
                                <option value="Friday">Friday</option>
                                <option value="Saturday">Saturday</option>
                              </select>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{schedule.day}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.instructor || ''}
                                onChange={(e) => setEditForm({...editForm, instructor: e.target.value})}
                                className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                placeholder="Instructor"
                              />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingPreview(index)}>{schedule.instructor}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="space-y-1">
                              <select
                                value={schedule.facultyId || ''}
                                onChange={(e) => updatePreviewFaculty(index, e.target.value)}
                                className="w-52 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="">Unmatched</option>
                                {facultyOptions.map((faculty) => (
                                  <option key={faculty.faculty_id} value={faculty.faculty_id}>
                                    {facultyDisplayName(faculty)}
                                  </option>
                                ))}
                              </select>
                              <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                ['matched_by_id', 'manual'].includes(schedule.facultyMatchStatus)
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : schedule.facultyMatchStatus === 'unmatched_id'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}>
                                {schedule.facultyMatchStatus === 'matched_by_id'
                                  ? 'Matched by Faculty ID'
                                  : schedule.facultyMatchStatus === 'manual'
                                    ? 'Manual assignment'
                                  : schedule.facultyMatchStatus === 'unmatched_id'
                                    ? 'Unknown Faculty ID'
                                    : schedule.facultyMatchStatus === 'matched_by_name'
                                      ? 'Name fallback'
                                      : 'Unmatched'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isEditing ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={saveEditingPreview}
                                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditingPreview}
                                  className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : canEdit ? (
                              <button
                                onClick={() => startEditingPreview(index)}
                                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              >
                                Edit
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">View Only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex flex-col">
              {importLoading && (
                <div className="w-full mb-2">
                  <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden mb-1">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${importProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    Importing... {importProgress}%
                  </p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelImport}
                  disabled={importLoading}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center cursor-pointer"
                >
                  {importLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    "Import " + previewData.length + " Schedules"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchiveViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Archive Workbook</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-gray-100">Archived Schedule Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestoreArchivedUpload}
                  disabled={!archiveViewerBatchId || archiveViewerLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Restore Upload
                </button>
                <button
                  type="button"
                  onClick={handleDeleteArchivedUpload}
                  disabled={!archiveViewerBatchId || archiveViewerLoading}
                  className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-gray-900 dark:text-red-300"
                >
                  Delete Archive
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveViewer(false)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 md:grid-cols-[minmax(260px,1fr)_auto] md:items-center">
              <select
                value={archiveViewerBatchId}
                onChange={async (event) => {
                  setArchiveViewerBatchId(event.target.value);
                  await loadArchivedUploadRows(event.target.value);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {archivedUploadBatches.map((batch) => {
                  const retentionLabel = batch.retentionUntil
                    ? `retained until ${new Date(batch.retentionUntil).toLocaleDateString()}`
                    : `${ARCHIVE_RETENTION_DAYS}-day retention`;
                  return (
                    <option key={batch.importBatchId} value={batch.importBatchId}>
                      {batch.schoolYear || 'Unknown SY'} - {batch.term || 'Unknown Term'} - {batch.count} schedules - {retentionLabel}
                    </option>
                  );
                })}
              </select>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                {archiveViewerRows.length} row{archiveViewerRows.length === 1 ? '' : 's'} loaded
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-gray-950">
              <div className="min-w-[1180px] border border-slate-300 bg-white font-sans text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="grid grid-cols-[44px_120px_260px_90px_105px_105px_120px_210px_120px_120px] bg-slate-200 text-center text-xs font-bold text-slate-700 dark:bg-gray-800 dark:text-gray-200">
                  {['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((letter) => (
                    <div key={letter || 'corner'} className="border-r border-b border-slate-300 px-2 py-2 dark:border-gray-700">{letter}</div>
                  ))}
                </div>
                <div className="grid grid-cols-[44px_120px_260px_90px_105px_105px_120px_210px_120px_120px] bg-yellow-50 text-center font-bold text-slate-950 dark:bg-yellow-950/30 dark:text-gray-100">
                  <div className="border-r border-b border-slate-300 bg-slate-100 px-2 py-2 text-xs text-slate-600 dark:border-gray-700 dark:bg-gray-800">1</div>
                  <div className="col-span-9 border-b border-slate-300 px-2 py-3 dark:border-gray-700">STI Locator Archived Schedule Upload</div>
                </div>
                <div className="grid grid-cols-[44px_120px_260px_90px_105px_105px_120px_210px_120px_120px] bg-blue-100 text-xs font-bold uppercase text-slate-900 dark:bg-blue-950/40 dark:text-gray-100">
                  {['2', 'Course Code', 'Course Description', 'Day', 'Start Time', 'End Time', 'Room', 'Instructor', 'Faculty ID', 'Section'].map((header, index) => (
                    <div key={header} className={`${index === 0 ? 'bg-slate-100 text-center text-slate-600 dark:bg-gray-800 dark:text-gray-300' : ''} border-r border-b border-slate-300 px-2 py-2 dark:border-gray-700`}>
                      {header}
                    </div>
                  ))}
                </div>

                {archiveViewerLoading ? (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500 dark:text-gray-400">Loading archived workbook...</div>
                ) : archiveViewerRows.length ? (
                  archiveViewerRows.map((row, index) => (
                    <div key={`${row.courseCode}-${row.day}-${row.startTime}-${index}`} className="grid grid-cols-[44px_120px_260px_90px_105px_105px_120px_210px_120px_120px] bg-white text-slate-800 odd:bg-green-50/50 dark:bg-gray-900 dark:text-gray-100 dark:odd:bg-emerald-950/10">
                      {[index + 3, row.courseCode, row.courseDescription, row.day, row.startTime, row.endTime, row.room, row.instructor, row.facultyId, row.section].map((cell, cellIndex) => (
                        <div key={`${cellIndex}-${cell}`} className={`${cellIndex === 0 ? 'bg-slate-100 text-center text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300' : ''} min-h-9 truncate border-r border-b border-slate-300 px-2 py-2 dark:border-gray-700`} title={String(cell || '')}>
                          {cell || ''}
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500 dark:text-gray-400">No archived schedule rows found for this upload.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Schedules Modal */}
      {showViewSchedules && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">View & Edit Schedules</h2>
                  <p className="text-purple-100 dark:text-purple-200">Manage your teaching schedules</p>
                </div>
                <button
                  onClick={() => {
                    setShowViewSchedules(false);
                    setSearchTerm('');
                  }}
                  className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-2 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Found {schedules.length} schedule entries. Use filters to narrow down and click fields to edit.
                </p>
              </div>

              {/* View Filters */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filter Schedules</h4>
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search across all fields..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all duration-200 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                    />
                    <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select
                    value={selectedInstructor}
                    onChange={(e) => setSelectedInstructor(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Instructors</option>
                    {[...new Set(schedules.map(s => s.instructor))].sort().map(instructor => (
                      <option key={instructor} value={instructor}>{instructor}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Subjects</option>
                    {[...new Set(schedules.map(s => s.subject))].sort().map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Sections</option>
                    {[...new Set(schedules.map(s => s.section))].sort().map(section => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="All">All Days</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
              </div>

              {/* View Table */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Section</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">End Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Instructor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredViewData.map((schedule, originalIndex) => {
                        const index = schedules.findIndex(s => s.scheduleId === schedule.scheduleId);
                        const isEditing = editingRow === index;

      const canEdit = canManageSchedules;

                        // Parse time for display
                        const { start: startTime, end: endTime } = parseTime(schedule.time);

                        return (
                          <tr key={originalIndex} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.section || ''}
                                  onChange={(e) => setEditForm({...editForm, section: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="Section"
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{schedule.section}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.subject || ''}
                                  onChange={(e) => setEditForm({...editForm, subject: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="Subject"
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{schedule.subject}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.room || ''}
                                  onChange={(e) => setEditForm({...editForm, room: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="Room"
                                />
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{schedule.room}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.startTime || ''}
                                  onChange={(e) => setEditForm({...editForm, startTime: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="Start Time"
                                />
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{startTime}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.endTime || ''}
                                  onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="End Time"
                                />
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{endTime}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <select
                                  value={editForm.day || ''}
                                  onChange={(e) => setEditForm({...editForm, day: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                >
                                  <option value="">Select Day</option>
                                  <option value="Monday">Monday</option>
                                  <option value="Tuesday">Tuesday</option>
                                  <option value="Wednesday">Wednesday</option>
                                  <option value="Thursday">Thursday</option>
                                  <option value="Friday">Friday</option>
                                  <option value="Saturday">Saturday</option>
                                </select>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{schedule.day}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.instructor || ''}
                                  onChange={(e) => setEditForm({...editForm, instructor: e.target.value})}
                                  className="w-full px-2 py-1 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                                  placeholder="Instructor"
                                />
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" onClick={() => startEditingSchedule(schedule)}>{schedule.instructor}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <select
                                  value={editForm.facultyId || ''}
                                  onChange={(e) => {
                                    const faculty = facultyDirectory[e.target.value] || Object.values(facultyDirectory).find((item) => item.faculty_id === e.target.value);
                                    setEditForm({
                                      ...editForm,
                                      facultyId: e.target.value,
                                      instructor: faculty ? facultyDisplayName(faculty) : editForm.instructor,
                                    });
                                  }}
                                  className="w-52 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                >
                                  <option value="">Unassigned</option>
                                  {facultyOptions.map((faculty) => (
                                    <option key={faculty.faculty_id} value={faculty.faculty_id}>
                                      {facultyDisplayName(faculty)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300">{schedule.assignedFacultyName || schedule.instructor || 'Unassigned'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={saveEditingPreview}
                                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditingPreview}
                                    className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : canEdit ? (
                                <button
                                  onClick={() => startEditingSchedule(schedule)}
                                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">View Only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowViewSchedules(false)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacultySchedules;
