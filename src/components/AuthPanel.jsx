import React, { useState } from "react";

export default function AuthPanel({ session, profile, canManage, onSignIn, onSignUp, onSignOut, hasConfig }) {
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-up") {
        await onSignUp({ email, password, fullName });
      } else {
        await onSignIn({ email, password });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!hasConfig) {
    return (
      <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 text-cyan-950">
        <h2 className="text-2xl font-semibold">Demo mode</h2>
        <p className="mt-2 text-sm">
          ใส่ค่า Supabase ในไฟล์ .env ก่อน แล้วระบบ login เจ้าหน้าที่จะเชื่อมต่อจริง
        </p>
      </section>
    );
  }

  if (session) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-hospital-700">Admin account</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              {profile?.full_name || session.user.email}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Role: <span className="font-semibold text-slate-800">{profile?.role || "viewer"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
        {!canManage && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {profile?.status === "rejected"
              ? "คำขอเข้าใช้งานของบัญชีนี้ถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ"
              : "บัญชีนี้กำลังรอ Admin อนุมัติ เมื่อได้รับอนุมัติเป็น Staff หรือ Admin แล้วจึงจะเข้าหน้าจัดการได้"}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
      <div>
        <p className="text-sm font-semibold text-hospital-700">Staff access</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">
          {mode === "sign-in" ? "เข้าสู่ระบบเจ้าหน้าที่" : "สมัครบัญชีเจ้าหน้าที่"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          คนไข้หรือผู้รับบริการไม่ต้อง login และใช้หน้า Public Dashboard ได้เลย
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-3">
        {mode === "sign-up" && (
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="ชื่อ-นามสกุล"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="อีเมล"
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
        />
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="รหัสผ่าน"
          minLength={6}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hospital-500"
        />
        <button
          disabled={busy}
          className="rounded-xl bg-hospital-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hospital-700 disabled:opacity-60"
        >
          {busy ? "กำลังดำเนินการ..." : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}
        className="mt-4 text-sm font-semibold text-hospital-700 hover:text-hospital-900"
      >
        {mode === "sign-in" ? "ยังไม่มีบัญชี? สมัครบัญชี" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
      </button>
    </section>
  );
}
