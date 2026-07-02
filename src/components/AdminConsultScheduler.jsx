import React, { useMemo, useState } from "react";
import { CONSULT_SHIFTS } from "../lib/consult";
import { getChangedConsultRows, makeConsultDraftKey } from "../lib/consultDrafts";
import { toISODate } from "../lib/date";
import { exportTableToExcel } from "../lib/excelExport";
import { getLocalizedValue } from "../lib/i18n";
import { Icon } from "./icons";

export default function AdminConsultScheduler({ departments, doctors, assignments, onSave }) {
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [exportMonth, setExportMonth] = useState(toISODate(new Date()).slice(0, 7));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("all");
  const [draft, setDraft] = useState({});

  const visibleDepartments = selectedDepartmentId === "all"
    ? departments
    : departments.filter((department) => department.id === selectedDepartmentId);

  const assignmentMap = useMemo(() => {
    const map = {};
    assignments
      .filter((assignment) => assignment.date === selectedDate)
      .forEach((assignment) => {
        map[`${assignment.department_id}-${assignment.shift_key}`] = assignment;
      });
    return map;
  }, [assignments, selectedDate]);

  const changedRows = useMemo(
    () => getChangedConsultRows(draft, assignments),
    [draft, assignments]
  );

  function getDoctorId(departmentId, shiftKey) {
    const key = makeConsultDraftKey(selectedDate, departmentId, shiftKey);
    if (Object.prototype.hasOwnProperty.call(draft, key)) return draft[key].doctor_id || "";
    return assignmentMap[`${departmentId}-${shiftKey}`]?.doctor_id || "";
  }

  function updateAssignment(departmentId, shiftKey, doctorId) {
    const key = makeConsultDraftKey(selectedDate, departmentId, shiftKey);
    setDraft((current) => ({
      ...current,
      [key]: { date: selectedDate, department_id: departmentId, shift_key: shiftKey, doctor_id: doctorId }
    }));
  }

  async function saveChanges() {
    const saved = await onSave(changedRows);
    if (saved) setDraft({});
  }

  const emptySlotCount = departments.reduce(
    (count, department) => count + CONSULT_SHIFTS.filter((shift) => !getDoctorId(department.id, shift.key)).length,
    0
  );

  const exportRows = useMemo(() => {
    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
    const shiftByKey = new Map(CONSULT_SHIFTS.map((shift, index) => [shift.key, { ...shift, order: index }]));

    return assignments
      .filter((assignment) => assignment.date.startsWith(exportMonth)
        && assignment.doctor_id
        && (selectedDepartmentId === "all" || assignment.department_id === selectedDepartmentId))
      .sort((a, b) => a.date.localeCompare(b.date)
        || (departmentById.get(a.department_id)?.name || "").localeCompare(departmentById.get(b.department_id)?.name || "")
        || (shiftByKey.get(a.shift_key)?.order ?? 99) - (shiftByKey.get(b.shift_key)?.order ?? 99))
      .map((assignment) => {
        const shift = shiftByKey.get(assignment.shift_key);
        return {
          date: formatConsultExportDate(assignment.date),
          department: getLocalizedValue(departmentById.get(assignment.department_id), "name", "th"),
          shift: shift?.description || assignment.shift_key,
          time: shift?.label || "",
          doctor: getLocalizedValue(doctorById.get(assignment.doctor_id), "name", "th"),
          units: "1"
        };
      });
  }, [assignments, departments, doctors, exportMonth, selectedDepartmentId]);

  function exportConsultMonth() {
    if (!exportRows.length) return;
    exportTableToExcel({
      title: "ตารางแพทย์รับ Consult สำหรับคำนวณค่าตอบแทน",
      sheetName: "ตาราง Consult",
      fileName: `consult-schedule-${exportMonth}`,
      metadata: `เดือน ${formatConsultMonth(exportMonth)} | รวม ${exportRows.length} เวร`,
      columns: [
        { key: "date", header: "วันที่", width: 18 },
        { key: "department", header: "แผนก", width: 28 },
        { key: "shift", header: "ช่วงเวร", width: 20 },
        { key: "time", header: "เวลา", width: 20 },
        { key: "doctor", header: "แพทย์รับ Consult", width: 30 },
        { key: "units", header: "จำนวนเวร", width: 14 }
      ],
      rows: [
        ...exportRows,
        { date: "รวม", department: "", shift: "", time: "", doctor: "", units: String(exportRows.length) }
      ]
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">จัดตาราง Consult</h2>
          <p className="mt-2 text-sm text-slate-500">กำหนดแพทย์รับ Consult แยกตามแผนกและช่วงเวลา</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select
            value={selectedDepartmentId}
            onChange={(event) => setSelectedDepartmentId(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          >
            <option value="all">ทุกแผนก</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <input
            type="date"
            aria-label="เลือกวันที่ Consult"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <button
            type="button"
            onClick={saveChanges}
            disabled={!changedRows.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hospital-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="save" />
            {changedRows.length ? `Save Changes (${changedRows.length} เวร)` : "Save Changes"}
          </button>
        </div>
      </div>

      {changedRows.length > 0 && (
        <p className="mt-3 text-sm font-medium text-amber-700">
          ยังไม่ได้บันทึก {changedRows.length} เวร จากหลายวันที่เลือกไว้
        </p>
      )}

      <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${emptySlotCount ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {emptySlotCount
          ? `ยังมี ${emptySlotCount} ช่วงเวลาที่ไม่มีแพทย์ Consult ในวันที่เลือก`
          : "ทุกช่วงเวลามีแพทย์ Consult ครบแล้ว"}
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-semibold text-emerald-950">Export Excel รายเดือนสำหรับคำนวณค่าตอบแทน</h3>
            <p className="mt-1 text-sm text-emerald-800">ส่งออกรายชื่อแพทย์ที่รับ Consult แยกตามวันที่ แผนก และช่วงเวร</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1.5 text-sm font-medium text-emerald-900">
              เดือนที่ต้องการ
              <input
                type="month"
                value={exportMonth}
                onChange={(event) => setExportMonth(event.target.value)}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </label>
            <button
              type="button"
              onClick={exportConsultMonth}
              disabled={!exportRows.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Icon name="download" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[880px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">แผนก</th>
              {CONSULT_SHIFTS.map((shift) => (
                <th key={shift.key} className="px-4 py-3 font-semibold">
                  <span className="block">{shift.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">{shift.description}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleDepartments.map((department) => {
              const departmentDoctors = doctors.filter((doctor) => doctor.department_id === department.id);
              return (
                <tr key={department.id}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{department.name}</td>
                  {CONSULT_SHIFTS.map((shift) => {
                    const doctorId = getDoctorId(department.id, shift.key);
                    return (
                      <td key={shift.key} className="px-4 py-3">
                        <select
                          value={doctorId}
                          onChange={(event) => updateAssignment(department.id, shift.key, event.target.value)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-hospital-500 ${doctorId ? "border-slate-200 bg-white text-slate-900" : "border-rose-200 bg-rose-50 text-rose-700"}`}
                        >
                          <option value="">ไม่มีแพทย์ Consult</option>
                          {departmentDoctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatConsultExportDate(date) {
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${date}T00:00:00`));
}

function formatConsultMonth(month) {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T00:00:00`));
}
