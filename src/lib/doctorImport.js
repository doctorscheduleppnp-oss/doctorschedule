export const doctorImportHeaders = [
  "department_th",
  "department_en",
  "doctor_th",
  "doctor_en",
  "specialty_th",
  "specialty_en"
];

export function validateDoctorImportRows(sheetRows) {
  const headerIndex = sheetRows.findIndex((row) => (
    doctorImportHeaders.every((header, index) => normalizeCell(row[index]) === header)
  ));

  if (headerIndex === -1) {
    return {
      rows: [],
      errors: ["ไม่พบหัวคอลัมน์ที่ถูกต้อง กรุณาใช้ไฟล์ Template และอย่าเปลี่ยนชื่อหัวคอลัมน์"]
    };
  }

  const rows = [];
  const errors = [];

  sheetRows.slice(headerIndex + 1).forEach((rawRow, index) => {
    const values = doctorImportHeaders.map((_, columnIndex) => cleanText(rawRow[columnIndex]));
    if (values.every((value) => !value)) return;

    const row = Object.fromEntries(doctorImportHeaders.map((header, columnIndex) => [header, values[columnIndex]]));
    row.sourceRow = rawRow.sourceRow || headerIndex + index + 2;

    if (!row.department_th && !row.department_en) {
      errors.push(`แถว ${row.sourceRow}: ต้องระบุชื่อแผนกภาษาไทยหรืออังกฤษ`);
    }
    if (!row.doctor_th && !row.doctor_en) {
      errors.push(`แถว ${row.sourceRow}: ต้องระบุชื่อแพทย์ภาษาไทยหรืออังกฤษ`);
    }
    rows.push(row);
  });

  if (!rows.length && !errors.length) errors.push("ไม่พบข้อมูลแพทย์ในชีต Doctor Import");
  return { rows, errors };
}

export function normalizeImportName(value) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
}

export function findImportDepartment(row, departments) {
  const incomingNames = new Set([row.department_th, row.department_en].map(normalizeImportName).filter(Boolean));
  return departments.find((department) => (
    [department.name_th, department.name_en, department.name]
      .map(normalizeImportName)
      .some((name) => name && incomingNames.has(name))
  ));
}

export function isImportedDoctorDuplicate(row, departmentId, doctors) {
  const doctor = findImportedDoctor(row, doctors);
  return Boolean(doctor && doctorBelongsToDepartment(doctor, departmentId));
}

export function findImportedDoctor(row, doctors) {
  const incomingNames = new Set([row.doctor_th, row.doctor_en].map(normalizeImportName).filter(Boolean));
  return doctors.find((doctor) => (
    [doctor.name_th, doctor.name_en, doctor.name]
      .map(normalizeImportName)
      .some((name) => name && incomingNames.has(name))
  ));
}

function normalizeCell(value) {
  return cleanText(value).toLocaleLowerCase();
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
import { doctorBelongsToDepartment } from "./doctorDepartments.js";
