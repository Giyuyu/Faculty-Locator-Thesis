import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaChevronLeft, FaChevronRight, FaSearch, FaTimes, FaUserCircle } from 'react-icons/fa';
import { MdApps, MdDashboard, MdEdit, MdMeetingRoom, MdPeople, MdPlayArrow, MdSchool, MdSecurity, MdUploadFile } from 'react-icons/md';

const getElementRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const selectors = String(selector).split(',').map((item) => item.trim()).filter(Boolean);
  const element = selectors.reduce((found, item) => found || document.querySelector(item), null);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildSafeRect = (rect, padding = 10, inset = 0) => {
  if (!rect) return null;
  const width = Math.max(0, rect.width - inset * 2);
  const height = Math.max(0, rect.height - inset * 2);
  return {
    top: Math.max(8, rect.top + inset - padding),
    left: Math.max(8, rect.left + inset - padding),
    width: width + padding * 2,
    height: height + padding * 2,
  };
};

const rectChanged = (previous, next, threshold = 6) => {
  if (!previous || !next) return previous !== next;
  return (
    Math.abs(previous.top - next.top) > threshold
    || Math.abs(previous.left - next.left) > threshold
    || Math.abs(previous.width - next.width) > threshold
    || Math.abs(previous.height - next.height) > threshold
  );
};

const CARD_WIDTH = 360;
const CARD_MIN_HEIGHT = 230;
const CARD_MAX_HEIGHT = 340;
const CARD_GAP = 16;
const SIDEBAR_CARD_WIDTH = 370;
const SIDEBAR_CARD_HEIGHT = 205;

const getDefaultCardPosition = () => {
  if (typeof window === 'undefined') return { left: 16, top: 320 };
  return {
    left: clamp(Math.round(window.innerWidth * 0.58), 16, Math.max(16, window.innerWidth - CARD_WIDTH - 16)),
    top: clamp(Math.round(window.innerHeight * 0.18), 72, Math.max(72, window.innerHeight - CARD_MAX_HEIGHT - 16)),
  };
};

const getSmartCardPosition = (rect, stepConfig) => {
  if (typeof window === 'undefined' || !rect) return getDefaultCardPosition();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = stepConfig?.cardWidth || CARD_WIDTH;
  const cardHeight = stepConfig?.cardHeight || CARD_MAX_HEIGHT;
  const maxLeft = Math.max(16, viewportWidth - cardWidth - 16);
  const maxTop = Math.max(72, viewportHeight - cardHeight - 16);
  const requestedPlacement = stepConfig?.cardPlacement;

  if (requestedPlacement === 'sidebar-intro') {
    return {
      left: clamp(Math.round(rect.left + rect.width + CARD_GAP), 16, maxLeft),
      top: clamp(Math.round(rect.top + 210), 72, maxTop),
    };
  }

  if (requestedPlacement === 'sidebar-corner') {
    const sidebarRect = getElementRect('[data-tour="module-sidebar"]') || rect;
    const settingsRect = getElementRect('[data-tour="admin-nav-settings"], [data-tour="faculty-schedules-nav"]');
    const targetTop = settingsRect
      ? settingsRect.top + settingsRect.height + 8
      : sidebarRect.top + 470;
    return {
      left: clamp(Math.round(sidebarRect.left + 12), 16, maxLeft),
      top: clamp(Math.round(targetTop), 72, maxTop),
    };
  }

  if (requestedPlacement === 'center') {
    return {
      left: clamp(Math.round((viewportWidth - cardWidth) / 2), 16, maxLeft),
      top: clamp(Math.round((viewportHeight - cardHeight) / 2), 72, maxTop),
    };
  }

  if (requestedPlacement === 'faculty-fixed') {
    return {
      left: maxLeft,
      top: maxTop,
    };
  }

  const verticalCenter = rect.top + rect.height / 2 - cardHeight / 2;
  const horizontalCenter = rect.left + rect.width / 2 - cardWidth / 2;
  const placements = [
    {
      left: rect.left + rect.width + CARD_GAP,
      top: verticalCenter,
      score: viewportWidth - (rect.left + rect.width),
    },
    {
      left: rect.left - cardWidth - CARD_GAP,
      top: verticalCenter,
      score: rect.left,
    },
    {
      left: horizontalCenter,
      top: rect.top + rect.height + CARD_GAP,
      score: viewportHeight - (rect.top + rect.height),
    },
    {
      left: horizontalCenter,
      top: rect.top - cardHeight - CARD_GAP,
      score: rect.top,
    },
  ];

  const fittingPlacement = placements.find((placement) => (
    placement.left >= 16
    && placement.left <= maxLeft
    && placement.top >= 72
    && placement.top <= maxTop
    && placement.score > 0
  ));
  const placement = fittingPlacement || placements.sort((a, b) => b.score - a.score)[0] || getDefaultCardPosition();

  return {
    left: clamp(Math.round(placement.left), 16, maxLeft),
    top: clamp(Math.round(placement.top), 72, maxTop),
  };
};

export const HOME_GUIDE_STEPS = [
  {
    title: 'Top Navigation',
    label: 'Navbar',
    icon: MdApps,
    selector: '[data-tour="module-navbar"]',
    body: 'The top bar keeps the guide, notifications, and profile menu available while you choose a module.',
  },
  {
    title: 'Open The Guide Anytime',
    label: 'Help button',
    icon: MdPlayArrow,
    selector: '[data-tour="guide"]',
    body: 'This book icon opens the quick guide. Use it whenever you need a quick reminder of what each part of the website does.',
  },
  {
    title: 'Notifications',
    label: 'Updates',
    icon: FaBell,
    selector: '[data-tour="notifications"]',
    body: 'The bell shows schedule updates and system messages. A red dot means there are unread notifications.',
  },
  {
    title: 'Profile',
    label: 'Account',
    icon: FaUserCircle,
    selector: '[data-tour="profile"]',
    body: 'Open your profile page to edit details, change password, choose a theme, or sign out.',
  },
  {
    title: 'Choose A Module',
    label: 'Module cards',
    icon: MdApps,
    selector: '[data-tour="admin-module"], [data-tour="faculty-module"], [data-tour="student-module"]',
    extraSelectors: ['[data-tour="faculty-module"]', '[data-tour="student-module"]'],
    cardPlacement: 'center',
    body: 'Pick a module card at the bottom. The selected card changes its highlight and updates the video, checklist, and Enter action.',
  },
  {
    title: 'Enter The Selected Module',
    label: 'Proceed',
    icon: MdPlayArrow,
    selector: '[data-tour="enter"]',
    body: 'After choosing a module, press Enter to open it. Users only see modules allowed by their roles and permissions.',
  },
  {
    title: 'Admin Module',
    label: 'Control',
    icon: MdSecurity,
    selector: '[data-tour="admin-module"]',
    moduleId: 'admin',
    body: 'Admins manage users, roles, permissions, accounts, batch uploads, rooms, reservations, maintenance, dashboards, and reports.',
  },
  {
    title: 'Faculty Module',
    label: 'Teach',
    icon: MdUploadFile,
    selector: '[data-tour="faculty-module"]',
    moduleId: 'faculty',
    body: 'Faculty tools include the faculty tracker, room tracker, and schedule management. Schedule uploaders can import Excel files by School Year and Term.',
  },
  {
    title: 'Student Module',
    label: 'Locate',
    icon: MdSchool,
    selector: '[data-tour="student-module"]',
    moduleId: 'student',
    body: "Students can view faculty status and open a faculty card to see that faculty member's schedule.",
  },
];

export const ADMIN_GUIDE_STEPS = [
  {
    title: 'Top Navigation',
    label: 'Navbar',
    icon: MdApps,
    selector: '[data-tour="module-navbar"]',
    body: 'The top bar keeps the guide, module switcher, notifications, and profile menu in the same place throughout the module.',
  },
  {
    title: 'Replay The Guide',
    label: 'Book button',
    icon: MdPlayArrow,
    selector: '[data-tour="guide"]',
    body: 'Use the book button to replay this admin guide whenever you need a quick walkthrough.',
  },
  {
    title: 'Module Switcher',
    label: 'Modules',
    icon: MdApps,
    selector: '[data-tour="module-switcher"]',
    body: 'This returns you to module selection without signing out.',
  },
  {
    title: 'Notifications',
    label: 'Updates',
    icon: FaBell,
    selector: '[data-tour="notifications"]',
    body: 'The bell shows admin-relevant updates, including schedule and account activity.',
  },
  {
    title: 'Profile Menu',
    label: 'Account',
    icon: FaUserCircle,
    selector: '[data-tour="profile"]',
    body: 'Use the profile menu for profile details, password changes, theme settings, and sign out.',
  },
  {
    title: 'Admin Navigation',
    label: 'Sidebar',
    icon: MdApps,
    selector: '[data-tour="module-sidebar"]',
    cardPlacement: 'sidebar-intro',
    body: 'Use the sidebar to move between admin sections. It stays open while you work.',
  },
  {
    title: 'Dashboard Overview',
    label: 'Live data',
    icon: MdDashboard,
    selector: '[data-tour="admin-nav-dashboard"]',
    extraSelectors: ['[data-tour="admin-dashboard"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'dashboard',
    extraPadding: 4,
    extraInset: 14,
    body: 'See live totals, faculty activity, room usage, and key maintenance signals.',
  },
  {
    title: 'Create Accounts',
    label: 'Accounts',
    icon: MdPeople,
    selector: '[data-tour="admin-nav-accounts"]',
    extraSelectors: ['[data-tour="admin-accounts"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'accounts',
    extraPadding: 4,
    extraInset: 14,
    body: 'Create internal student or faculty accounts and review saved account records.',
  },
  {
    title: 'Roles And Permissions',
    label: 'Access control',
    icon: MdSecurity,
    selector: '[data-tour="admin-nav-users"]',
    extraSelectors: ['[data-tour="admin-users"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'users',
    extraPadding: 4,
    extraInset: 14,
    body: 'Select a user, then update roles, permissions, status, or reset passwords.',
  },
  {
    title: 'Batch Upload',
    label: 'Imports',
    icon: MdUploadFile,
    selector: '[data-tour="admin-nav-batch"]',
    extraSelectors: ['[data-tour="admin-batch"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'batch',
    extraPadding: 4,
    extraInset: 14,
    body: 'Upload account templates by SY and Term, preview files, and manage archives.',
  },
  {
    title: 'Rooms And Status',
    label: 'Rooms',
    icon: MdMeetingRoom,
    selector: '[data-tour="admin-nav-rooms"]',
    extraSelectors: ['[data-tour="admin-rooms"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'rooms',
    extraPadding: 4,
    extraInset: 14,
    body: 'Manage rooms, reservations, and maintenance status used by the trackers.',
  },
  {
    title: 'Reports',
    label: 'Reports',
    icon: MdDashboard,
    selector: '[data-tour="admin-nav-reports"]',
    extraSelectors: ['[data-tour="admin-reports"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'reports',
    extraPadding: 4,
    extraInset: 14,
    body: 'Review faculty activity, room usage, schedules, and maintenance reports.',
  },
  {
    title: 'Settings',
    label: 'Settings',
    icon: MdSecurity,
    selector: '[data-tour="admin-nav-settings"]',
    extraSelectors: ['[data-tour="admin-settings"]'],
    cardPlacement: 'sidebar-corner',
    cardWidth: SIDEBAR_CARD_WIDTH,
    cardHeight: SIDEBAR_CARD_HEIGHT,
    tabId: 'settings',
    extraPadding: 4,
    extraInset: 14,
    body: 'Review role defaults, security status, route guards, and signup visibility.',
  },
];

const facultyStep = (step) => ({
  cardPlacement: 'faculty-fixed',
  cardWidth: 360,
  cardHeight: 230,
  noSlide: true,
  ...step,
});

export const FACULTY_GUIDE_STEPS = [
  facultyStep({
    title: 'Faculty Navigation Bar',
    label: 'Top bar',
    icon: MdApps,
    selector: '[data-tour="module-navbar"]',
    body: 'The top bar keeps the guide, module selector, notifications, and profile controls together.',
  }),
  facultyStep({
    title: 'Quick Guide',
    label: 'Guide',
    icon: MdPlayArrow,
    selector: '[data-tour="guide"]',
    body: 'Use the book button whenever you want to replay this Faculty guide.',
  }),
  facultyStep({
    title: 'Module Selection',
    label: 'Modules',
    icon: MdApps,
    selector: '[data-tour="module-switcher"]',
    body: 'Return to the module selection screen without signing out.',
  }),
  facultyStep({
    title: 'Notifications',
    label: 'Updates',
    icon: FaBell,
    selector: '[data-tour="notifications"]',
    body: 'Open the bell to review Faculty schedule and system updates.',
  }),
  facultyStep({
    title: 'Profile Menu',
    label: 'Account',
    icon: FaUserCircle,
    selector: '[data-tour="profile"]',
    body: 'Manage your profile, password, theme, and sign-out action here.',
  }),
  facultyStep({
    title: 'Faculty Navigation',
    label: 'Sidebar',
    icon: MdApps,
    selector: '[data-tour="module-sidebar"]',
    body: 'The sidebar contains Faculty Tracker, Room Tracker, and Schedules in that order.',
  }),
  facultyStep({
    title: 'Faculty Tracker',
    label: 'Navigation',
    icon: MdPeople,
    selector: '[data-tour="faculty-tracker-nav"]',
    path: '/faculty',
    readySelector: '[data-tour="faculty-main"]',
    body: 'Open Faculty Tracker to check current faculty status and location.',
  }),
  facultyStep({
    title: 'Faculty Tracker Workspace',
    label: 'Main screen',
    icon: MdPeople,
    selector: '[data-tour="faculty-filters"], [data-tour="faculty-cards"]',
    path: '/faculty',
    body: 'Search faculty and open a card to inspect room, subject, and login details.',
  }),
  facultyStep({
    title: 'Room Tracker',
    label: 'Navigation',
    icon: MdMeetingRoom,
    selector: '[data-tour="faculty-rooms-nav"]',
    path: '/room-tracker',
    readySelector: '[data-tour="faculty-room-main"]',
    body: 'Open Room Tracker to review room availability and occupancy.',
  }),
  facultyStep({
    title: 'Room Tracker Workspace',
    label: 'Main screen',
    icon: MdMeetingRoom,
    selector: '[data-tour="faculty-filters"], [data-tour="faculty-room-ready"]',
    path: '/room-tracker',
    body: 'Search and filter rooms, then open a room card for its current details.',
  }),
  facultyStep({
    title: 'Schedules',
    label: 'Navigation',
    icon: MdUploadFile,
    selector: '[data-tour="faculty-schedules-nav"]',
    path: '/faculty-schedules',
    readySelector: '[data-tour="faculty-schedules-main"]',
    body: 'Open Schedules to view assigned classes and available schedule tools.',
  }),
  facultyStep({
    title: 'Schedules Workspace',
    label: 'Main screen',
    icon: MdUploadFile,
    selector: '[data-tour="faculty-schedule-controls"], [data-tour="faculty-tracker"]',
    path: '/faculty-schedules',
    body: 'Review your timetable. Authorized uploaders can also import, edit, activate, and archive schedules.',
  }),
];

export const STUDENT_GUIDE_STEPS = [
  {
    title: 'Top Navigation',
    label: 'Navbar',
    icon: MdApps,
    selector: '[data-tour="module-navbar"]',
    body: 'The top bar gives students quick access to the guide, module selection, notifications, and profile menu.',
  },
  {
    title: 'Replay The Guide',
    label: 'Book button',
    icon: MdPlayArrow,
    selector: '[data-tour="guide"]',
    body: 'Use the book button to replay this student guide anytime.',
  },
  {
    title: 'Module Switcher',
    label: 'Modules',
    icon: MdApps,
    selector: '[data-tour="module-switcher"]',
    body: 'Return to module selection anytime with this button.',
  },
  {
    title: 'Notifications',
    label: 'Updates',
    icon: FaBell,
    selector: '[data-tour="notifications"]',
    body: 'Student notifications are separate from admin and faculty notifications.',
  },
  {
    title: 'Profile Menu',
    label: 'Account',
    icon: FaUserCircle,
    selector: '[data-tour="profile"]',
    body: 'Use the profile menu for profile details, password changes, theme settings, and sign out.',
  },
  {
    title: 'Faculty Status',
    label: 'Live locator',
    icon: MdSchool,
    selector: '[data-tour="student-overview"]',
    body: 'The Student module focuses on faculty availability. It shows whether faculty are in class, available, or offline.',
  },
  {
    title: 'Search And Status',
    label: 'Filters',
    icon: FaSearch,
    selector: '[data-tour="student-filters"]',
    body: 'Search by name, subject, or department, then use the status dropdown to narrow the list.',
  },
  {
    title: 'Open A Faculty Card',
    label: 'Schedules',
    icon: MdEdit,
    selector: '[data-tour="student-cards"]',
    body: "Click a faculty card to view that faculty member's active schedule.",
  },
];

function QuickStartGuide({ open, onClose, user, onSelectModule, onSelectTab, steps: providedSteps, tourKey = 'default' }) {
  const navigate = useNavigate();
  const steps = useMemo(() => providedSteps?.length ? providedSteps : HOME_GUIDE_STEPS, [providedSteps]);
  const [stepIndex, setStepIndex] = useState(() => {
    try {
      const resume = JSON.parse(sessionStorage.getItem(`quickTourResume:${tourKey}`) || 'null');
      return Number.isInteger(resume?.stepIndex) ? resume.stepIndex : 0;
    } catch {
      return 0;
    }
  });
  const [targetRect, setTargetRect] = useState(null);
  const [extraRects, setExtraRects] = useState([]);
  const [targetStepIndex, setTargetStepIndex] = useState(-1);
  const [cardPosition, setCardPosition] = useState(getDefaultCardPosition);
  const [isChangingStep, setIsChangingStep] = useState(() => (
    Boolean(sessionStorage.getItem(`quickTourResume:${tourKey}`))
  ));
  const step = steps[stepIndex] || steps[0];
  const Icon = step?.icon || MdPlayArrow;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setCardPosition(getDefaultCardPosition());
    const fadeInTimer = window.setTimeout(() => setIsChangingStep(false), 120);
    return () => {
      window.clearTimeout(fadeInTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !step) return undefined;
    if (step.moduleId) onSelectModule?.(step.moduleId);
    if (step.tabId) onSelectTab?.(step.tabId);
    if (step.path && window.location.pathname !== step.path) {
      sessionStorage.setItem(`quickTourResume:${tourKey}`, JSON.stringify({ stepIndex }));
      navigate(step.path);
      return undefined;
    }
    setTargetRect(null);
    setExtraRects([]);
    setTargetStepIndex(-1);

    const updateTarget = () => {
      if (step.readySelector && !getElementRect(step.readySelector)) {
        setTargetRect(null);
        setExtraRects([]);
        setTargetStepIndex(-1);
        return;
      }

      const nextTargetRect = getElementRect(step.selector);
      const nextExtraRects = (step.extraSelectors || []).map((selector) => getElementRect(selector)).filter(Boolean);
      setTargetRect((previous) => (rectChanged(previous, nextTargetRect) ? nextTargetRect : previous));
      setExtraRects(nextExtraRects);
      setTargetStepIndex(stepIndex);
    };

    const timers = [0, step.tabId || step.moduleId || step.path ? 120 : 60, 260, 520].map((delay) => (
      window.setTimeout(updateTarget, delay)
    ));
    window.addEventListener('resize', updateTarget);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', updateTarget);
    };
  }, [navigate, onSelectModule, onSelectTab, open, step, stepIndex, tourKey]);

  useEffect(() => {
    if (!open) return;
    if (targetRect && targetStepIndex === stepIndex) setCardPosition(getSmartCardPosition(targetRect, step));
  }, [open, step, stepIndex, targetRect, targetStepIndex]);

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(0);
  }, [stepIndex, steps.length]);

  useEffect(() => {
    if (!open) return undefined;
    const updateCardPosition = () => setCardPosition(getSmartCardPosition(targetRect, step));
    window.addEventListener('resize', updateCardPosition);
    return () => window.removeEventListener('resize', updateCardPosition);
  }, [open, step, targetRect]);

  if (!open || !step) return null;

  const fixedSidebarCard = step.cardPlacement === 'sidebar-corner';
  const fixedFacultyCard = step.cardPlacement === 'faculty-fixed';
  const sidebarTourStep = fixedSidebarCard || step.cardPlacement === 'sidebar-intro';
  const navButtonStep = fixedSidebarCard;
  const safeRects = [
    buildSafeRect(targetStepIndex === stepIndex ? targetRect : null),
    ...(targetStepIndex === stepIndex
      ? extraRects.map((rect) => buildSafeRect(rect, step.extraPadding ?? 6, step.extraInset ?? 0))
      : []),
  ].filter(Boolean);
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const activeCardWidth = step.cardWidth || CARD_WIDTH;
  const activeCardMinHeight = step.cardHeight || CARD_MIN_HEIGHT;
  const targetReady = !isChangingStep && targetStepIndex === stepIndex && Boolean(targetRect);
  const activeCardMaxHeight = fixedSidebarCard
    ? SIDEBAR_CARD_HEIGHT
    : fixedFacultyCard
      ? step.cardHeight
      : Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN_HEIGHT, viewportHeight - 88));
  const cardLeft = clamp(cardPosition.left, 16, Math.max(16, viewportWidth - activeCardWidth - 16));
  const cardTop = clamp(cardPosition.top, 72, Math.max(72, viewportHeight - activeCardMaxHeight - 16));

  const closeGuide = () => {
    sessionStorage.removeItem(`quickTourResume:${tourKey}`);
    onClose();
    setStepIndex(0);
  };
  const shouldSoftResetStep = (currentStep, nextStep) => {
    if (!currentStep || !nextStep) return false;
    if (currentStep.cardPlacement === 'sidebar-corner' && nextStep.cardPlacement === 'sidebar-corner') return false;
    return currentStep.cardPlacement !== nextStep.cardPlacement || currentStep.path !== nextStep.path;
  };
  const goToStep = (nextIndex) => {
    const boundedIndex = clamp(nextIndex, 0, steps.length - 1);
    const nextStep = steps[boundedIndex];
    if (nextStep?.path && window.location.pathname !== nextStep.path) {
      setIsChangingStep(true);
      setTargetRect(null);
      setExtraRects([]);
      setTargetStepIndex(-1);
      sessionStorage.setItem(`quickTourResume:${tourKey}`, JSON.stringify({ stepIndex: boundedIndex }));
      navigate(nextStep.path);
      return;
    }
    if (shouldSoftResetStep(step, nextStep)) {
      setIsChangingStep(true);
      setTargetRect(null);
      setExtraRects([]);
      setTargetStepIndex(-1);
      window.setTimeout(() => {
        setStepIndex(boundedIndex);
        window.setTimeout(() => setIsChangingStep(false), 90);
      }, 120);
      return;
    }
    if (step.noSlide && nextStep?.noSlide) {
      setIsChangingStep(true);
      window.setTimeout(() => {
        setStepIndex(boundedIndex);
        window.setTimeout(() => setIsChangingStep(false), 70);
      }, 90);
      return;
    }
    setStepIndex(boundedIndex);
  };
  const goPrevious = () => goToStep(stepIndex - 1);
  const goNext = () => {
    if (isLast) {
      closeGuide();
      return;
    }
    goToStep(stepIndex + 1);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-950/45" />

      {safeRects.map((safeRect, index) => (
        <React.Fragment key={`${safeRect.top}-${safeRect.left}-${index}`}>
          <div
            className={`absolute rounded-lg border-2 bg-transparent ${
              step.noSlide
                ? 'transition-opacity duration-150 ease-out'
                : sidebarTourStep
                  ? 'transition-all duration-300 ease-out'
                  : 'transition-all duration-300'
            } ${
              index === 0 ? 'border-blue-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.45),0_0_0_4px_rgba(255,255,255,0.8),0_0_18px_rgba(37,99,235,0.9)]' : 'border-blue-300 shadow-[0_0_0_3px_rgba(255,255,255,0.65),0_0_16px_rgba(37,99,235,0.7)]'
            }`}
            style={{
              top: safeRect.top,
              left: safeRect.left,
              width: safeRect.width,
              height: safeRect.height,
              opacity: step.noSlide && isChangingStep ? 0 : 1,
            }}
          />
          <div
            className={`absolute rounded-lg border border-white/90 ${step.noSlide ? 'transition-opacity duration-150 ease-out' : ''}`}
            style={{
              top: safeRect.top + 3,
              left: safeRect.left + 3,
              width: Math.max(0, safeRect.width - 6),
              height: Math.max(0, safeRect.height - 6),
              opacity: step.noSlide && isChangingStep ? 0 : 1,
            }}
          />
        </React.Fragment>
      ))}

      <div
        className={`absolute flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
          step.noSlide
            ? 'transition-opacity duration-150 ease-out'
            : navButtonStep
              ? 'transition-[left,top,width,transform,box-shadow,opacity] duration-300 ease-out'
              : 'transition-[left,top,width,transform,box-shadow,opacity] duration-300 ease-out'
        } ${targetReady ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{
          top: cardTop,
          left: cardLeft,
          width: `min(calc(100vw - 2rem), ${activeCardWidth}px)`,
          minHeight: activeCardMinHeight,
          maxHeight: activeCardMaxHeight,
        }}
      >
        <div
          className={`flex items-start justify-between gap-3 border-b border-slate-100 px-4 ${fixedSidebarCard ? 'py-1.5' : 'py-2.5'}`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Quick Tour</p>
            <h2 className={`${fixedSidebarCard ? 'mt-0.5' : 'mt-1'} text-base font-bold text-slate-950`}>{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close guide"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-hidden px-4 ${fixedSidebarCard ? 'py-2.5' : 'py-2.5'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Step {stepIndex + 1} of {steps.length} - {step.label}
              </div>
              <p
                className={`${fixedSidebarCard ? 'mt-1.5 line-clamp-3 text-[13px] leading-5' : 'mt-1.5 text-[13px] leading-5'} text-slate-600`}
              >
                {step.body}
              </p>
              {user?.name && stepIndex === 0 && (
                <p className="mt-3 text-xs font-semibold text-slate-400">Signed in as {user.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className={`shrink-0 border-t border-slate-100 px-4 ${fixedSidebarCard ? 'py-1.5' : 'py-2'}`}>
          <div className={`${fixedSidebarCard ? 'mb-1' : 'mb-2'} flex justify-center gap-1`}>
            {steps.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                onClick={() => goToStep(index)}
                className={`h-1.5 rounded-full transition-all ${index === stepIndex ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`}
                aria-label={`Go to guide step ${index + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={isFirst}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <FaChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickStartGuide;
