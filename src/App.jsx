import React, { useEffect, useMemo, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import AdminConsultScheduler from "./components/AdminConsultScheduler";
import AdminDepartmentsDoctors from "./components/AdminDepartmentsDoctors";
import AdminScheduler from "./components/AdminScheduler";
import AdminUserManagement from "./components/AdminUserManagement";
import ConsultDashboard from "./components/ConsultDashboard";
import PublicDashboard from "./components/PublicDashboard";
import WeeklyCalendarModal from "./components/WeeklyCalendarModal";
import { hasSupabaseConfig, supabase } from "./lib/supabase";
import { buildSampleConsultAssignments } from "./lib/consult";
import { buildSampleSchedules, sampleDepartments, sampleDoctors } from "./lib/sampleData";
import { getStartOfWeek, getWeekDays, hourKeys, toISODate } from "./lib/date";
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, translations } from "./lib/i18n";

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
  const [doctors, setDoctors] = useState(sampleDoctors);
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
    () => doctors.filter((doctor) => doctor.is_active !== false && activeDepartmentIds.has(doctor.department_id)),
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
      if (!doctor || doctor.is_active === false || !activeDepartmentIds.has(doctor.department_id)) return;

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
      const [departmentResult, doctorResult, scheduleResult, consultResult] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("doctors").select("*").order("name"),
        supabase.from("schedules").select("*").order("date"),
        supabase.from("consult_assignments").select("*").order("date")
      ]);

      if (departmentResult.error) throw departmentResult.error;
      if (doctorResult.error) throw doctorResult.error;
      if (scheduleResult.error) throw scheduleResult.error;

      setDepartments(departmentResult.data || []);
      setDoctors(doctorResult.data || []);
      setSchedules(scheduleResult.data || []);
      if (consultResult.error) {
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

  async function createDepartment(payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const preparedPayload = prepareDepartmentPayload(payload);
    if (!hasSupabaseConfig) {
      setDepartments((current) => [...current, { ...preparedPayload, id: crypto.randomUUID() }]);
      return;
    }
    const { data, error } = await supabase.from("departments").insert(preparedPayload).select().single();
    if (error) return setNotice(error.message);
    setDepartments((current) => [...current, data]);
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
      return "";
    }
    if (!hasSupabaseConfig) return URL.createObjectURL(file);

    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("doctor-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (error) {
      setNotice(error.message);
      return "";
    }
    const { data } = supabase.storage.from("doctor-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function createDoctor(payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const preparedPayload = prepareDoctorPayload(payload);
    if (!hasSupabaseConfig) {
      setDoctors((current) => [...current, { ...preparedPayload, id: crypto.randomUUID() }]);
      return;
    }
    const { data, error } = await supabase.from("doctors").insert(preparedPayload).select().single();
    if (error) return setNotice(error.message);
    setDoctors((current) => [...current, data]);
  }

  async function updateDoctor(id, payload) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูล");
    const preparedPayload = prepareDoctorPayload(payload);
    if (!hasSupabaseConfig) {
      setDoctors((current) => current.map((doctor) => doctor.id === id ? { ...doctor, ...preparedPayload } : doctor));
      setNotice("แก้ไขข้อมูลแพทย์แล้ว");
      return;
    }
    const { data, error } = await supabase.from("doctors").update(preparedPayload).eq("id", id).select().single();
    if (error) return setNotice(error.message);
    setDoctors((current) => current.map((doctor) => doctor.id === id ? data : doctor));
    setNotice("แก้ไขข้อมูลแพทย์เรียบร้อย");
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
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการตารางเวร");
    if (!rows.length) return setNotice("ไม่มีการเปลี่ยนแปลงใหม่ให้บันทึก");

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
      return;
    }

    const { data, error } = await supabase
      .from("schedules")
      .upsert(cleanedRows, { onConflict: "doctor_id,date" })
      .select();

    if (error) return setNotice(error.message);

    setSchedules((current) => {
      const incomingKeys = new Set(data.map((row) => `${row.doctor_id}-${row.date}`));
      return [
        ...current.filter((row) => !incomingKeys.has(`${row.doctor_id}-${row.date}`)),
        ...data
      ];
    });
    setNotice("บันทึกตารางเวรเรียบร้อย");
  }

  async function copyMonthToNextMonth(doctorId, anchorDate) {
    if (hasSupabaseConfig && !canManage) return setNotice("บัญชีนี้ไม่มีสิทธิ์จัดการตารางเวร");

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
      return setNotice("ไม่พบตารางของแพทย์คนนี้ในเดือนที่เลือก");
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

    await saveSchedules(rowsForNextMonth);
    setNotice(`คัดลอกตาราง ${rowsForNextMonth.length} วัน ไปเดือนถัดไปแล้ว`);
  }

  async function saveConsultAssignments(rows) {
    if (!isAdmin) return setNotice("เฉพาะ Admin เท่านั้นที่จัดตาราง Consult ได้");
    if (!rows.length) return setNotice("ไม่มีการเปลี่ยนแปลงตาราง Consult ให้บันทึก");

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
      return;
    }

    const { data, error } = await supabase
      .from("consult_assignments")
      .upsert(rows, { onConflict: "department_id,date,shift_key" })
      .select();

    if (error) return setNotice(error.message);

    setConsultAssignments((current) => {
      const incomingKeys = new Set(data.map((row) => `${row.department_id}-${row.date}-${row.shift_key}`));
      return [
        ...current.filter((row) => !incomingKeys.has(`${row.department_id}-${row.date}-${row.shift_key}`)),
        ...data
      ];
    });
    setNotice("บันทึกตาราง Consult เรียบร้อย");
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
          <div>
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
  if (!("name_th" in payload) && !("name_en" in payload)) return payload;
  const name = payload.name_th?.trim() || payload.name_en?.trim() || payload.name || "";
  const specialty = payload.specialty_th?.trim() || payload.specialty_en?.trim() || payload.specialty || "";
  return { ...payload, name, specialty };
}

function makeScheduleRow(doctorId, date) {
  return {
    doctor_id: doctorId,
    date: toISODate(date),
    ...Object.fromEntries(hourKeys.map((hour) => [hour, false]))
  };
}
