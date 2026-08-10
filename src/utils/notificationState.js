const keyFor = (type, audience) => `stiLocatorNotifications:${type}:${audience}`;

export const notificationId = (notification) => (
  notification?.event_id
  || [notification?.audience, notification?.time, notification?.title].filter(Boolean).join('|')
);

export const getReadNotifications = (audience) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(keyFor('read', audience)) || '[]'));
  } catch {
    return new Set();
  }
};

export const getClearedNotifications = (audience) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(keyFor('cleared', audience)) || '[]'));
  } catch {
    return new Set();
  }
};

export const saveNotificationIds = (type, audience, ids) => {
  localStorage.setItem(keyFor(type, audience), JSON.stringify([...new Set(ids)].slice(-200)));
  window.dispatchEvent(new CustomEvent('notificationstatechange', { detail: { audience } }));
};

export const markNotificationsRead = (audience, ids) => {
  saveNotificationIds('read', audience, [...getReadNotifications(audience), ...ids]);
};

export const clearNotifications = (audience, ids) => {
  saveNotificationIds('cleared', audience, [...getClearedNotifications(audience), ...ids]);
  markNotificationsRead(audience, ids);
};

export const sortNotifications = (items) => [...items].sort((a, b) => {
  const aTime = new Date(a?.time || 0).getTime() || 0;
  const bTime = new Date(b?.time || 0).getTime() || 0;
  return bTime - aTime;
});
