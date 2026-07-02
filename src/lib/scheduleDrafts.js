import { hourKeys, makeEmptySchedule } from "./date.js";

export function mergeScheduleDraftRows(currentDrafts, rows) {
  return {
    ...currentDrafts,
    ...Object.fromEntries(rows.map((row) => [row.date, row]))
  };
}

export function getChangedScheduleRows(draftSchedules, savedSchedules, doctorId) {
  if (!doctorId) return [];

  const savedByDate = new Map(
    savedSchedules
      .filter((schedule) => schedule.doctor_id === doctorId)
      .map((schedule) => [schedule.date, schedule])
  );

  return Object.values(draftSchedules).filter((draft) => {
    if (draft.doctor_id !== doctorId) return false;
    const saved = savedByDate.get(draft.date)
      || makeEmptySchedule(doctorId, new Date(`${draft.date}T00:00:00`));
    return hourKeys.some((hour) => Boolean(draft[hour]) !== Boolean(saved[hour]));
  });
}
