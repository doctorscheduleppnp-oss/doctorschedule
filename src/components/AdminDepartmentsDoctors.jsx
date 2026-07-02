import React, { useState } from "react";
import { Icon } from "./icons";
import { getLocalizedValue } from "../lib/i18n";
import AdminDoctorImport from "./AdminDoctorImport";
import { validateDoctorImage } from "../lib/doctorImage";
import { getDoctorDepartmentIds } from "../lib/doctorDepartments";

const emptyDepartment = { name_th: "", name_en: "", description_th: "", description_en: "" };
const emptyDoctor = {
  name_th: "",
  name_en: "",
  specialty_th: "",
  specialty_en: "",
  department_id: "",
  department_ids: [],
  primary_department_id: "",
  image_url: ""
};

export default function AdminDepartmentsDoctors({
  departments,
  doctors,
  onCreateDepartment,
  onUpdateDepartment,
  onToggleDepartmentActive,
  onCreateDoctor,
  onUpdateDoctor,
  onToggleDoctorActive,
  onUploadDoctorImage,
  canImport = false,
  onImportDoctors
}) {
  const [departmentForm, setDepartmentForm] = useState(emptyDepartment);
  const [departmentLanguage, setDepartmentLanguage] = useState("th");
  const [departmentError, setDepartmentError] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [doctorForm, setDoctorForm] = useState(emptyDoctor);
  const [doctorLanguage, setDoctorLanguage] = useState("th");
  const [doctorError, setDoctorError] = useState("");
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSavingDoctor, setIsSavingDoctor] = useState(false);

  async function submitDepartment(event) {
    event.preventDefault();
    if (!departmentForm.name_th.trim() && !departmentForm.name_en.trim()) {
      setDepartmentLanguage("th");
      setDepartmentError("กรุณากรอกชื่อแผนกอย่างน้อยหนึ่งภาษา");
      return;
    }
    setDepartmentError("");
    if (editingDepartmentId) {
      await onUpdateDepartment(editingDepartmentId, departmentForm);
    } else {
      await onCreateDepartment(departmentForm);
    }
    resetDepartmentForm();
  }

  function editDepartment(department) {
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name_th: department.name_th || "",
      name_en: department.name_en || department.name || "",
      description_th: department.description_th || "",
      description_en: department.description_en || department.description || ""
    });
  }

  function resetDepartmentForm() {
    setEditingDepartmentId(null);
    setDepartmentForm(emptyDepartment);
    setDepartmentError("");
  }

  async function submitDoctor(event) {
    event.preventDefault();
    if (!doctorForm.name_th.trim() && !doctorForm.name_en.trim()) {
      setDoctorLanguage("th");
      setDoctorError("กรุณากรอกชื่อแพทย์อย่างน้อยหนึ่งภาษา");
      return;
    }
    if (!doctorForm.department_ids.length) {
      setDoctorError("กรุณาเลือกแผนกอย่างน้อยหนึ่งแผนก");
      return;
    }
    if (selectedFile) {
      const imageError = validateDoctorImage(selectedFile);
      if (imageError) {
        setDoctorError(imageError);
        return;
      }
    }

    setDoctorError("");
    setIsSavingDoctor(true);
    try {
      let imageUrl = doctorForm.image_url;
      if (selectedFile) {
        imageUrl = await onUploadDoctorImage(selectedFile);
        if (!imageUrl) {
          setDoctorError("อัปโหลดรูปไม่สำเร็จ กรุณาตรวจข้อความแจ้งเตือนด้านบนแล้วลองอีกครั้ง");
          return;
        }
      }

      const payload = { ...doctorForm, image_url: imageUrl };
      const savedDoctor = editingDoctorId
        ? await onUpdateDoctor(editingDoctorId, payload)
        : await onCreateDoctor(payload);
      if (savedDoctor) resetDoctorForm();
    } finally {
      setIsSavingDoctor(false);
    }
  }

  function editDoctor(doctor) {
    const departmentIds = getDoctorDepartmentIds(doctor);
    setEditingDoctorId(doctor.id);
    setDoctorForm({
      name_th: doctor.name_th || "",
      name_en: doctor.name_en || doctor.name || "",
      specialty_th: doctor.specialty_th || "",
      specialty_en: doctor.specialty_en || doctor.specialty || "",
      department_id: doctor.department_id || "",
      department_ids: departmentIds,
      primary_department_id: doctor.primary_department_id || doctor.department_id || departmentIds[0] || "",
      image_url: doctor.image_url || ""
    });
    setSelectedFile(null);
  }

  function resetDoctorForm() {
    setEditingDoctorId(null);
    setDoctorForm(emptyDoctor);
    setSelectedFile(null);
    setDoctorError("");
  }

  function toggleDoctorDepartment(departmentId) {
    setDoctorForm((form) => {
      const isSelected = form.department_ids.includes(departmentId);
      const departmentIds = isSelected
        ? form.department_ids.filter((id) => id !== departmentId)
        : [...form.department_ids, departmentId];
      const primaryDepartmentId = departmentIds.includes(form.primary_department_id)
        ? form.primary_department_id
        : departmentIds[0] || "";
      return {
        ...form,
        department_id: primaryDepartmentId,
        department_ids: departmentIds,
        primary_department_id: primaryDepartmentId
      };
    });
  }

  return (
    <>
      {canImport ? <AdminDoctorImport onImport={onImportDoctors} /> : null}
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">จัดการแผนก</h2>
          {editingDepartmentId && <span className="text-xs font-semibold text-hospital-700">กำลังแก้ไข</span>}
        </div>
        <form onSubmit={submitDepartment} className="mt-4 grid gap-3">
          <LanguageTabs value={departmentLanguage} onChange={setDepartmentLanguage} />
          {departmentError && <p className="text-sm font-medium text-rose-600">{departmentError}</p>}
          <input
            value={departmentForm[`name_${departmentLanguage}`]}
            onChange={(event) => setDepartmentForm((form) => ({ ...form, [`name_${departmentLanguage}`]: event.target.value }))}
            placeholder={departmentLanguage === "th" ? "ชื่อแผนก" : "Department Name"}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <textarea
            value={departmentForm[`description_${departmentLanguage}`]}
            onChange={(event) => setDepartmentForm((form) => ({ ...form, [`description_${departmentLanguage}`]: event.target.value }))}
            placeholder={departmentLanguage === "th" ? "รายละเอียด" : "Description"}
            className="min-h-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <div className="flex gap-2">
            <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white">
              <Icon name={editingDepartmentId ? "save" : "plus"} />
              {editingDepartmentId ? "บันทึกการแก้ไข" : "เพิ่มแผนก"}
            </button>
            {editingDepartmentId && (
              <button type="button" onClick={resetDepartmentForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 divide-y divide-slate-100">
          {departments.map((department) => {
            const active = department.is_active !== false;
            return (
              <div key={department.id} className={`flex items-center justify-between gap-3 py-3 ${active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{getLocalizedValue(department, "name", "th")}</p>
                    {!active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ปิดใช้งาน</span>}
                    {!department.name_en && <MissingEnglishBadge />}
                  </div>
                  <p className="truncate text-sm text-slate-500">{getLocalizedValue(department, "description", "th")}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`แก้ไข ${getLocalizedValue(department, "name", "th")}`} icon="edit" onClick={() => editDepartment(department)} />
                  <IconButton
                    label={`${active ? "ปิด" : "เปิด"}ใช้งาน ${getLocalizedValue(department, "name", "th")}`}
                    icon={active ? "archive" : "restore"}
                    onClick={() => onToggleDepartmentActive(department)}
                    warning={active}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">จัดการแพทย์</h2>
          {editingDoctorId && <span className="text-xs font-semibold text-hospital-700">กำลังแก้ไข</span>}
        </div>
        <form onSubmit={submitDoctor} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <LanguageTabs value={doctorLanguage} onChange={setDoctorLanguage} />
            {doctorError && <p className="mt-2 text-sm font-medium text-rose-600">{doctorError}</p>}
          </div>
          <input
            value={doctorForm[`name_${doctorLanguage}`]}
            onChange={(event) => setDoctorForm((form) => ({ ...form, [`name_${doctorLanguage}`]: event.target.value }))}
            placeholder={doctorLanguage === "th" ? "ชื่อแพทย์" : "Doctor Name"}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <input
            value={doctorForm[`specialty_${doctorLanguage}`]}
            onChange={(event) => setDoctorForm((form) => ({ ...form, [`specialty_${doctorLanguage}`]: event.target.value }))}
            placeholder={doctorLanguage === "th" ? "ความเชี่ยวชาญ" : "Specialty"}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
          <fieldset className="rounded-xl border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold text-slate-700">แผนกที่สังกัด</legend>
            <p className="mb-3 text-xs text-slate-500">เลือกได้หลายแผนก และกำหนดแผนกหลักหนึ่งแห่ง</p>
            <div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-2">
              {departments.map((department) => {
                const checked = doctorForm.department_ids.includes(department.id);
                const departmentName = getLocalizedValue(department, "name", "th");
                return (
                  <div key={department.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${checked ? "border-hospital-300 bg-hospital-50" : "border-slate-100"}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDoctorDepartment(department.id)}
                        className="h-4 w-4 rounded border-slate-300 text-hospital-600"
                      />
                      <span className="truncate">{departmentName}{department.is_active === false ? " (ปิดใช้งาน)" : ""}</span>
                    </label>
                    <label className={`flex items-center gap-1 text-xs font-semibold ${checked ? "text-hospital-700" : "text-slate-300"}`}>
                      <input
                        type="radio"
                        name="primary-doctor-department"
                        checked={doctorForm.primary_department_id === department.id}
                        disabled={!checked}
                        onChange={() => setDoctorForm((form) => ({ ...form, department_id: department.id, primary_department_id: department.id }))}
                      />
                      หลัก
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-500 hover:border-hospital-400 hover:text-hospital-700">
            <Icon name="upload" />
            {selectedFile ? selectedFile.name : editingDoctorId ? "เปลี่ยนรูป (ไม่บังคับ)" : "อัปโหลดรูป"}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0])} />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button disabled={isSavingDoctor} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
              <Icon name={editingDoctorId ? "save" : "plus"} />
              {isSavingDoctor ? "กำลังบันทึก..." : editingDoctorId ? "บันทึกการแก้ไข" : "เพิ่มแพทย์"}
            </button>
            {editingDoctorId && (
              <button type="button" onClick={resetDoctorForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {doctors.map((doctor) => {
            const active = doctor.is_active !== false;
            const doctorName = getLocalizedValue(doctor, "name", "th");
            const departmentNames = getDoctorDepartmentIds(doctor)
              .map((departmentId) => getLocalizedValue(departments.find((department) => department.id === departmentId), "name", "th"))
              .filter(Boolean);
            return (
              <div key={doctor.id} className={`flex items-center gap-3 rounded-2xl border border-slate-100 p-3 ${active ? "" : "bg-slate-50 opacity-60"}`}>
                <img
                  src={doctor.image_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(doctorName)}`}
                  alt={doctorName}
                  className="h-12 w-12 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{doctorName}</p>
                    {!active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ปิดใช้งาน</span>}
                    {!doctor.name_en && <MissingEnglishBadge />}
                  </div>
                  <p className="truncate text-sm text-slate-500">{getLocalizedValue(doctor, "specialty", "th")}</p>
                  <p className="truncate text-xs text-hospital-700">{departmentNames.join(", ") || "ยังไม่มีแผนก"}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`แก้ไข ${doctorName}`} icon="edit" onClick={() => editDoctor(doctor)} />
                  <IconButton
                    label={`${active ? "ปิด" : "เปิด"}ใช้งาน ${doctorName}`}
                    icon={active ? "archive" : "restore"}
                    onClick={() => onToggleDoctorActive(doctor)}
                    warning={active}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </section>
    </>
  );
}

function LanguageTabs({ value, onChange }) {
  return (
    <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1" role="tablist" aria-label="ภาษาของข้อมูล">
      {[["th", "ภาษาไทย"], ["en", "English"]].map(([language, label]) => (
        <button
          key={language}
          type="button"
          role="tab"
          aria-selected={value === language}
          onClick={() => onChange(language)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${value === language ? "bg-white text-hospital-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MissingEnglishBadge() {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">EN ยังไม่ครบ</span>;
}

function IconButton({ label, icon, onClick, warning = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 ${warning ? "text-slate-400 hover:bg-amber-50 hover:text-amber-700" : "text-slate-400 hover:bg-hospital-50 hover:text-hospital-700"}`}
    >
      <Icon name={icon} />
    </button>
  );
}
