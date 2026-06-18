import React, { Fragment } from "react";
import { getWeekDays, hourKeys, toISODate } from "../lib/date";
import { formatLocalizedDate, getLocalizedValue, translations } from "../lib/i18n";

export default function WeeklyCalendarModal({ doctor, schedules, onClose, language }) {
  if (!doctor) return null;

  const copy = translations[language];
  const days = getWeekDays(new Date());
  const byDate = Object.fromEntries(schedules.map((schedule) => [schedule.date, schedule]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">{copy.weeklyScheduleTitle}</h2>
            <p className="mt-2 text-base font-semibold text-slate-700">{getLocalizedValue(doctor, "name", language)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {copy.close}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-5">
          <div className="grid min-w-[760px] grid-cols-[72px_repeat(7,minmax(86px,1fr))] gap-1">
            <div />
            {days.map((day) => (
              <div key={toISODate(day)} className="rounded-xl bg-slate-50 p-2 text-center text-xs font-semibold text-slate-600">
                {formatLocalizedDate(day, language, { weekday: "short", day: "numeric", month: "short" })}
              </div>
            ))}
            {hourKeys.map((hourKey, hour) => (
              <Fragment key={hourKey}>
                <div className="py-1.5 text-xs font-medium text-slate-500">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {days.map((day) => {
                  const date = toISODate(day);
                  const active = Boolean(byDate[date]?.[hourKey]);
                  return (
                    <div
                      key={`${date}-${hourKey}`}
                      className={`h-7 rounded-lg border ${active ? "border-emerald-200 bg-emerald-500" : "border-slate-200 bg-slate-100"}`}
                      title={`${date} ${hourKey}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
