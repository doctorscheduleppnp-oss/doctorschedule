import React from "react";
import { hourKeys } from "../lib/date";
import { getLocalizedValue, translations } from "../lib/i18n";
import { Icon } from "./icons";

export default function DoctorCard({ doctor, schedule, onOpenWeekly, language }) {
  const copy = translations[language];
  const doctorName = getLocalizedValue(doctor, "name", language);
  const specialty = getLocalizedValue(doctor, "specialty", language);
  const currentHour = new Date().getHours();
  const status = getShiftStatus(schedule, currentHour, copy);
  const shiftTimeText = getShiftTimeText(schedule);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex gap-4">
        <img
          src={doctor.image_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(doctorName)}`}
          alt={doctorName}
          className="h-20 w-20 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start gap-2">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${status.dotClass}`} />
            <span className={`text-xs font-semibold leading-tight ${status.textClass}`}>
              {status.label}
            </span>
          </div>
          <h3 className="truncate text-lg font-semibold text-slate-950">{doctorName}</h3>
          <p className="mt-1 text-sm text-slate-500">{specialty || copy.generalPractice}</p>
          {shiftTimeText && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
              <p className="text-sm font-semibold">{copy.clinicHours} {shiftTimeText}</p>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenWeekly(doctor)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-hospital-700 focus:outline-none focus:ring-4 focus:ring-hospital-100"
      >
        <Icon name="calendar" />
        <span>{copy.weeklySchedule}</span>
      </button>
    </article>
  );
}

function getShiftStatus(schedule, currentHour, copy) {
  const activeHours = hourKeys
    .map((key, index) => (schedule?.[key] ? index : null))
    .filter((value) => value !== null);

  if (!activeHours.length) {
    return {
      label: copy.noClinicToday,
      dotClass: "bg-slate-300",
      textClass: "text-slate-500"
    };
  }

  if (activeHours.includes(currentHour)) {
    return {
      label: copy.inClinic,
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-700"
    };
  }

  if (activeHours.some((hour) => hour > currentHour)) {
    return {
      label: copy.laterToday,
      dotClass: "bg-sky-500",
      textClass: "text-sky-700"
    };
  }

  return {
    label: copy.finishedToday,
    dotClass: "bg-slate-400",
    textClass: "text-slate-600"
  };
}

function getShiftTimeText(schedule) {
  if (!schedule) return "";

  const ranges = [];
  let startHour = null;

  hourKeys.forEach((hourKey, index) => {
    const active = Boolean(schedule[hourKey]);
    const isLast = index === hourKeys.length - 1;

    if (active && startHour === null) startHour = index;

    if (startHour !== null && (!active || isLast)) {
      const endHour = active && isLast ? index + 1 : index;
      ranges.push(`${formatHour(startHour)} - ${formatHour(endHour)}`);
      startHour = null;
    }
  });

  return ranges.join(", ");
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}
