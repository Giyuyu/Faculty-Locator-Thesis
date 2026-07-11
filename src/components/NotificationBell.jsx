import React, { useEffect, useState } from 'react';
import { FaBell } from 'react-icons/fa';
import { onValue, ref } from 'firebase/database';

const formatDateTime = (value) => {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const READ_NOTIFICATION_KEY = 'stiLocatorLastReadNotification';

const getNotificationKey = (notification) => {
  if (!notification) return '';
  return [
    notification.time || '',
    notification.import_batch_id || '',
    notification.deleted_import_batch_id || '',
    notification.name || '',
  ].join('|');
};

function NotificationBell({ database, audience = 'staff' }) {
  const [open, setOpen] = useState(false);
  const [lastScheduleUpdate, setLastScheduleUpdate] = useState(null);
  const readNotificationKey = `${READ_NOTIFICATION_KEY}:${audience}`;
  const [lastReadNotification, setLastReadNotification] = useState(() => (
    localStorage.getItem(`${READ_NOTIFICATION_KEY}:${audience}`) || ''
  ));

  useEffect(() => {
    const unsubscribe = onValue(ref(database, 'lastScheduleUpdate'), (snapshot) => {
      setLastScheduleUpdate(snapshot.val() || null);
    });

    return () => unsubscribe();
  }, [database]);

  const isStudent = audience === 'student';
  const title = lastScheduleUpdate?.deleted_import_batch_id
    ? (isStudent ? 'Faculty schedule removed' : 'Schedule upload deleted')
    : (isStudent ? 'Faculty schedule updated' : 'Schedule updated');
  const notificationKey = getNotificationKey(lastScheduleUpdate);
  const hasUnreadNotification = Boolean(notificationKey && notificationKey !== lastReadNotification);

  const toggleNotifications = () => {
    setOpen((value) => !value);
    if (notificationKey) {
      localStorage.setItem(readNotificationKey, notificationKey);
      setLastReadNotification(notificationKey);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleNotifications}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <FaBell className="h-4 w-4" />
        {hasUnreadNotification && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-md border border-slate-200 bg-white py-2 text-sm text-slate-700 shadow-xl">
          <div className="border-b border-slate-100 px-4 pb-2">
            <p className="font-semibold text-slate-950">Notifications</p>
            <p className="mt-0.5 text-xs text-slate-500">{isStudent ? 'Faculty schedule updates' : 'Latest system updates'}</p>
          </div>

          {lastScheduleUpdate ? (
            <div className="px-4 py-3">
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(lastScheduleUpdate.time)}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>{isStudent ? 'Posted by' : 'Updated by'}: {lastScheduleUpdate.name || 'System'}</p>
                {!isStudent && lastScheduleUpdate.import_batch_id && <p>Upload batch: {lastScheduleUpdate.import_batch_id}</p>}
                {!isStudent && lastScheduleUpdate.deleted_import_batch_id && <p>Deleted upload: {lastScheduleUpdate.deleted_import_batch_id}</p>}
                {isStudent && <p>Open a faculty card to view the latest schedule.</p>}
              </div>
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-slate-500">
              No schedule notifications yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
