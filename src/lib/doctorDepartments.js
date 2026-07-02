export function getDoctorDepartmentIds(doctor) {
  const ids = Array.isArray(doctor?.department_ids) ? doctor.department_ids.filter(Boolean) : [];
  if (ids.length) return [...new Set(ids)];
  return doctor?.department_id ? [doctor.department_id] : [];
}

export function doctorBelongsToDepartment(doctor, departmentId) {
  return getDoctorDepartmentIds(doctor).includes(departmentId);
}

export function attachDoctorDepartments(doctors, relationships) {
  const byDoctor = new Map();
  relationships.forEach((relationship) => {
    const current = byDoctor.get(relationship.doctor_id) || [];
    current.push(relationship);
    byDoctor.set(relationship.doctor_id, current);
  });

  return doctors.map((doctor) => {
    const rows = byDoctor.get(doctor.id) || [];
    const primary = rows.find((row) => row.is_primary)?.department_id || doctor.department_id || rows[0]?.department_id || "";
    const departmentIds = [...new Set([
      ...rows.map((row) => row.department_id),
      ...(doctor.department_id ? [doctor.department_id] : [])
    ])];
    return { ...doctor, department_id: primary, primary_department_id: primary, department_ids: departmentIds };
  });
}

export function normalizeDoctorDepartments(payload) {
  const requested = Array.isArray(payload.department_ids) ? payload.department_ids.filter(Boolean) : [];
  const fallback = payload.primary_department_id || payload.department_id || "";
  const departmentIds = [...new Set([...requested, ...(fallback ? [fallback] : [])])];
  const primaryDepartmentId = departmentIds.includes(payload.primary_department_id)
    ? payload.primary_department_id
    : departmentIds[0] || "";
  return { departmentIds, primaryDepartmentId };
}
