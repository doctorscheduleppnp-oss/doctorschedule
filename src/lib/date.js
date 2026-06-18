export const hourKeys = Array.from({ length: 24 }, (_, hour) =>
  `h${String(hour).padStart(2, "0")}`
);

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getWeekDays(startDate = getStartOfWeek()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

export function formatThaiDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

export function makeEmptySchedule(doctorId, date) {
  return {
    doctor_id: doctorId,
    date: toISODate(date),
    ...Object.fromEntries(hourKeys.map((hour) => [hour, false]))
  };
}
