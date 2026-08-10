import React, { useEffect, useRef, useState } from 'react';
import { FaBell, FaCheckDouble, FaTrashAlt } from 'react-icons/fa';
import { onValue, ref } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import {
  clearNotifications,
  getClearedNotifications,
  getReadNotifications,
  markNotificationsRead,
  notificationId,
  sortNotifications,
} from '../utils/notificationState';

const formatDateTime = (value) => {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

function NotificationBell({ database, audience = 'staff' }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const normalizedAudience = ['admin', 'faculty', 'student'].includes(audience) ? audience : 'admin';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [, setStateVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onValue(ref(database, `notifications/${normalizedAudience}`), (snapshot) => {
      const value = snapshot.val() || {};
      const history = Object.values(value.items || {});
      const latest = value.latest?.audience === normalizedAudience ? value.latest : null;
      const combined = latest && !history.some((item) => notificationId(item) === notificationId(latest))
        ? [latest, ...history]
        : history;
      setItems(sortNotifications(combined.filter((item) => item?.audience === normalizedAudience)));
    });
    return () => unsubscribe();
  }, [database, normalizedAudience]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const refreshState = (event) => {
      if (!event.detail?.audience || event.detail.audience === normalizedAudience) {
        setStateVersion((value) => value + 1);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('notificationstatechange', refreshState);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('notificationstatechange', refreshState);
    };
  }, [normalizedAudience]);

  const cleared = getClearedNotifications(normalizedAudience);
  const visibleItems = items.filter((item) => !cleared.has(notificationId(item)));
  const read = getReadNotifications(normalizedAudience);
  const unreadIds = visibleItems.map(notificationId).filter((id) => id && !read.has(id));

  const markAllRead = () => {
    markNotificationsRead(normalizedAudience, visibleItems.map(notificationId).filter(Boolean));
    setStateVersion((value) => value + 1);
  };

  const clearAll = () => {
    clearNotifications(normalizedAudience, visibleItems.map(notificationId).filter(Boolean));
    setStateVersion((value) => value + 1);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <FaBell className="h-4 w-4" />
        {unreadIds.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-slate-200 bg-white text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">Notifications</p>
              <p className="mt-0.5 text-xs text-slate-500">{unreadIds.length ? `${unreadIds.length} unread` : 'You are all caught up'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={markAllRead} disabled={!unreadIds.length} className="rounded-md p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:hover:bg-blue-950" title="Mark all as read" aria-label="Mark all as read"><FaCheckDouble /></button>
              <button type="button" onClick={clearAll} disabled={!visibleItems.length} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Clear notifications" aria-label="Clear notifications"><FaTrashAlt /></button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleItems.length ? visibleItems.slice(0, 5).map((notification) => {
              const id = notificationId(notification);
              const unread = !read.has(id);
              return (
                <div key={id} className={`border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 ${unread ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''}`}>
                  <div className="flex gap-3">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-900 dark:text-white">{notification.title || 'System update'}</p>
                      {notification.message && <p className="mt-1 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.message}</p>}
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.time)}</p>
                    </div>
                  </div>
                </div>
              );
            }) : <div className="px-4 py-8 text-center text-slate-500">No notifications to display.</div>}
          </div>

          <button
            type="button"
            onClick={() => { markAllRead(); setOpen(false); navigate('/notifications'); }}
            className="w-full border-t border-slate-100 px-4 py-3 text-center font-semibold text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950"
          >
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
