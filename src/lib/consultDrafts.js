export function getChangedConsultRows(draft, assignments) {
  const savedByKey = new Map(
    assignments.map((assignment) => [
      makeConsultDraftKey(assignment.date, assignment.department_id, assignment.shift_key),
      assignment.doctor_id || ""
    ])
  );

  return Object.entries(draft).flatMap(([key, draftAssignment]) => {
    const doctorId = draftAssignment.doctor_id || "";
    if ((savedByKey.get(key) || "") === doctorId) return [];

    return [{
      department_id: draftAssignment.department_id,
      doctor_id: doctorId || null,
      date: draftAssignment.date,
      shift_key: draftAssignment.shift_key
    }];
  });
}

export function makeConsultDraftKey(date, departmentId, shiftKey) {
  return `${date}::${departmentId}::${shiftKey}`;
}
