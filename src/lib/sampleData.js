import { getWeekDays, hourKeys, makeEmptySchedule, toISODate } from "./date";

export const sampleDepartments = [
  {
    id: "dept-cardio",
    name: "Cardiology",
    description: "Heart and vascular care",
    name_th: "อายุรกรรมโรคหัวใจ",
    name_en: "Cardiology",
    description_th: "ดูแลโรคหัวใจและหลอดเลือด",
    description_en: "Heart and vascular care"
  },
  {
    id: "dept-neuro",
    name: "Neurology",
    description: "Brain and nervous system",
    name_th: "ประสาทวิทยา",
    name_en: "Neurology",
    description_th: "ดูแลโรคสมองและระบบประสาท",
    description_en: "Brain and nervous system"
  },
  {
    id: "dept-peds",
    name: "Pediatrics",
    description: "Children and family care",
    name_th: "กุมารเวชกรรม",
    name_en: "Pediatrics",
    description_th: "ดูแลสุขภาพเด็กและครอบครัว",
    description_en: "Children and family care"
  }
];

export const sampleDoctors = [
  {
    id: "doc-1",
    name: "Dr. Narin S.",
    specialty: "Interventional Cardiologist",
    name_th: "นพ.นรินทร์",
    name_en: "Dr. Narin S.",
    specialty_th: "อายุรแพทย์โรคหัวใจและหลอดเลือด",
    specialty_en: "Interventional Cardiologist",
    image_url: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=320&q=80",
    department_id: "dept-cardio"
  },
  {
    id: "doc-2",
    name: "Dr. Sirin P.",
    specialty: "Pediatric Specialist",
    name_th: "พญ.ศิริน",
    name_en: "Dr. Sirin P.",
    specialty_th: "กุมารแพทย์",
    specialty_en: "Pediatric Specialist",
    image_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=320&q=80",
    department_id: "dept-peds"
  },
  {
    id: "doc-3",
    name: "Dr. Kittipong R.",
    specialty: "Neurologist",
    name_th: "นพ.กิตติพงศ์",
    name_en: "Dr. Kittipong R.",
    specialty_th: "ประสาทวิทยา",
    specialty_en: "Neurologist",
    image_url: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=320&q=80",
    department_id: "dept-neuro"
  }
];

function fillHours(schedule, start, end) {
  const next = { ...schedule };
  hourKeys.forEach((key, index) => {
    if (index >= start && index <= end) next[key] = true;
  });
  return next;
}

export function buildSampleSchedules() {
  const weekDays = getWeekDays(new Date());
  return sampleDoctors.flatMap((doctor, doctorIndex) =>
    weekDays.map((date, dayIndex) => {
      const base = makeEmptySchedule(doctor.id, date);
      if ((dayIndex + doctorIndex) % 2 === 0) return fillHours(base, 9, 15);
      if (dayIndex === 5) return fillHours(base, 10, 12);
      return base;
    })
  );
}

export function todaySchedules() {
  const today = toISODate(new Date());
  return buildSampleSchedules().filter((schedule) => schedule.date === today);
}
