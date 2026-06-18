import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { formatThaiDate, getStartOfWeek, getWeekDays, hourKeys, makeEmptySchedule, toISODate } from "../lib/date";
import { exportTableToExcel } from "../lib/excelExport";
import { getLocalizedValue } from "../lib/i18n";
import { Icon } from "./icons";

export default function AdminScheduler({ departments, doctors, schedules, onSaveSchedules, onCopyMonth, canExport = false }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "");
  const [weekStart, setWeekStart] = useState(toISODate(getStartOfWeek(new Date())));
  const [exportStartDate, setExportStartDate] = useState(() => getCurrentMonthRange().start);
  const [exportEndDate, setExportEndDate] = useState(() => getCurrentMonthRange().end);
  const [draftSchedules, setDraftSchedules] = useState({});
  const dragValueRef = useRef(null);

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId);
  const selectedDepartment = departments.find((department) => department.id === selectedDoctor?.department_id);
  const weekDays = useMemo(() => getWeekDays(new Date(`${weekStart}T00:00:00`)), [weekStart]);

  useEffect(() => {
    if (!doctors.length) {
      setSelectedDoctorId("");
      setDraftSchedules({});
      return;
    }
    if (!doctors.some((doctor) => doctor.id === selectedDoctorId)) {
      setSelectedDoctorId(doctors[0].id);
      setDraftSchedules({});
    }
  }, [doctors, selectedDoctorId]);

  const scheduleMap = useMemo(() => {
    const map = {};
    schedules
      .filter((schedule) => schedule.doctor_id === selectedDoctorId)
      .forEach((schedule) => {
        map[schedule.date] = schedule;
      });
    return map;
  }, [schedules, selectedDoctorId]);

  function getSchedule(date) {
    const key = toISODate(date);
    return draftSchedules[key] || scheduleMap[key] || makeEmptySchedule(selectedDoctorId, date);
  }

  function setSlot(date, hourKey, value) {
    const dateKey = toISODate(date);
    setDraftSchedules((current) => {
      const base = current[dateKey] || scheduleMap[dateKey] || makeEmptySchedule(selectedDoctorId, date);
      return {
        ...current,
        [dateKey]: { ...base, [hourKey]: value }
      };
    });
  }

  function toggleSlot(date, hourKey) {
    const nextValue = !getSchedule(date)[hourKey];
    dragValueRef.current = nextValue;
    setSlot(date, hourKey, nextValue);
  }

  function applyDrag(date, hourKey) {
    if (dragValueRef.current !== null) {
      setSlot(date, hourKey, dragValueRef.current);
    }
  }

  async function saveChanges() {
    if (!selectedDoctorId) return;
    const rows = Object.values(draftSchedules).filter((draft) => {
      const saved = scheduleMap[draft.date] || makeEmptySchedule(selectedDoctorId, new Date(`${draft.date}T00:00:00`));
      return hourKeys.some((hour) => Boolean(draft[hour]) !== Boolean(saved[hour]));
    });
    await onSaveSchedules(rows);
    setDraftSchedules({});
  }

  async function copyToNextWeek() {
    if (!selectedDoctorId) return;
    const nextWeekRows = weekDays.map((date) => {
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 7);
      const source = getSchedule(date);
      return {
        ...makeEmptySchedule(selectedDoctorId, nextDate),
        ...Object.fromEntries(hourKeys.map((hour) => [hour, source[hour]]))
      };
    });
    await onSaveSchedules(nextWeekRows);
  }

  async function copyMonthToNextMonth() {
    if (!selectedDoctorId) return;
    await onCopyMonth(selectedDoctorId, new Date(`${weekStart}T00:00:00`));
  }

  const exportRows = useMemo(() => {
    if (!selectedDoctor) return [];
    return schedules
      .filter((schedule) => schedule.doctor_id === selectedDoctor.id
        && schedule.date >= exportStartDate
        && schedule.date <= exportEndDate
        && hourKeys.some((key) => schedule[key]))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((schedule) => ({
        date: formatExportDate(schedule.date),
        department: getLocalizedValue(selectedDepartment, "name", "th"),
        doctor: getLocalizedValue(selectedDoctor, "name", "th"),
        specialty: getLocalizedValue(selectedDoctor, "specialty", "th"),
        hours: getScheduleHours(schedule),
        totalHours: String(hourKeys.filter((key) => schedule[key]).length)
      }));
  }, [exportEndDate, exportStartDate, schedules, selectedDepartment, selectedDoctor]);

  function exportDoctorSchedule() {
    if (!selectedDoctor || !exportRows.length) return;
    const totalHours = exportRows.reduce((sum, row) => sum + Number(row.totalHours), 0);
    exportTableToExcel({
      title: "ตารางเวรแพทย์สำหรับคำนวณค่าตอบแทน",
      sheetName: "ตารางเวรแพทย์",
      fileName: `doctor-schedule-${selectedDoctor.id}-${exportStartDate}-${exportEndDate}`,
      metadata: `${getLocalizedValue(selectedDoctor, "name", "th")} | ${formatExportDate(exportStartDate)} - ${formatExportDate(exportEndDate)} | รวม ${totalHours} ชั่วโมง`,
      columns: [
        { key: "date", header: "วันที่", width: 18 },
        { key: "department", header: "แผนก", width: 28 },
        { key: "doctor", header: "แพทย์", width: 28 },
        { key: "specialty", header: "ความเชี่ยวชาญ", width: 32 },
        { key: "hours", header: "เวลาออกตรวจ", width: 26 },
        { key: "totalHours", header: "จำนวนชั่วโมง", width: 16 }
      ],
      rows: [
        ...exportRows,
        { date: "รวม", department: "", doctor: "", specialty: "", hours: "", totalHours: String(totalHours) }
      ]
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Advanced Slot Management</h2>
          <p className="mt-2 text-sm text-slate-500">
            คลิกหรือลากเพื่อเปิด/ปิดเวลาตรวจ แล้วบันทึกแบบ upsert ตามแพทย์และวันที่
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={selectedDoctorId}
            disabled={!doctors.length}
            onChange={(event) => {
              setSelectedDoctorId(event.target.value);
              setDraftSchedules({});
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          >
            {!doctors.length && <option value="">ยังไม่มีแพทย์</option>}
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={weekStart}
            onChange={(event) => {
              setWeekStart(toISODate(getStartOfWeek(new Date(`${event.target.value}T00:00:00`))));
              setDraftSchedules({});
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <button
            type="button"
            onClick={saveChanges}
            disabled={!selectedDoctorId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hospital-700"
          >
            <Icon name="save" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="text-sm text-slate-500">
          แพทย์: <span className="font-semibold text-slate-900">{selectedDoctor?.name || "-"}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copyToNextWeek}
            disabled={!selectedDoctorId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="copy" />
            คัดลอกตารางนี้ไปสัปดาห์ถัดไป
          </button>
          <button
            type="button"
            onClick={copyMonthToNextMonth}
            disabled={!selectedDoctorId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-hospital-200 px-4 py-2.5 text-sm font-semibold text-hospital-700 hover:bg-hospital-50"
          >
            <Icon name="copy" />
            คัดลอกตามวันสัปดาห์ไปเดือนหน้า
          </button>
        </div>
      </div>

      {canExport && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="font-semibold text-emerald-950">Export Excel สำหรับคำนวณค่าตอบแทน</h3>
              <p className="mt-1 text-sm text-emerald-800">เลือกแพทย์ด้านบนและช่วงวันที่ โดยค่าเริ่มต้นเป็นเดือนปัจจุบัน ข้อมูลที่ส่งออกเป็นตารางที่บันทึกแล้ว</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="grid gap-1.5 text-sm font-medium text-emerald-900">
                วันที่เริ่มต้น
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(event) => setExportStartDate(event.target.value)}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-emerald-900">
                วันที่สิ้นสุด
                <input
                  type="date"
                  min={exportStartDate}
                  value={exportEndDate}
                  onChange={(event) => setExportEndDate(event.target.value)}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </label>
              <button
                type="button"
                onClick={exportDoctorSchedule}
                disabled={!selectedDoctor || !exportRows.length || exportStartDate > exportEndDate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Icon name="download" />
                Export Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedDoctorId ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          เพิ่มรายชื่อแพทย์ก่อนจัดตารางเวลา
        </div>
      ) : (
        <div
          className="mt-5 overflow-auto"
          onMouseLeave={() => (dragValueRef.current = null)}
          onMouseUp={() => (dragValueRef.current = null)}
        >
          <div className="grid min-w-[860px] select-none grid-cols-[80px_repeat(7,minmax(92px,1fr))] gap-1">
            <div />
            {weekDays.map((day) => (
              <div key={toISODate(day)} className="rounded-xl bg-slate-50 p-2 text-center text-xs font-semibold text-slate-600">
                {formatThaiDate(day)}
              </div>
            ))}
            {hourKeys.map((hourKey, hour) => (
              <Fragment key={hourKey}>
                <div className="py-2 text-xs font-semibold text-slate-500">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((day) => {
                  const active = Boolean(getSchedule(day)[hourKey]);
                  return (
                    <button
                      key={`${toISODate(day)}-${hourKey}`}
                      type="button"
                      onMouseDown={() => toggleSlot(day, hourKey)}
                      onMouseEnter={() => applyDrag(day, hourKey)}
                      onTouchStart={() => toggleSlot(day, hourKey)}
                      className={`h-9 rounded-lg border text-[11px] font-semibold transition ${
                        active
                          ? "border-emerald-300 bg-emerald-500 text-white shadow-sm"
                          : "border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {active ? "ON" : ""}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function getCurrentMonthRange(date = new Date()) {
  return {
    start: toISODate(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  };
}

function formatExportDate(date) {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function getScheduleHours(schedule) {
  const ranges = [];
  let startHour = null;
  hourKeys.forEach((key, hour) => {
    const active = Boolean(schedule[key]);
    const isLast = hour === hourKeys.length - 1;
    if (active && startHour === null) startHour = hour;
    if (startHour !== null && (!active || isLast)) {
      const endHour = active && isLast ? hour + 1 : hour;
      ranges.push(`${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00`);
      startHour = null;
    }
  });
  return ranges.join(", ");
}
