import React, { useState } from "react";
import DoctorCard from "./DoctorCard";
import { getStartOfWeek, getWeekDays, hourKeys, toISODate } from "../lib/date";
import { formatLocalizedDate, getLocalizedValue, translations } from "../lib/i18n";
import { doctorBelongsToDepartment } from "../lib/doctorDepartments";

export default function PublicDashboard({
  departments,
  doctors,
  schedules,
  weeklyChanges = [],
  selectedDepartmentId,
  setSelectedDepartmentId,
  onOpenWeekly,
  language,
  isLoading = false
}) {
  const [doctorSearch, setDoctorSearch] = useState("");
  const copy = translations[language];
  const today = toISODate(new Date());
  const weekDateSet = new Set(getWeekDays(getStartOfWeek(new Date())).map(toISODate));
  const todayByDoctor = Object.fromEntries(
    schedules.filter((schedule) => schedule.date === today).map((schedule) => [schedule.doctor_id, schedule])
  );
  const weeklySchedulesByDoctor = schedules.reduce((map, schedule) => {
    if (!weekDateSet.has(schedule.date)) return map;
    if (!map[schedule.doctor_id]) map[schedule.doctor_id] = [];
    map[schedule.doctor_id].push(schedule);
    return map;
  }, {});
  const currentHour = new Date().getHours();
  const normalizedSearch = normalizeSearchText(doctorSearch);
  const isSearching = normalizedSearch.length > 0;

  const visibleDoctors = doctors
    .filter((doctor) => {
      const departmentMatch = selectedDepartmentId === "all" || doctorBelongsToDepartment(doctor, selectedDepartmentId);
      const hasToday = hourKeys.some((key) => todayByDoctor[doctor.id]?.[key]);
      const searchMatch = !isSearching || getDoctorSearchText(doctor).includes(normalizedSearch);
      return departmentMatch && searchMatch && (isSearching || hasToday);
    })
    .sort((doctorA, doctorB) => {
      const statusA = getScheduleSortStatus(todayByDoctor[doctorA.id], currentHour);
      const statusB = getScheduleSortStatus(todayByDoctor[doctorB.id], currentHour);
      if (statusA.rank !== statusB.rank) return statusA.rank - statusB.rank;
      if (statusA.hour !== statusB.hour) return statusA.hour - statusB.hour;
      return getLocalizedValue(doctorA, "name", language).localeCompare(
        getLocalizedValue(doctorB, "name", language),
        language === "th" ? "th" : "en"
      );
    });
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{copy.todayTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{copy.todayDescription}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,auto)] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-slate-600">
            <span>{copy.doctorSearch}</span>
            <input
              type="search"
              value={doctorSearch}
              onChange={(event) => setDoctorSearch(event.target.value)}
              placeholder={copy.doctorSearchPlaceholder}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-hospital-500 focus:ring-4 focus:ring-hospital-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-600">
            <span>{copy.department}</span>
            <select
              value={selectedDepartmentId}
              onChange={(event) => setSelectedDepartmentId(event.target.value)}
              className="min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-hospital-500 focus:ring-4 focus:ring-hospital-100"
            >
              <option value="all">{copy.allDepartments}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{getLocalizedValue(department, "name", language)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-center text-cyan-900">
          <p className="font-semibold">
            {language === "th" ? "กำลังเตรียมข้อมูลตารางแพทย์" : "Preparing doctor schedule"}
          </p>
          <p className="mt-1 text-sm text-cyan-800">
            {language === "th" ? "กรุณารอสักครู่ ระบบกำลังโหลดข้อมูลล่าสุด" : "Please wait while the latest data is loading."}
          </p>
        </div>
      ) : (
        <WeeklyChangeNote changes={weeklyChanges} language={language} />
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && visibleDoctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            schedule={todayByDoctor[doctor.id]}
            scheduleNote={getNextClinicNote(weeklySchedulesByDoctor[doctor.id] || [], today, language, copy)}
            onOpenWeekly={onOpenWeekly}
            language={language}
          />
        ))}
        {!isLoading && visibleDoctors.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            <p className="font-semibold">{isSearching ? copy.noDoctorSearchResults : copy.noDoctors}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getDoctorSearchText(doctor) {
  return normalizeSearchText([
    doctor.name,
    doctor.name_th,
    doctor.name_en,
    doctor.specialty,
    doctor.specialty_th,
    doctor.specialty_en
  ].filter(Boolean).join(" "));
}

function getNextClinicNote(weeklySchedules, today, language, copy) {
  const upcoming = weeklySchedules
    .filter((schedule) => schedule.date >= today && hourKeys.some((key) => schedule[key]))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!upcoming) return copy.noClinicThisWeek;

  const dateText = formatLocalizedDate(new Date(`${upcoming.date}T00:00:00`), language, {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  return `${copy.nextClinic}: ${dateText} ${getScheduleHours(upcoming)}`;
}

function getScheduleHours(schedule) {
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

function getScheduleSortStatus(schedule, currentHour) {
  const activeHours = hourKeys
    .map((key, index) => (schedule?.[key] ? index : null))
    .filter((value) => value !== null);

  if (!activeHours.length) return { rank: 3, hour: 99 };
  if (activeHours.includes(currentHour)) return { rank: 0, hour: currentHour };

  const nextHour = activeHours.find((hour) => hour > currentHour);
  if (nextHour !== undefined) return { rank: 1, hour: nextHour };

  return { rank: 2, hour: activeHours[activeHours.length - 1] };
}

function WeeklyChangeNote({ changes, language }) {
  const [showAll, setShowAll] = useState(false);
  const copy = translations[language];
  const formatter = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const visibleChanges = changes.slice(0, 3);
  const hiddenCount = Math.max(changes.length - visibleChanges.length, 0);

  return (
    <>
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-amber-950 sm:text-base">
              {copy.scheduleUpdates} {changes.length} {copy.itemUnit}
            </h2>
            <p className="mt-1 text-xs text-amber-800 sm:text-sm">
              {changes.length
                ? `${copy.latest}: ${visibleChanges.map((change) => getLocalizedValue(change.doctor, "name", language)).join(", ")}`
                : copy.noUpdates}
            </p>
          </div>
          {changes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 sm:hidden"
            >
              {copy.viewAll} {changes.length} {copy.itemUnit}
            </button>
          )}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="hidden rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 sm:inline-flex"
            >
              {copy.viewAll} {changes.length} {copy.itemUnit}
            </button>
          )}
        </div>

        {changes.length ? (
          <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2">
            {visibleChanges.map((change) => (
              <ChangeItem key={change.doctorId} change={change} formatter={formatter} language={language} />
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-xl border border-dashed border-amber-300 bg-white/60 p-3 text-left text-sm font-semibold text-amber-800 hover:bg-white"
              >
                {hiddenCount} {copy.moreItems}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 hidden rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-sm text-amber-800 sm:block">
            {copy.noUpdates}
          </div>
        )}
      </div>

      {showAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">{copy.allUpdates}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {copy.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="grid gap-3">
                {changes.map((change) => (
                  <ChangeItem key={change.doctorId} change={change} formatter={formatter} language={language} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChangeItem({ change, formatter, language }) {
  const copy = translations[language];
  return (
    <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
      <p className="font-semibold text-slate-950">{getLocalizedValue(change.doctor, "name", language)}</p>
      <p className="mt-0.5 text-sm text-slate-500">{getLocalizedValue(change.doctor, "specialty", language) || copy.generalPractice}</p>
      <p className="mt-2 text-sm text-slate-700">
        {copy.changedDates}: {change.dates.map((date) => formatLocalizedDate(new Date(`${date}T00:00:00`), language, { weekday: "short", day: "numeric", month: "short" })).join(", ")}
      </p>
      <p className="mt-1 text-xs font-medium text-amber-700">
        {copy.lastUpdated} {formatter.format(new Date(change.lastUpdatedAt))}
      </p>
    </div>
  );
}
