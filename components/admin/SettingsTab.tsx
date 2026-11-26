"use client";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import type { Region, Settings } from "@/lib/types";
import { hm } from "@/lib/time";
import type { TabProps } from "./AdminApp";

const HOURS = Array.from({ length: 33 }, (_, i) => 300 + i * 30); // 05:00 ~ 21:00

export default function SettingsTab({ data, reload, toast }: TabProps) {
  const [s, setS] = useState<Settings>(data.settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const setRegion = (i: number, patch: Partial<Region>) => set("regions", s.regions.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (s.close_min <= s.open_min) return toast("마지막 방문 가능 시간이 시작 시간보다 늦어야 해요");
    if (!s.regions.length) return toast("지역을 하나 이상 남겨 주세요");
    if (s.regions.some((r) => !r.name.trim())) return toast("지역 이름을 입력해 주세요");
    setSaving(true);
    const { id: _id, closed_dates: _c, ...patch } = s;
    void _id; void _c;
    const { error } = await sb().from("settings").update({ ...patch, regions: s.regions.map((r) => ({ ...r, name: r.name.trim() })) }).eq("id", 1);
    setSaving(false);
    if (error) return toast("저장하지 못했어요. 다시 시도해 주세요");
    toast("설정을 저장했어요");
    reload();
  }

  return (
    <section className="panel">
      <h2>설정</h2>
      <p className="note">바꾼 뒤 아래 &ldquo;저장&rdquo;을 눌러야 손님 화면에 반영돼요.</p>
      <h3>가게 정보</h3>
      <div className="settings">
        <div className="field"><label htmlFor="s-name">가게 이름</label><input id="s-name" value={s.shop_name} onChange={(e) => set("shop_name", e.target.value)} /></div>
        <div className="field"><label htmlFor="s-tag">첫 화면 문구</label><input id="s-tag" value={s.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
      </div>
      <h3>예약금 · 계좌</h3>
      <div className="settings">
        <div className="field"><label htmlFor="s-bank">은행</label><input id="s-bank" value={s.bank} onChange={(e) => set("bank", e.target.value)} placeholder="예: 국민은행" /></div>
        <div className="field"><label htmlFor="s-acct">계좌번호</label><input id="s-acct" value={s.account} onChange={(e) => set("account", e.target.value)} /></div>
        <div className="field"><label htmlFor="s-holder">예금주</label><input id="s-holder" value={s.holder} onChange={(e) => set("holder", e.target.value)} /></div>
        <div className="field"><label htmlFor="s-dep">예약금 (원)</label><input id="s-dep" type="number" min={0} step={1000} value={s.deposit} onChange={(e) => set("deposit", Math.max(0, Number(e.target.value) || 0))} /></div>
        <div className="field"><label htmlFor="s-dl">입금 기한 (시간)</label><input id="s-dl" type="number" min={1} max={72} value={s.deadline_hours} onChange={(e) => set("deadline_hours", Math.min(72, Math.max(1, Number(e.target.value) || 1)))} /></div>
      </div>
      <h3>방문 시간</h3>
      <div className="settings">
        <div className="field"><label htmlFor="s-open">가장 이른 방문</label>
          <select id="s-open" value={s.open_min} onChange={(e) => set("open_min", Number(e.target.value))}>{HOURS.map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></div>
        <div className="field"><label htmlFor="s-close">시술이 끝나야 하는 시간</label>
          <select id="s-close" value={s.close_min} onChange={(e) => set("close_min", Number(e.target.value))}>{HOURS.map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></div>
        <div className="field"><label htmlFor="s-buf">예약 사이 이동 시간</label>
          <select id="s-buf" value={s.buffer_min} onChange={(e) => set("buffer_min", Number(e.target.value))}>{[0, 30, 60, 90, 120].map((m) => <option key={m} value={m}>{m}분</option>)}</select></div>
      </div>
      <h3>출장 지역</h3>
      <p className="note">출장비를 비우면 손님 화면에 &ldquo;상담 후 안내&rdquo;로 보여요.</p>
      {s.regions.map((r, i) => (
        <div className="price-row svc-edit" key={r.id}>
          <input className="sname" value={r.name} aria-label="지역 이름" onChange={(e) => setRegion(i, { name: e.target.value })} />
          <span className="pinput">
            <input className="num" type="number" min={0} step={5000} aria-label={`${r.name} 출장비`} value={r.fee ?? ""} placeholder="상담"
              onChange={(e) => setRegion(i, { fee: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} />
            <span className="muted">원</span>
          </span>
          <button className="btn sm danger" onClick={() => set("regions", s.regions.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <div>
        <button className="btn sm ghost" onClick={() => set("regions", [...s.regions, { id: "r" + Date.now().toString(36), name: "", fee: 0 }])}>+ 지역 추가</button>
      </div>
      <div><button className="btn" disabled={saving} onClick={save}>{saving ? "저장 중…" : "저장"}</button></div>
      <PasswordBox toast={toast} />
    </section>
  );
}

function PasswordBox({ toast }: { toast: (m: string) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (pw.length < 8) return toast("비밀번호는 8자 이상으로 해 주세요");
    if (pw !== pw2) return toast("두 칸의 비밀번호가 달라요");
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(/different|same/i.test(error.message) ? "지금 비밀번호와 다른 비밀번호를 넣어 주세요" : "비밀번호를 바꾸지 못했어요. 다시 로그인한 뒤 시도해 주세요");
    setPw(""); setPw2("");
    toast("비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요");
  }

  return (
    <>
      <h3>관리자 비밀번호 바꾸기</h3>
      <div className="settings">
        <div className="field"><label htmlFor="s-pw">새 비밀번호</label><input id="s-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="field"><label htmlFor="s-pw2">새 비밀번호 한 번 더</label><input id="s-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      </div>
      <div><button className="btn ghost" disabled={busy || !pw} onClick={change}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</button></div>
    </>
  );
}
