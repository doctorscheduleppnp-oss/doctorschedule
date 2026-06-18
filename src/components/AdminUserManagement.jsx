import React, { useMemo, useState } from "react";

const statusLabels = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว"
};

const statusClasses = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800"
};

const filters = [
  ["pending", "รออนุมัติ"],
  ["approved", "อนุมัติแล้ว"],
  ["rejected", "ปฏิเสธแล้ว"],
  ["all", "ทั้งหมด"]
];

export default function AdminUserManagement({ users, currentUserId, onUpdateAccess }) {
  const [filter, setFilter] = useState("pending");
  const [busyUserId, setBusyUserId] = useState(null);

  const visibleUsers = useMemo(() => {
    const filtered = filter === "all" ? users : users.filter((user) => user.status === filter);
    return [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filter, users]);

  async function updateAccess(user, role, status) {
    if (role === "admin") {
      const confirmed = window.confirm(
        `ยืนยันแต่งตั้ง ${user.full_name || user.email || "ผู้ใช้นี้"} เป็น Admin?\n\nAdmin จะจัดการผู้ใช้และกำหนดสิทธิ์ผู้อื่นได้`
      );
      if (!confirmed) return;
    }

    setBusyUserId(user.id);
    try {
      await onUpdateAccess(user.id, { role, status });
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-hospital-700">Admin only</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">จัดการผู้ใช้งาน</h2>
        <p className="mt-2 text-sm text-slate-500">
          อนุมัติผู้สมัครและกำหนดสิทธิ์การเข้าถึงระบบ ระบบจะบันทึกผู้ดำเนินการและเวลาที่เปลี่ยนสิทธิ์ทุกครั้ง
        </p>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="กรองผู้ใช้งานตามสถานะ">
          {filters.map(([value, label]) => {
            const count = value === "all" ? users.length : users.filter((user) => user.status === value).length;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  filter === value
                    ? "bg-hospital-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {visibleUsers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          ไม่พบผู้ใช้งานในสถานะนี้
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleUsers.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const isBusy = busyUserId === user.id;
            return (
              <article key={user.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-slate-950">
                        {user.full_name || "ยังไม่ได้ระบุชื่อ"}
                      </h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[user.status]}`}>
                        {statusLabels[user.status] || user.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                        {user.role}
                      </span>
                      {isCurrentUser ? (
                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">บัญชีของคุณ</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{user.email || "ไม่มีข้อมูลอีเมล"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      สมัครเมื่อ {formatDateTime(user.created_at)}
                    </p>
                  </div>

                  {isCurrentUser ? (
                    <p className="text-sm font-medium text-slate-500">ไม่สามารถเปลี่ยนสิทธิ์บัญชีตัวเองได้</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy || (user.status === "approved" && user.role === "staff")}
                        onClick={() => updateAccess(user, "staff", "approved")}
                        className="rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hospital-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        อนุมัติเป็น Staff
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || (user.status === "approved" && user.role === "admin")}
                        onClick={() => updateAccess(user, "admin", "approved")}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        แต่งตั้งเป็น Admin
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || user.status === "rejected"}
                        onClick={() => updateAccess(user, "viewer", "rejected")}
                        className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return "ไม่ทราบวันที่";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
