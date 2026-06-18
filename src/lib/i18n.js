export const LANGUAGE_STORAGE_KEY = "doctor-schedule-language";

export const translations = {
  th: {
    appTitle: "ตารางแพทย์และแพทย์รับปรึกษา",
    publicTab: "ตารางแพทย์วันนี้",
    consultTab: "แพทย์รับปรึกษา",
    staffLogin: "เข้าสู่ระบบเจ้าหน้าที่",
    loading: "กำลังโหลดข้อมูล...",
    todayTitle: "ตารางแพทย์วันนี้",
    todayDescription: "ค้นหาแพทย์ที่ออกตรวจวันนี้ตามแผนก",
    department: "แผนก",
    allDepartments: "ทุกแผนก",
    noDoctors: "ไม่พบแพทย์ที่ออกตรวจวันนี้",
    scheduleUpdates: "ประกาศการเปลี่ยนแปลงตารางเวร",
    latest: "ล่าสุด",
    noUpdates: "ยังไม่มีการเปลี่ยนแปลงตารางเวรในสัปดาห์นี้",
    viewAll: "ดูทั้งหมด",
    moreItems: "รายการ กดเพื่อดูทั้งหมด",
    allUpdates: "การเปลี่ยนแปลงตารางเวรทั้งหมด",
    close: "ปิด",
    changedDates: "วันที่เปลี่ยน",
    lastUpdated: "แก้ล่าสุด",
    itemUnit: "รายการ",
    generalPractice: "เวชปฏิบัติทั่วไป",
    noClinicToday: "ไม่มีตารางวันนี้",
    inClinic: "กำลังออกตรวจ",
    laterToday: "มีตรวจรอบถัดไป",
    finishedToday: "ตรวจเสร็จแล้ววันนี้",
    clinicHours: "เวลาออกตรวจ",
    weeklySchedule: "ดูตารางทั้งสัปดาห์",
    weeklyScheduleTitle: "ตารางแพทย์รายสัปดาห์",
    consultTitle: "แพทย์รับปรึกษา",
    consultDescription: "ดูแพทย์รับ Consult ของทุกแผนกตามวันที่และช่วงเวลา",
    date: "วันที่",
    now: "ตอนนี้",
    next: "ถัดไป",
    noConsultData: "ไม่พบข้อมูล Consult สำหรับแผนกที่เลือก",
    noConsultant: "ไม่มีแพทย์รับ Consult",
    exportExcel: "Export Excel",
    exportedAt: "ส่งออกเมื่อ",
    scheduleExportTitle: "ตารางเวรแพทย์",
    consultExportTitle: "ตารางแพทย์รับ Consult",
    doctor: "แพทย์",
    specialty: "ความเชี่ยวชาญ",
    shift: "ช่วงเวร",
    clinicHoursHeader: "เวลาออกตรวจ"
  },
  en: {
    appTitle: "Doctor Schedule & Consult",
    publicTab: "Today's Schedule",
    consultTab: "Consult On-call",
    staffLogin: "Staff Login",
    loading: "Loading data...",
    todayTitle: "Today's Doctor Schedule",
    todayDescription: "Find doctors in clinic today by department",
    department: "Department",
    allDepartments: "All Departments",
    noDoctors: "No doctors available for the selected department today",
    scheduleUpdates: "Schedule Updates",
    latest: "Latest",
    noUpdates: "No schedule updates this week",
    viewAll: "View all",
    moreItems: "more items — view all",
    allUpdates: "All Schedule Updates",
    close: "Close",
    changedDates: "Changed dates",
    lastUpdated: "Last updated",
    itemUnit: "items",
    generalPractice: "General Practice",
    noClinicToday: "No Clinic Today",
    inClinic: "In Clinic",
    laterToday: "Later Today",
    finishedToday: "Finished Today",
    clinicHours: "Clinic Hours",
    weeklySchedule: "Weekly Schedule",
    weeklyScheduleTitle: "Weekly Doctor Schedule",
    consultTitle: "Consult On-call",
    consultDescription: "View consulting doctors by department, date, and shift",
    date: "Date",
    now: "Now",
    next: "Next",
    noConsultData: "No consult information for the selected department",
    noConsultant: "No Consultant Assigned",
    exportExcel: "Export Excel",
    exportedAt: "Exported",
    scheduleExportTitle: "Doctor Schedule",
    consultExportTitle: "Consult Schedule",
    doctor: "Doctor",
    specialty: "Specialty",
    shift: "Shift",
    clinicHoursHeader: "Clinic Hours"
  }
};

export function getInitialLanguage() {
  if (typeof window === "undefined") return "th";

  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "th" || saved === "en") return saved;
  return "th";
}

export function getLocalizedValue(record, field, language) {
  if (!record) return "";
  const otherLanguage = language === "th" ? "en" : "th";
  return record[`${field}_${language}`]?.trim()
    || record[`${field}_${otherLanguage}`]?.trim()
    || record[field]?.trim()
    || "";
}

export function formatLocalizedDate(date, language, options = {}) {
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", options).format(date);
}
