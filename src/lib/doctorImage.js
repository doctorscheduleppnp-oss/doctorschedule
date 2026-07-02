const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

export const MAX_DOCTOR_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateDoctorImage(file) {
  if (!file) return "กรุณาเลือกไฟล์รูปภาพ";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF";
  if (file.size > MAX_DOCTOR_IMAGE_SIZE) return "รูปภาพต้องมีขนาดไม่เกิน 5 MB";
  return "";
}

export function makeDoctorImagePath(file, id = crypto.randomUUID()) {
  const extension = ALLOWED_IMAGE_TYPES.get(file.type);
  return `${id}.${extension}`;
}
