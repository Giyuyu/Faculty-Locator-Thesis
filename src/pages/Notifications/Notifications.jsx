import React, { useEffect, useState } from 'react';
import { FaBell, FaCheckDouble, FaTrashAlt } from 'react-icons/fa';
import { MdArrowBack, MdApps } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
import logo from '../../assets/sti_logo.png';
import ProfileLink from '../../components/ProfileLink';
import { getNotificationAudience } from '../../utils/notifications';
import {
  clearNotifications,
  getClearedNotifications,
  getReadNotifications,
  markNotificationsRead,
  notificationId,
  sortNotifications,
} from '../../utils/notificationState';

const formatDateTime = (value) => {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? String(value || 'No timestamp') : date.toLocaleString();
};

function Notifications() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [, setStateVersion] = useState(0);
  const audience = getNotificationAudience(currentUser);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    setCurrentUser(JSON.parse(storedUser));
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return undefined;
    return onValue(ref(database, `notifications/${audience}`), (snapshot) => {
      const value = snapshot.val() || {};
      const history = Object.values(value.items || {});
      const latest = value.latest?.audience === audience ? value.latest : null;
      const combined = latest && !history.some((item) => notificationId(item) === notificationId(latest))
        ? [latest, ...history]
        : history;
      setItems(sortNotifications(combined.filter((item) => item?.audience === audience)));
    });
  }, [audience, currentUser]);

  const cleared = getClearedNotifications(audience);
  const read = getReadNotifications(audience);
  const visibleItems = items.filter((item) => !cleared.has(notificationId(item)));
  const filteredItems = filter === 'unread' ? visibleItems.filter((item) => !read.has(notificationId(item))) : visibleItems;
  const unreadIds = visibleItems.map(notificationId).filter((id) => id && !read.has(id));

  const markAll = () => {
    markNotificationsRead(audience, visibleItems.map(notificationId).filter(Boolean));
    setStateVersion((value) => value + 1);
  };
  const clearAll = () => {
    clearNotifications(audience, visibleItems.map(notificationId).filter(Boolean));
    setStateVersion((value) => value + 1);
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 pt-14 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Go back"><MdArrowBack className="h-5 w-5" /></button>
            <img src={logo} alt="STI Locator" className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold sm:block">STI Locator</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/home" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Modules"><MdApps className="h-5 w-5" /></Link>
            <ProfileLink user={currentUser} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Activity center</p>
            <h1 className="mt-1 text-3xl font-bold">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Updates for your {audience} account are kept separate from other roles.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={markAll} disabled={!unreadIds.length} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-blue-950"><FaCheckDouble /> Mark all read</button>
            <button type="button" onClick={clearAll} disabled={!visibleItems.length} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><FaTrashAlt /> Clear all</button>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex gap-2">
              {['all', 'unread'].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${filter === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{value}</button>)}
            </div>
            <span className="text-xs text-slate-500">{filteredItems.length} items</span>
          </div>

          {filteredItems.length ? filteredItems.map((notification) => {
            const id = notificationId(notification);
            const unread = !read.has(id);
            return (
              <article key={id} className={`flex gap-4 border-b border-slate-100 px-5 py-5 last:border-0 dark:border-slate-800 ${unread ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950"><FaBell /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-semibold text-slate-950 dark:text-white">{notification.title || 'System update'}</h2>
                    <time className="text-xs text-slate-400">{formatDateTime(notification.time)}</time>
                  </div>
                  {notification.message && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>}
                  <p className="mt-2 text-xs text-slate-500">{audience === 'student' ? 'Posted by' : 'Updated by'}: {notification.name || 'System'}</p>
                </div>
              </article>
            );
          }) : (
            <div className="px-6 py-16 text-center">
              <FaBell className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold">No {filter === 'unread' ? 'unread ' : ''}notifications</p>
              <p className="mt-1 text-sm text-slate-500">New updates will appear here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Notifications;
