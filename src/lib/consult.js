import { toISODate } from "./date";
import { doctorBelongsToDepartment } from "./doctorDepartments";

export const CONSULT_SHIFTS = [
  { key: "day", label: "07:00-17:00", description: "เวรกลางวัน", startHour: 7, endHour: 17 },
  { key: "evening", label: "17:00-20:00", description: "เวรช่วงเย็น", startHour: 17, endHour: 20 },
  { key: "night", label: "20:00-07:00", description: "เวรกลางคืน", startHour: 20, endHour: 31 }
];

export function buildSampleConsultAssignments(departments, doctors, date = new Date()) {
  const assignmentDate = toISODate(date);

  return departments.flatMap((department, departmentIndex) => {
    const departmentDoctors = doctors.filter((doctor) => doctorBelongsToDepartment(doctor, department.id));

    return CONSULT_SHIFTS.map((shift, shiftIndex) => ({
      id: `sample-${department.id}-${shift.key}`,
      department_id: department.id,
      doctor_id: departmentDoctors.length
        ? departmentDoctors[(departmentIndex + shiftIndex) % departmentDoctors.length].id
        : null,
      date: assignmentDate,
      shift_key: shift.key
    }));
  });
}
