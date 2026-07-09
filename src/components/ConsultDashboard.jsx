import React, { useMemo, useState } from "react";
import { CONSULT_SHIFTS } from "../lib/consult";
import { toISODate } from "../lib/date";
import { getLocalizedValue, translations } from "../lib/i18n";

export default function ConsultDashboard({ departments, doctors, assignments, language, isLoading = false }) {
  const copy = translations[language];
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("all");
  const now = new Date();
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const isToday = toISODate(now) === selectedDate;
  const currentHour = isToday ? now.getHours() : 9;

  const consultRows = useMemo(
    () => buildConsultRows(departments, doctors, assignments, selectedDate, selectedDateObject, currentHour, language),
    [departments, doctors, assignments, selectedDate, currentHour, language]
  );
  const visibleConsultRows = selectedDepartmentId === "all"
    ? consultRows
    : consultRows.filter((row) => row.department.id === selectedDepartmentId);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{copy.consultTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{copy.consultDescription}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
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
          <label className="grid gap-2 text-sm font-medium text-slate-600">
            <span>{copy.date}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-hospital-500 focus:ring-4 focus:ring-hospital-100"
            />
          </label>
        </div>
      </div>

      <div className="mt-5 overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">{copy.department}</th>
              {CONSULT_SHIFTS.map((shift) => (
                <th key={shift.key} className="px-4 py-3 font-semibold">{shift.label}</th>
              ))}
              <th className="px-4 py-3 font-semibold">{copy.now}</th>
              <th className="px-4 py-3 font-semibold">{copy.next}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-cyan-800">
                  <p className="font-semibold">
                    {language === "th" ? "กำลังเตรียมข้อมูลแพทย์รับปรึกษา" : "Preparing consult schedule"}
                  </p>
                  <p className="mt-1 text-sm">
                    {language === "th" ? "กรุณารอสักครู่ ระบบกำลังโหลดข้อมูลล่าสุด" : "Please wait while the latest data is loading."}
                  </p>
                </td>
              </tr>
            )}
            {!isLoading && visibleConsultRows.map((row) => (
              <tr key={row.department.id} className="align-top">
                <td className="px-4 py-3 font-semibold text-slate-950">{getLocalizedValue(row.department, "name", language)}</td>
                {row.assignments.map((assignment) => (
                  <td key={assignment.id} className="px-4 py-3">
                    {assignment.doctor ? (
                      <>
                        <p className="font-semibold text-slate-800">{getLocalizedValue(assignment.doctor, "name", language)}</p>
                        <p className="mt-1 text-xs text-slate-500">{assignment.timeLabel}</p>
                      </>
                    ) : (
                      <EmptyConsult timeLabel={assignment.timeLabel} language={language} />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3"><StatusPill assignment={row.current} language={language} /></td>
                <td className="px-4 py-3"><StatusPill assignment={row.next} language={language} muted /></td>
              </tr>
            ))}
            {!isLoading && visibleConsultRows.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  <p className="font-semibold">{copy.noConsultData}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyConsult({ timeLabel, language }) {
  return (
    <>
      <p className="font-semibold text-rose-700">{translations[language].noConsultant}</p>
      <p className="mt-1 text-xs text-rose-500">{timeLabel}</p>
    </>
  );
}

function StatusPill({ assignment, language, muted = false }) {
  if (!assignment?.doctor) {
    return (
      <div>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{translations[language].noConsultant}</span>
        {assignment && <p className="mt-1 text-xs text-rose-500">{assignment.timeLabel}</p>}
      </div>
    );
  }

  return (
    <div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${muted ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
        {getLocalizedValue(assignment.doctor, "name", language)}
      </span>
      <p className="mt-1 text-xs text-slate-500">{assignment.timeLabel}</p>
    </div>
  );
}

function buildConsultRows(departments, doctors, allAssignments, selectedDate, selectedDateObject, currentHour, language) {
  const timelineHour = currentHour < 7 ? currentHour + 24 : currentHour;

  return departments.map((department) => {
    const assignments = CONSULT_SHIFTS.map((shift) => {
      const savedAssignment = allAssignments.find(
        (assignment) => assignment.department_id === department.id
          && assignment.date === selectedDate
          && assignment.shift_key === shift.key
      );
      const doctor = savedAssignment?.doctor_id
        ? doctors.find((item) => item.id === savedAssignment.doctor_id)
        : null;
      const isCurrent = timelineHour >= shift.startHour && timelineHour < shift.endHour;

      return {
        ...shift,
        id: savedAssignment?.id || `${department.id}-${shift.key}`,
        doctor,
        isCurrent,
        timeLabel: formatConsultRange(selectedDateObject, shift.startHour, shift.endHour, language)
      };
    });

    const current = assignments.find((assignment) => assignment.isCurrent);
    const next = assignments.find((assignment) => !assignment.isCurrent && assignment.startHour > timelineHour) || assignments[0];
    return { department, assignments, current, next };
  });
}

function formatConsultRange(date, startHour, endHour, language) {
  const startDate = new Date(date);
  startDate.setHours(startHour, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(endHour % 24, 0, 0, 0);
  if (endHour >= 24) endDate.setDate(endDate.getDate() + 1);

  const locale = language === "th" ? "th-TH" : "en-US";
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const crossesDay = startDate.getDate() !== endDate.getDate();
  return `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}${crossesDay ? ` (${dateFormatter.format(endDate)})` : ""}`;
}
