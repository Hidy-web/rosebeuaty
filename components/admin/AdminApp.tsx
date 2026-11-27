"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { Loading, Toast, useShopData, useToast } from "../useShopData";
import BookingsTab from "./BookingsTab";
import MenuTab from "./MenuTab";
import PortfolioTab from "./PortfolioTab";
import ReviewsTab from "./ReviewsTab";
import SettingsTab from "./SettingsTab";
import { dLabel, seoulNow } from "@/lib/time";

type Tab = "bookings" | "menu" | "portfolio" | "reviews" | "settings";

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const c = sb();
    c.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    sb()
      .rpc("is_admin")
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  if (session === undefined) return <Loading error={null} />;
  if (!session) return <Login />;
  if (isAdmin === null) return <Loading error={null} />;
  if (!isAdmin)
    return (
      <div className="center-msg">
        <h2>관리자 권한이 없는 계정이에요</h2>
        <p className="muted">
          이 계정({session.user.email})은 관리자로 등록되지 않았어요. 안내서의 &ldquo;관리자 등록&rdquo; 단계를 진행해 주세요.
        </p>
        <div>
          <button className="btn ghost" onClick={() => sb().auth.signOut()}>로그아웃</button>
        </div>
      </div>
    );
  return <Dashboard email={session.user.email ?? ""} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr("이메일이나 비밀번호가 맞지 않아요. 다시 확인해 주세요.");
  }
  return (
    <form className="login card" onSubmit={go}>
      <h2>관리자 로그인</h2>
      <div className="field">
        <label htmlFor="lg-email">이메일</label>
        <input id="lg-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="lg-pw">비밀번호</label>
        <input id="lg-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </div>
      {err && <p className="err">{err}</p>}
      <div>
        <button className="btn" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
      </div>
    </form>
  );
}

function Dashboard({ email }: { email: string }) {
  const { data, error, reload } = useShopData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("kakao") ? "settings" : "bookings",
  );
  const [pending, setPending] = useState(0);

  // 보관 기간이 지난 예약의 개인정보를 자동으로 지워요.
  useEffect(() => {
    sb().rpc("purge_expired_bookings").then(({ data: n }) => {
      if (typeof n === "number" && n > 0) toast.show(`보관 기간이 지난 예약 ${n}건의 개인정보를 지웠어요`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const tabs: [Tab, string][] = [
    ["bookings", "예약·일정"],
    ["menu", "메뉴 가격"],
    ["portfolio", "포트폴리오"],
    ["reviews", "리뷰"],
    ["settings", "설정"],
  ];
  const props = { data, reload, toast: toast.show };

  return (
    <div className="admin">
      <div className="panel-head">
        <div>
          <p className="eyebrow">관리자</p>
          <h1 style={{ fontSize: "1.8rem" }}>오늘은 {dLabel(seoulNow().date)}</h1>
        </div>
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {email} · <button className="btn sm ghost" onClick={() => sb().auth.signOut()}>로그아웃</button>
        </span>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
            {k === "bookings" && pending > 0 && <span className="badge num">{pending}</span>}
          </button>
        ))}
      </div>
      <div className={`admin-body admin-${tab}`}>
        {tab === "bookings" && <BookingsTab {...props} onPending={setPending} />}
        {tab === "menu" && <MenuTab {...props} />}
        {tab === "portfolio" && <PortfolioTab {...props} />}
        {tab === "reviews" && <ReviewsTab {...props} />}
        {tab === "settings" && <SettingsTab {...props} />}
      </div>
      <Toast msg={toast.msg} />
    </div>
  );
}

export type TabProps = {
  data: import("../useShopData").ShopData;
  reload: () => Promise<void>;
  toast: (m: string) => void;
};
