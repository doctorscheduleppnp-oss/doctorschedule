import React, { useEffect, useMemo, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import AdminConsultScheduler from "./components/AdminConsultScheduler";
import AdminDepartmentsDoctors from "./components/AdminDepartmentsDoctors";
import AdminScheduler from "./components/AdminScheduler";
import AdminUserManagement from "./components/AdminUserManagement";
import ConsultDashboard from "./components/ConsultDashboard";
import PublicDashboard from "./components/PublicDashboard";
import WeeklyCalendarModal from "./components/WeeklyCalendarModal";
import hospitalLogo from "./assets/princ-paknampho-logo.png";
import { hasSupabaseConfig, supabase } from "./lib/supabase";
import { buildSampleConsultAssignments } from "./lib/consult";
import { buildSampleSchedules, sampleDepartments, sampleDoctors } from "./lib/sampleData";
import { getStartOfWeek, getWeekDays, hourKeys, toISODate } from "./lib/date";
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, translations } from "./lib/i18n";
import { findImportDepartment, findImportedDoctor, isImportedDoctorDuplicate } from "./lib/doctorImport";
import { makeDoctorImagePath, validateDoctorImage } from "./lib/doctorImage";
import { collectPaginatedRows } from "./lib/pagination";
import {
  attachDoctorDepartments,
  getDoctorDepartmentIds,
  normalizeDoctorDepartments
} from "./lib/doctorDepartments";

const baseTabs = [
  { id: "public" },
  { id: "consult" },
  { id: "admin-consult", label: "จัดตาราง Consult" },
  { id: "admin-directory", label: "Departments & Doctors" },
  { id: "admin-scheduler", label: "Scheduler" },
  { id: "admin-users", label: "ผู้ใช้งาน" },
  { id: "admin-login" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("public");
  const [language, setLanguage] = useState(getInitialLanguage);
  const [departments, setDepartments] = useState(sampleDepartments);
  const [doctors, setDoctors] = useState(() => attachDoctorDepartments(sampleDoctors, []));
  const [schedules, setSchedules] = useState(buildSampleSchedules());
  const [consultAssignments, setConsultAssignments] = useState(
    buildSampleConsultAssignments(sampleDepartments, sampleDoctors)
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("all");
  const [weeklyDoctor, setWeeklyDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState(hasSupabaseConfig ? "" : "Demo mode: add Supabase env values to use live data.");

  const canManage = !hasSupabaseConfig || (profile?.status === "approved" && (profile?.role === "staff" || profile?.role === "admin"));
  const isAdmin = !hasSupabaseConfig || (profile?.status === "approved" && profile?.role === "admin");
  const pendingUserCount = users.filter((user) => user.status === "pending").length;
  const copy = translations[language];
  const tabs = baseTabs.map((tab) => {
    if (tab.id === "public") return { ...tab, label: copy.publicTab };
    if (tab.id === "consult") return { ...tab, label: copy.consultTab };
    if (tab.id === "admin-login") return { ...tab, label: copy.staffLogin };
    if (tab.id === "admin-users") {
      return { ...tab, label: `${tab.label}${pendingUserCount ? ` (${pendingUserCount})` : ""}` };
    }
    return tab;
  });
  const activeDepartments = useMemo(
    () => departments.filter((department) => department.is_active !== false),
    [departments]
  );
  const activeDepartmentIds = useMemo(
    () => new Set(activeDepartments.map((department) => department.id)),
    [activeDepartments]
  );
  const activeDoctors = useMemo(
    () => doctors.filter((doctor) => (
      doctor.is_active !== false
      && getDoctorDepartmentIds(doctor).some((departmentId) => activeDepartmentIds.has(departmentId))
    )),
    [doctors, activeDepartmentIds]
  );
  const visibleTabs = tabs.filter((tab) => {
    if (tab.id === "admin-login") return hasSupabaseConfig;
    if (tab.id === "admin-consult" || tab.id === "admin-users") return isAdmin;
    if (tab.id.startsWith("admin-")) return canManage;
    return true;
  });

  const weeklyChanges = useMemo(() => {
    const weekDateSet = new Set(getWeekDays(getStartOfWeek(new Date())).map(toISODate));
    const changesByDoctor = new Map();

    schedules.forEach((schedule) => {
      if (!weekDateSet.has(schedule.date) || !schedule.created_at || !schedule.updated_at) return;

      const createdAt = new Date(schedule.created_at).getTime();
      const updatedAt = new Date(schedule.updated_at).getTime();
      if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || updatedAt - createdAt < 1000) return;

      const doctor = doctors.find((item) => item.id === schedule.doctor_id);
      if (!doctor || doctor.is_active === false
        || !getDoctorDepartmentIds(doctor).some((departmentId) => activeDepartmentIds.has(departmentId))) return;

      const current = changesByDoctor.get(doctor.id) || {
        doctorId: doctor.id,
        doctor,
        dates: [],
        lastUpdatedAt: schedule.updated_at
      };

      current.dates.push(schedule.date);
      if (new Date(schedule.updated_at) > new Date(current.lastUpdatedAt)) {
        current.lastUpdatedAt = schedule.updated_at;
      }
      changesByDoctor.set(doctor.id, current);
    });

    return Array.from(changesByDoctor.values())
      .map((change) => ({
        ...change,
        dates: [...new Set(change.dates)].sort()
      }))
      .sort((a, b) => new Date(b.lastUpdatedAt) - new Date(a.lastUpdatedAt));
  }, [activeDepartmentIds, doctors, schedules]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setActiveTab("public");
      }
    });

    loadSupabaseData();
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === "admin-consult" && !isAdmin) {
      setActiveTab("admin-login");
      return;
    }
    if (!canManage && activeTab.startsWith("admin-") && activeTab !== "admin-login") {
      setActiveTab("admin-login");
    }
  }, [activeTab, canManage, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    loadUsers();
  }, [isAdmin]);

  async function loadProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      setProfile({ id: userId, role: "viewer" });
      return;
    }
    setProfile(data);
  }

  async function loadUsers() {
    if (!hasSupabaseConfig) {
      setUsers([
        { id: "demo-pending", full_name: "พนักงานตัวอย่าง", email: "staff@example.com", role: "viewer", status: "pending", created_at: new Date().toISOString() }
      ]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false });
    if (error) return setNotice(error.message);
    setUsers(data || []);
  }

  async function updateUserAccess(userId, access) {
    if (!isAdmin) return setNotice("เฉพาะ Admin เท่านั้นที่เปลี่ยนสิทธิ์ผู้ใช้งานได้");
    if (userId === session?.user?.id) return setNotice("ไม่สามารถเปลี่ยนสิทธิ์บัญชีตัวเองได้");

    if (!hasSupabaseConfig) {
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...access, reviewed_at: new Date().toISOString() } : user));
      setNotice("อัปเดตสิทธิ์ผู้ใช้งานใน Demo mode แล้ว");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(access)
      .eq("id", userId)
      .select("id, full_name, email, role, status, created_at, reviewed_at, reviewed_by")
      .single();
    if (error) return setNotice(error.message);
    setUsers((current) => current.map((user) => user.id === userId ? data : user));
    setNotice(`อัปเดตสิทธิ์ของ ${data.full_name || data.email || "ผู้ใช้งาน"} เรียบร้อยแล้ว`);
  }

  async function loadSupabaseData() {
    setLoading(true);
    try {
      const [departmentResult, doctorResult, doctorDepartmentResult, scheduleResult, consultResult] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("doctors").select("*").order("name"),
        loadAllRelationshipRows(),
        loadAllTableRows("schedules"),
        loadAllTableRows("consult_assignments")
      ]);

      if (departmentResult.error) throw departmentResult.error;
      if (doctorResult.error) throw doctorResult.error;
      if (scheduleResult.error) throw scheduleResult.error;

      const loadedDoctors = attachDoctorDepartments(
        doctorResult.data || [],
        doctorDepartmentResult.error ? [] : doctorDepartmentResult.data || []
      );
      setDepartments(departmentResult.data || []);
      setDoctors(loadedDoctors);
      setSchedules(scheduleResult.data || []);
      if (doctorDepartmentResult.error) {
        setNotice("ยังไม่ได้ติดตั้งระบบแพทย์หลายแผนก กรุณารัน supabase/add-doctor-multiple-departments.sql");
      } else if (consultResult.error) {
        setConsultAssignments([]);
        setNotice("ยังไม่ได้ติดตั้งตาราง Consult กรุณารัน supabase/add-consult-system.sql");
      } else {
        setConsultAssignments(consultResult.data || []);
        setNotice("");
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  function loadAllTableRows(table) {
    return collectPaginatedRows((from, to) => (
      supabase
        .from(table)
        .select("*")
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ));
  }

  function loadAllRelationshipRows() {
    return collectPaginatedRows((from, to) => (
      supabase
        .from("doctor_departments")
        .select("doctor_id, department_id, is_primary")
        .order("doctor_id", { ascending: true })
        .order("department_id", { ascending: true })
        .range(from, to)
    ));
  }

  async function createDepartment(payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const preparedPayload = prepareDepartmentPayload(payload);
    if (!hasSupabaseConfig) {
      const created = { ...preparedPayload, id: crypto.randomUUID() };
      setDepartments((current) => [...current, created]);
      return created;
    }
    const { data, error } = await supabase.from("departments").insert(preparedPayload).select().single();
    if (error) {
      setNotice(error.message);
      return null;
    }
    setDepartments((current) => [...current, data]);
    return data;
  }

  async function updateDepartment(id, payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const preparedPayload = prepareDepartmentPayload(payload);
    if (!hasSupabaseConfig) {
      setDepartments((current) => current.map((department) => department.id === id ? { ...department, ...preparedPayload } : department));
      setNotice("แก้ไขแผนกแล้ว");
      return;
    }
    const { data, error } = await supabase.from("departments").update(preparedPayload).eq("id", id).select().single();
    if (error) return setNotice(error.message);
    setDepartments((current) => current.map((department) => department.id === id ? data : department));
    setNotice("แก้ไขแผนกเรียบร้อย");
  }

  async function toggleDepartmentActive(department) {
    await updateDepartment(department.id, { is_active: department.is_active === false });
  }

  async function deleteDepartment(id) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    if (!hasSupabaseConfig) {
      setDepartments((current) => current.filter((department) => department.id !== id));
      return;
    }
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return setNotice(error.message);
    setDepartments((current) => current.filter((department) => department.id !== id));
  }

  async function uploadDoctorImage(file) {
    if (hasSupabaseConfig && !canManage) {
      setNotice("บัญชีนี้ไม่มีสิทธิ์อัปโหลดรูป");
      return null;
    }
    if (!hasSupabaseConfig) return URL.createObjectURL(file);

    const validationError = validateDoctorImage(file);
    if (validationError) {
      setNotice(validationError);
      return null;
    }

    const path = makeDoctorImagePath(file);
    const { error } = await supabase.storage.from("doctor-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });
    if (error) {
      const setupHint = /bucket not found|row-level security|policy/i.test(error.message)
        ? " กรุณาติดตั้ง Storage ด้วยไฟล์ supabase/add-doctor-image-storage.sql"
        : "";
      setNotice(`อัปโหลดรูปไม่สำเร็จ: ${error.message}${setupHint}`);
      return null;
    }
    const { data } = supabase.storage.from("doctor-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function createDoctor(payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const membership = normalizeDoctorDepartments(payload);
    if (!membership.departmentIds.length) {
      setNotice("กรุณาเลือกแผนกของแพทย์อย่างน้อยหนึ่งแผนก");
      return null;
    }
    const preparedPayload = prepareDoctorPayload({ ...payload, department_id: membership.primaryDepartmentId });
    if (!hasSupabaseConfig) {
      const created = {
        ...preparedPayload,
        id: crypto.randomUUID(),
        department_ids: membership.departmentIds,
        primary_department_id: membership.primaryDepartmentId
      };
      setDoctors((current) => [...current, created]);
      return created;
    }
    const { data, error } = await supabase.from("doctors").insert(preparedPayload).select().single();
    if (error) {
      setNotice(error.message);
      return null;
    }
    const relationshipError = await saveDoctorDepartments(data.id, membership);
    if (relationshipError) {
      setNotice(`สร้างแพทย์แล้วแต่บันทึกแผนกไม่สำเร็จ: ${relationshipError.message}`);
      return null;
    }
    const created = attachDoctorDepartments([data], membership.departmentIds.map((departmentId) => ({
      doctor_id: data.id,
      department_id: departmentId,
      is_primary: departmentId === membership.primaryDepartmentId
    })))[0];
    setDoctors((current) => [...current, created]);
    return created;
  }

  async function importDoctorsFromExcel(rows) {
    if (!isAdmin) {
      setNotice("เฉพาะ Admin เท่านั้นที่นำเข้าข้อมูลจาก Excel ได้");
      return null;
    }

    const departmentPool = [...departments];
    const doctorPool = [...doctors];
    const summary = { departmentsCreated: 0, doctorsCreated: 0, departmentLinksAdded: 0, doctorsSkipped: 0, failed: 0 };

    for (const row of rows) {
      let department = findImportDepartment(row, departmentPool);
      if (!department) {
        department = await createDepartment({
          name_th: row.department_th,
          name_en: row.department_en,
          description_th: "",
          description_en: ""
        });
        if (!department) {
          summary.failed += 1;
          continue;
        }
        departmentPool.push(department);
        summary.departmentsCreated += 1;
      }

      if (isImportedDoctorDuplicate(row, department.id, doctorPool)) {
        summary.doctorsSkipped += 1;
        continue;
      }

      const existingDoctor = findImportedDoctor(row, doctorPool);
      if (existingDoctor) {
        const departmentIds = [...new Set([...getDoctorDepartmentIds(existingDoctor), department.id])];
        const updatedDoctor = await updateDoctor(existingDoctor.id, {
          name_th: existingDoctor.name_th || "",
          name_en: existingDoctor.name_en || existingDoctor.name || "",
          specialty_th: existingDoctor.specialty_th || row.specialty_th || "",
          specialty_en: existingDoctor.specialty_en || existingDoctor.specialty || row.specialty_en || "",
          image_url: existingDoctor.image_url || "",
          is_active: existingDoctor.is_active !== false,
          department_ids: departmentIds,
          primary_department_id: existingDoctor.primary_department_id || existingDoctor.department_id || departmentIds[0]
        });
        if (!updatedDoctor) {
          summary.failed += 1;
          continue;
        }
        const doctorIndex = doctorPool.findIndex((doctor) => doctor.id === existingDoctor.id);
        doctorPool[doctorIndex] = updatedDoctor;
        summary.departmentLinksAdded += 1;
        continue;
      }

      const doctor = await createDoctor({
        name_th: row.doctor_th,
        name_en: row.doctor_en,
        specialty_th: row.specialty_th,
        specialty_en: row.specialty_en,
        department_id: department.id,
        department_ids: [department.id],
        primary_department_id: department.id,
        image_url: ""
      });
      if (!doctor) {
        summary.failed += 1;
        continue;
      }
      doctorPool.push(doctor);
      summary.doctorsCreated += 1;
    }

    setNotice(`Import เสร็จแล้ว: เพิ่มแพทย์ ${summary.doctorsCreated} คน, แผนก ${summary.departmentsCreated} แผนก และสังกัดเพิ่ม ${summary.departmentLinksAdded} รายการ`);
    return summary;
  }

  async function updateDoctor(id, payload) {
    if (hasSupabaseConfig && !canManage) {
      setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
      return null;
    }
    const existingDoctor = doctors.find((doctor) => doctor.id === id);
    const membership = normalizeDoctorDepartments({ ...existingDoctor, ...payload });
    if (!membership.departmentIds.length) {
      setNotice("กรุณาเลือกแผนกของแพทย์อย่างน้อยหนึ่งแผนก");
      return null;
    }
    const preparedPayload = prepareDoctorPayload({ ...payload, department_id: membership.primaryDepartmentId });
    if (!hasSupabaseConfig) {
      const updated = {
        ...preparedPayload,
        id,
        department_ids: membership.departmentIds,
        primary_department_id: membership.primaryDepartmentId
      };
      setDoctors((current) => current.map((doctor) => doctor.id === id ? { ...doctor, ...updated } : doctor));
      setNotice("แก้ไขข้อมูลแพทย์แล้ว");
      return updated;
    }
    const { data, error } = await supabase.from("doctors").update(preparedPayload).eq("id", id).select().single();
    if (error) {
      setNotice(error.message);
      return null;
    }
    const relationshipError = await saveDoctorDepartments(id, membership);
    if (relationshipError) {
      setNotice(`บันทึกข้อมูลแพทย์แล้วแต่บันทึกแผนกไม่สำเร็จ: ${relationshipError.message}`);
      return null;
    }
    const updated = attachDoctorDepartments([data], membership.departmentIds.map((departmentId) => ({
      doctor_id: id,
      department_id: departmentId,
      is_primary: departmentId === membership.primaryDepartmentId
    })))[0];
    setDoctors((current) => current.map((doctor) => doctor.id === id ? updated : doctor));
    setNotice("แก้ไขข้อมูลแพทย์เรียบร้อย");
    return updated;
  }

  async function saveDoctorDepartments(doctorId, membership) {
    const { error } = await supabase.rpc("set_doctor_departments", {
      p_doctor_id: doctorId,
      p_department_ids: membership.departmentIds,
      p_primary_department_id: membership.primaryDepartmentId
    });
    return error;
  }

  async function toggleDoctorActive(doctor) {
    await updateDoctor(doctor.id, { is_active: doctor.is_active === false });
  }

  async function deleteDoctor(id) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    if (!hasSupabaseConfig) {
      setDoctors((current) => current.filter((doctor) => doctor.id !== id));
      setSchedules((current) => current.filter((schedule) => schedule.doctor_id !== id));
      return;
    }
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) return setNotice(error.message);
    setDoctors((current) => current.filter((doctor) => doctor.id !== id));
  }

  async function saveSchedules(rows) {
    if (hasSupabaseConfig && !canManage) {
      setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการตารางเวร");
      return false;
    }
    if (!rows.length) {
      setNotice("ไม่มีการเปลี่ยนแปลงใหม่ให้บันทึก");
      return false;
    }

    const cleanedRows = rows.map((row) => ({
      doctor_id: row.doctor_id,
      date: row.date,
      ...Object.fromEntries(hourKeys.map((hour) => [hour, Boolean(row[hour])]))
    }));

    if (!hasSupabaseConfig) {
      setSchedules((current) => {
        const incomingKeys = new Set(cleanedRows.map((row) => `${row.doctor_id}-${row.date}`));
        const stampedRows = cleanedRows.map((row) => ({
          ...row,
          created_at: row.created_at || new Date(Date.now() - 2000).toISOString(),
          updated_at: new Date().toISOString()
        }));
        return [
          ...current.filter((row) => !incomingKeys.has(`${row.doctor_id}-${row.date}`)),
          ...stampedRows
        ];
      });
      setNotice("บันทึกลง demo state แล้ว");
      return true;
    }

    const { data, error } = await supabase
      .from("schedules")
      .upsert(cleanedRows, { onConflict: "doctor_id,date" })
      .select();

    if (error) {
      setNotice(error.message);
      return false;
    }

    setSchedules((current) => {
      const incomingKeys = new Set(data.map((row) => `${row.doctor_id}-${row.date}`));
      return [
        ...current.filter((row) => !incomingKeys.has(`${row.doctor_id}-${row.date}`)),
        ...data
      ];
    });
    setNotice("บันทึกตารางเวรเรียบร้อย");
    return true;
  }

  async function copyMonthToNextMonth(doctorId, anchorDate) {
    if (hasSupabaseConfig && !canManage) {
      setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการตารางเวร");
      return [];
    }

    const sourceYear = anchorDate.getFullYear();
    const sourceMonth = anchorDate.getMonth();
    const lastDayOfSourceMonth = new Date(sourceYear, sourceMonth + 1, 0).getDate();
    const targetDateSeed = new Date(sourceYear, sourceMonth + 1, 1);
    const targetYear = targetDateSeed.getFullYear();
    const targetMonth = targetDateSeed.getMonth();
    const lastDayOfNextMonth = new Date(sourceYear, sourceMonth + 2, 0).getDate();

    const sourceRows = schedules.filter((schedule) => {
      if (schedule.doctor_id !== doctorId) return false;
      const scheduleDate = new Date(`${schedule.date}T00:00:00`);
      return scheduleDate.getFullYear() === sourceYear && scheduleDate.getMonth() === sourceMonth;
    });

    if (!sourceRows.length) {
      setNotice("ไม่พบตารางของแพทย์คนนี้ในเดือนที่เลือก");
      return [];
    }

    const sourceRowsByDate = new Map(sourceRows.map((row) => [row.date, row]));
    const sourcePattern = new Map();
    const lastSourceByWeekday = new Map();

    for (let day = 1; day <= lastDayOfSourceMonth; day += 1) {
      const date = new Date(sourceYear, sourceMonth, day);
      const weekday = date.getDay();
      const occurrence = Math.floor((day - 1) / 7) + 1;
      const source = sourceRowsByDate.get(toISODate(date)) || null;
      sourcePattern.set(`${weekday}-${occurrence}`, source);
      lastSourceByWeekday.set(weekday, source);
    }

    const rowsForNextMonth = [];
    for (let day = 1; day <= lastDayOfNextMonth; day += 1) {
      const targetDate = new Date(targetYear, targetMonth, day);
      const weekday = targetDate.getDay();
      const occurrence = Math.floor((day - 1) / 7) + 1;
      const patternKey = `${weekday}-${occurrence}`;
      const source = sourcePattern.has(patternKey)
        ? sourcePattern.get(patternKey)
        : lastSourceByWeekday.get(weekday) || null;

      rowsForNextMonth.push({
        ...makeScheduleRow(doctorId, targetDate),
        ...Object.fromEntries(hourKeys.map((hour) => [hour, Boolean(source?.[hour])]))
      });
    }

    setNotice(`เตรียมตาราง ${rowsForNextMonth.length} วัน สำหรับเดือนถัดไปแล้ว กรุณากด Save Changes`);
    return rowsForNextMonth;
  }

  async function saveConsultAssignments(rows) {
    if (!isAdmin) {
      setNotice("เฉพาะ Admin เท่านั้นที่จัดตาราง Consult ได้");
      return false;
    }
    if (!rows.length) {
      setNotice("ไม่มีการเปลี่ยนแปลงตาราง Consult ให้บันทึก");
      return false;
    }

    if (!hasSupabaseConfig) {
      setConsultAssignments((current) => {
        const incomingKeys = new Set(rows.map((row) => `${row.department_id}-${row.date}-${row.shift_key}`));
        const stampedRows = rows.map((row) => ({
          ...row,
          id: current.find((item) => `${item.department_id}-${item.date}-${item.shift_key}` === `${row.department_id}-${row.date}-${row.shift_key}`)?.id || crypto.randomUUID(),
          updated_at: new Date().toISOString()
        }));
        return [
          ...current.filter((row) => !incomingKeys.has(`${row.department_id}-${row.date}-${row.shift_key}`)),
          ...stampedRows
        ];
      });
      setNotice("บันทึกตาราง Consult ใน demo mode แล้ว");
      return true;
    }

    const { data, error } = await supabase
      .from("consult_assignments")
      .upsert(rows, { onConflict: "department_id,date,shift_key" })
      .select();

    if (error) {
      setNotice(error.message);
      return false;
    }

    setConsultAssignments((current) => {
      const incomingKeys = new Set(data.map((row) => `${row.department_id}-${row.date}-${row.shift_key}`));
      return [
        ...current.filter((row) => !incomingKeys.has(`${row.department_id}-${row.date}-${row.shift_key}`)),
        ...data
      ];
    });
    setNotice("บันทึกตาราง Consult เรียบร้อย");
    return true;
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setNotice(error.message);
    setNotice("เข้าสู่ระบบแล้ว");
  }

  async function signUp({ email, password, fullName }) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) return setNotice(error.message);
    setNotice("สร้างบัญชีแล้ว ถ้าเปิด email confirmation ให้ยืนยันอีเมลก่อน login");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return setNotice(error.message);
    setNotice("ออกจากระบบแล้ว");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={hospitalLogo}
              alt="โรงพยาบาลพริ้นซ์ ปากน้ำโพ"
              className="h-14 w-12 shrink-0 object-contain sm:h-16 sm:w-14"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{copy.appTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-hospital-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Language">
            {[
              ["th", "ไทย"],
              ["en", "EN"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                aria-pressed={language === value}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${language === value ? "bg-white text-hospital-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {(notice || loading) && (
          <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
            {loading ? copy.loading : notice}
          </div>
        )}

        {activeTab === "public" && (
          <PublicDashboard
            departments={activeDepartments}
            doctors={activeDoctors}
            schedules={schedules}
            weeklyChanges={weeklyChanges}
            selectedDepartmentId={selectedDepartmentId}
            setSelectedDepartmentId={setSelectedDepartmentId}
            onOpenWeekly={setWeeklyDoctor}
            language={language}
          />
        )}

        {activeTab === "admin-login" && (
          <AuthPanel
            session={session}
            profile={profile}
            canManage={canManage}
            hasConfig={hasSupabaseConfig}
            onSignIn={signIn}
            onSignUp={signUp}
            onSignOut={signOut}
          />
        )}

        {activeTab === "consult" && (
          <ConsultDashboard
            departments={activeDepartments}
            doctors={activeDoctors}
            assignments={consultAssignments}
            language={language}
          />
        )}

        {activeTab === "admin-directory" && canManage && (
          <AdminDepartmentsDoctors
            departments={departments}
            doctors={doctors}
            onCreateDepartment={createDepartment}
            onUpdateDepartment={updateDepartment}
            onToggleDepartmentActive={toggleDepartmentActive}
            onCreateDoctor={createDoctor}
            onUpdateDoctor={updateDoctor}
            onToggleDoctorActive={toggleDoctorActive}
            onUploadDoctorImage={uploadDoctorImage}
            canImport={isAdmin}
            onImportDoctors={importDoctorsFromExcel}
          />
        )}

        {activeTab === "admin-consult" && isAdmin && (
          <AdminConsultScheduler
            departments={activeDepartments}
            doctors={activeDoctors}
            assignments={consultAssignments}
            onSave={saveConsultAssignments}
          />
        )}

        {activeTab === "admin-users" && isAdmin && (
          <AdminUserManagement
            users={users}
            currentUserId={session?.user?.id}
            onUpdateAccess={updateUserAccess}
          />
        )}

        {activeTab === "admin-scheduler" && canManage && (
          <AdminScheduler
            departments={activeDepartments}
            doctors={activeDoctors}
            schedules={schedules}
            onSaveSchedules={saveSchedules}
            onCopyMonth={copyMonthToNextMonth}
            canExport={isAdmin}
          />
        )}
      </main>

      <WeeklyCalendarModal
        doctor={weeklyDoctor}
        schedules={schedules.filter((schedule) => schedule.doctor_id === weeklyDoctor?.id)}
        onClose={() => setWeeklyDoctor(null)}
        language={language}
      />
    </div>
  );
}

function prepareDepartmentPayload(payload) {
  if (!("name_th" in payload) && !("name_en" in payload)) return payload;
  const name = payload.name_th?.trim() || payload.name_en?.trim() || payload.name || "";
  const description = payload.description_th?.trim() || payload.description_en?.trim() || payload.description || "";
  return { ...payload, name, description };
}

function prepareDoctorPayload(payload) {
  const { department_ids, primary_department_id, ...basePayload } = payload;
  if (!("name_th" in basePayload) && !("name_en" in basePayload)) return basePayload;
  const name = basePayload.name_th?.trim() || basePayload.name_en?.trim() || basePayload.name || "";
  const specialty = basePayload.specialty_th?.trim() || basePayload.specialty_en?.trim() || basePayload.specialty || "";
  return { ...basePayload, name, specialty };
}

function makeScheduleRow(doctorId, date) {
  return {
    doctor_id: doctorId,
    date: toISODate(date),
    ...Object.fromEntries(hourKeys.map((hour) => [hour, false]))
  };
}
