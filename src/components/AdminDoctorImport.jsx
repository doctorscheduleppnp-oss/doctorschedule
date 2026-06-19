import React, { useState } from "react";
import { parseDoctorImportWorkbook } from "../lib/xlsxImport";
import { Icon } from "./icons";

export default function AdminDoctorImport({ onImport }) {
  const [expanded, setExpanded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReading(true);
    setFileName(file.name);
    setRows([]);
    setErrors([]);
    setSummary(null);
    try {
      const result = await parseDoctorImportWorkbook(file);
      setRows(result.rows);
      setErrors(result.errors);
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setReading(false);
    }
  }

  async function confirmImport() {
    setImporting(true);
    try {
      const result = await onImport(rows);
      if (result) {
        setSummary(result);
        setRows([]);
        setFileName("");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mb-5 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-800">Admin only</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">นำเข้าแพทย์และแผนกจาก Excel</h2>
          <p className="mt-1 text-sm text-slate-600">สร้างแผนกใหม่อัตโนมัติและข้ามแพทย์ที่มีชื่อซ้ำในแผนกเดิม</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hospital-700"
        >
          {expanded ? "ปิด Import" : "Import Excel"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-5 rounded-2xl border border-cyan-100 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-hospital-300 px-4 py-2.5 text-sm font-semibold text-hospital-700 hover:bg-hospital-50">
              <Icon name="upload" />
              {reading ? "กำลังอ่านไฟล์..." : "เลือกไฟล์ .xlsx"}
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={selectFile} disabled={reading || importing} />
            </label>
            <a href="/doctor-department-import-template.xlsx" download className="text-sm font-semibold text-hospital-700 hover:underline">
              ดาวน์โหลด Template
            </a>
            {fileName ? <span className="text-sm text-slate-500">{fileName}</span> : null}
          </div>

          {errors.length ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-semibold">กรุณาแก้ไขข้อมูลก่อน Import</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {errors.slice(0, 10).map((error) => <li key={error}>{error}</li>)}
              </ul>
              {errors.length > 10 ? <p className="mt-2">และอีก {errors.length - 10} รายการ</p> : null}
            </div>
          ) : null}

          {rows.length && !errors.length ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-700">ตรวจสอบผ่าน {rows.length} รายการ</p>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importing}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importing ? "กำลัง Import..." : `ยืนยัน Import ${rows.length} รายการ`}
                </button>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr><th className="px-3 py-2">แถว</th><th className="px-3 py-2">แผนก</th><th className="px-3 py-2">แพทย์</th><th className="px-3 py-2">ความเชี่ยวชาญ</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 20).map((row) => (
                      <tr key={row.sourceRow}>
                        <td className="px-3 py-2 text-slate-400">{row.sourceRow}</td>
                        <td className="px-3 py-2">{row.department_th || row.department_en}</td>
                        <td className="px-3 py-2 font-medium">{row.doctor_th || row.doctor_en}</td>
                        <td className="px-3 py-2 text-slate-500">{row.specialty_th || row.specialty_en || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 ? <p className="mt-2 text-xs text-slate-500">แสดง 20 รายการแรกจากทั้งหมด {rows.length} รายการ</p> : null}
            </div>
          ) : null}

          {summary ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Import เสร็จแล้ว: เพิ่มแผนก {summary.departmentsCreated} แผนก, เพิ่มแพทย์ {summary.doctorsCreated} คน, ข้ามข้อมูลซ้ำ {summary.doctorsSkipped} คน{summary.failed ? `, ไม่สำเร็จ ${summary.failed} คน` : ""}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
