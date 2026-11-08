import React, { useMemo, useState } from 'react';
import { getScheduleDayOrder, getScheduleTimeOrder } from '../utils/scheduleDisplay';

function ScheduleDayView({
  schedules = [],
  emptyMessage = 'No schedule is assigned.',
  kiosk = false,
}) {
  const [selectedDay, setSelectedDay] = useState('');
  const dayGroups = useMemo(() => {
    const groups = schedules.reduce((result, schedule) => {
      const day = schedule.day || 'Unspecified';
      if (!result[day]) result[day] = [];
      result[day].push(schedule);
      return result;
    }, {});

    return Object.entries(groups)
      .map(([day, rows]) => ({
        day,
        schedules: [...rows].sort((a, b) => getScheduleTimeOrder(a.startTime) - getScheduleTimeOrder(b.startTime)),
      }))
      .sort((a, b) => getScheduleDayOrder(a.day) - getScheduleDayOrder(b.day));
  }, [schedules]);

  const activeGroup = dayGroups.find((group) => group.day === selectedDay) || dayGroups[0];

  if (!activeGroup) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900/30">
      <div
        className="flex gap-2 overflow-x-auto pb-3"
        role="tablist"
        aria-label="Schedule days"
      >
        {dayGroups.map((group) => {
          const isActive = group.day === activeGroup.day;
          return (
            <button
              key={group.day}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedDay(group.day)}
              className={`flex shrink-0 items-center gap-2 rounded-md border font-semibold transition-colors ${kiosk ? 'min-h-12 px-5 py-3 text-base' : 'px-4 py-2 text-sm'} ${
                isActive
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              {group.day}
              <span className={`inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                {group.schedules.length}
              </span>
            </button>
          );
        })}
      </div>

      <section className="border-t border-slate-200 pt-4 dark:border-slate-700" aria-label={`${activeGroup.day} classes`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className={`font-semibold text-slate-900 dark:text-white ${kiosk ? 'text-lg' : ''}`}>{activeGroup.day}</h4>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {activeGroup.schedules.length} {activeGroup.schedules.length === 1 ? 'class' : 'classes'}
          </span>
        </div>

        <div className="space-y-2">
          {activeGroup.schedules.map((schedule, index) => (
            <div
              key={schedule.scheduleId || `${schedule.day}-${schedule.startTime}-${index}`}
              className={`grid gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${kiosk ? 'py-5' : 'py-4'} sm:grid-cols-[150px_minmax(0,1fr)_100px_100px] sm:items-center`}
            >
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 sm:hidden dark:text-slate-500">Time</p>
                <p className={`whitespace-nowrap font-semibold text-blue-700 dark:text-blue-300 ${kiosk ? 'text-base' : 'text-sm'}`}>
                  {schedule.startTime} - {schedule.endTime}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400 sm:hidden dark:text-slate-500">Subject</p>
                <p className={`truncate font-semibold text-slate-900 dark:text-white ${kiosk ? 'text-base' : ''}`}>{schedule.subject}</p>
                {schedule.courseCode && <p className="mt-1 text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">{schedule.courseCode}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Section</p>
                <p className={`mt-0.5 text-slate-700 dark:text-slate-200 ${kiosk ? 'text-base' : 'text-sm'}`}>{schedule.section}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Room</p>
                <p className={`mt-0.5 font-medium text-slate-700 dark:text-slate-200 ${kiosk ? 'text-base' : 'text-sm'}`}>{schedule.room}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ScheduleDayView;
