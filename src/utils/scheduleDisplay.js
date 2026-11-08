const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const getScheduleDayOrder = (day) => {
  const index = weekdayOrder.findIndex((weekday) => weekday.toLowerCase() === String(day || '').toLowerCase());
  return index === -1 ? weekdayOrder.length : index;
};

export const getScheduleTimeOrder = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  return (hours * 60) + minutes;
};

export const sortSchedulesByDayAndTime = (schedules) => [...schedules].sort((a, b) => (
  getScheduleDayOrder(a.day) - getScheduleDayOrder(b.day)
  || getScheduleTimeOrder(a.startTime) - getScheduleTimeOrder(b.startTime)
));
