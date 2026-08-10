import { ref, update } from 'firebase/database';

export const getNotificationAudience = (user) => {
  const roleIds = Array.isArray(user?.roleIds) ? user.roleIds : [];
  if (user?.userType === 'admin' || roleIds.includes('admin')) return 'admin';
  if (user?.userType === 'faculty' || roleIds.includes('faculty')) return 'faculty';
  return 'student';
};

const getScheduleAction = (payload) => {
  if (payload.deleted_import_batch_id || payload.deleted_archived_import_batch_id) return 'deleted';
  if (payload.archived_import_batch_id) return 'archived';
  if (payload.restored_import_batch_id) return 'restored';
  if (payload.active_import_batch_id) return 'activated';
  return 'updated';
};

const getAudienceCopy = (audience, action) => {
  const titles = {
    admin: {
      updated: 'Schedule updated',
      activated: 'Active schedule changed',
      archived: 'Schedule upload archived',
      restored: 'Schedule upload restored',
      deleted: 'Schedule upload deleted',
    },
    faculty: {
      updated: 'Faculty schedule updated',
      activated: 'Active faculty schedule changed',
      archived: 'Faculty schedule archived',
      restored: 'Faculty schedule restored',
      deleted: 'Faculty schedule removed',
    },
    student: {
      updated: 'Faculty availability updated',
      activated: 'Current faculty schedule changed',
      archived: 'Faculty schedule availability changed',
      restored: 'Faculty schedule availability restored',
      deleted: 'Faculty schedule availability changed',
    },
  };

  const messages = {
    admin: 'Review the latest schedule activity and upload details.',
    faculty: 'Review your assigned classes in the Schedules page.',
    student: 'Open a faculty card to view the latest available schedule.',
  };

  return {
    title: titles[audience][action] || titles[audience].updated,
    message: messages[audience],
  };
};

export const publishScheduleNotification = async (database, payload) => {
  const action = getScheduleAction(payload);
  const eventId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const updates = {
    lastScheduleUpdate: payload,
  };

  ['admin', 'faculty', 'student'].forEach((audience) => {
    const copy = getAudienceCopy(audience, action);
    const notification = {
      ...payload,
      ...copy,
      audience,
      event_id: eventId,
      action,
    };
    updates[`notifications/${audience}/latest`] = notification;
    updates[`notifications/${audience}/items/${eventId}`] = notification;
  });

  await update(ref(database), updates);
};
