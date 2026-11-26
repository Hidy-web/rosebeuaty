"use client";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import type { Region, Settings } from "@/lib/types";
import { DEFAULT_EXTRA_NOTICE, hm } from "@/lib/time";
import type { TabProps } from "./AdminApp";
import { DEFAULT_PROMISE, DEFAULT_REFUND_POLICY } from "@/lib/pricing";

const HOURS = Array.from({ length: 33 }, (_, i) => 300 + i * 30); // 05:00 ~ 21:00

export default function SettingsTab({ data, reload, toast }: TabProps) {
  const [s, setS] = useState<Settings>(data.settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const setRegion = (i: number, patch: Partial<Region>) => set("regions", s.regions.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const early = s.early_fees ?? [{ before: 420, fee: 30000 }, { before: 360, fee: 50000 }];
  const setEarly = (v: { before: number; fee: number }[]) => set("early_fees", v);
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

  async function save() {
    if (s.close_min <= s.open_min) return toast("마지막 방문 가능 시간이 시작 시간보다 늦어야 해요");
    if (s.kakaopay_url && !/^https:\/\/qr\.kakaopay\.com\/\S+$/.test(s.kakaopay_url)) return toast("카카오페이 송금 링크는 https://qr.kakaopay.com/ 으로 시작해야 해요");
    if (!s.regions.length) return toast("지역을 하나 이상 남겨 주세요");
    if (s.regions.some((r) => !r.name.trim())) return toast("지역 이름을 입력해 주세요");
    setSaving(true);
    const { id: _id, closed_dates: _c, ...patch } = s;
    void _id; void _c;
    const { error } = await sb().from("settings").update({ ...patch, regions: s.regions.map((r) => ({ ...r, name: r.name.trim() })) }).eq("id", 1);
    setSaving(false);
    if (error) return toast(/confirm_days|retention_months|privacy_|extra_notice|early_fees|weekday_discount|group_|deposit_pct|refund_policy|promise|kakaopay_url/.test(error.message) ? "데이터베이스 업데이트가 필요해요. 안내받은 SQL을 먼저 실행해 주세요" : "저장하지 못했어요. 다시 시도해 주세요");
    toast("설정을 저장했어요");
    reload();
  }

  return (
    <section className="panel">
      <h2>설정</h2>
      <p className="note">바꾼 뒤 아래 &ldquo;저장&rdquo;을 눌러야 손님 화면에 반영돼요. &ldquo;행사일 며칠 전까지 확정&rdquo;을 0으로 두면 그 안내는 손님 화면에 나오지 않아요.</p>
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
        <div className="field"><label htmlFor="s-kp">카카오페이 송금 링크 (선택)</label><input id="s-kp" value={s.kakaopay_url ?? ""} onChange={(e) => set("kakaopay_url", e.target.value.trim())} placeholder="https://qr.kakaopay.com/..." inputMode="url" /></div>
        <div className="field"><label htmlFor="s-dpct">예약금 비율 (총 금액의 %, 0이면 고정 금액)</label><input id="s-dpct" type="number" min={0} max={100} step={5} value={s.deposit_pct ?? 20} onChange={(e) => set("deposit_pct", num(e.target.value, 0, 100))} /></div>
        <div className="field"><label htmlFor="s-dep">{(s.deposit_pct ?? 20) > 0 ? "최소 예약금 (원)" : "예약금 (원)"}</label><input id="s-dep" type="number" min={0} step={1000} value={s.deposit} onChange={(e) => set("deposit", Math.max(0, Number(e.target.value) || 0))} /></div>
        <div className="field"><label htmlFor="s-dl">입금 기한 (시간)</label><input id="s-dl" type="number" min={1} max={72} value={s.deadline_hours} onChange={(e) => set("deadline_hours", Math.min(72, Math.max(1, Number(e.target.value) || 1)))} /></div>
        <div className="field"><label htmlFor="s-cd">행사일 며칠 전까지 확정 (일)</label><input id="s-cd" type="number" min={0} max={30} value={s.confirm_days ?? 3} onChange={(e) => set("confirm_days", Math.min(30, Math.max(0, Number(e.target.value) || 0)))} /></div>
      </div>
      <h3>할인</h3>
      <p className="note">할인은 시술 금액에만 적용돼요. 0으로 두면 꺼져요.</p>
      <div className="settings">
        <div className="field"><label htmlFor="s-wd">평일(월~금) 할인 (%)</label><input id="s-wd" type="number" min={0} max={50} value={s.weekday_discount_pct ?? 10} onChange={(e) => set("weekday_discount_pct", num(e.target.value, 0, 50))} /></div>
        <div className="field"><label htmlFor="s-gm">인원 할인 기준 (명 이상)</label><input id="s-gm" type="number" min={0} max={20} value={s.group_min ?? 4} onChange={(e) => set("group_min", num(e.target.value, 0, 20))} /></div>
        <div className="field"><label htmlFor="s-gd">인원 할인 (1인당, 원)</label><input id="s-gd" type="number" min={0} step={5000} value={s.group_discount ?? 10000} onChange={(e) => set("group_discount", num(e.target.value, 0, 1000000))} /></div>
      </div>
      <h3>이른 시간 할증</h3>
      <p className="note">정한 시각보다 일찍 시작하면 방문 1회당 붙어요. 여러 개에 해당하면 가장 큰 금액 하나만 붙어요. 이른 시간 예약을 받으려면 아래 &ldquo;가장 이른 방문&rdquo;도 앞당겨 주세요.</p>
      {early.map((t, i) => (
        <div className="price-row svc-edit" key={i}>
          <select aria-label="기준 시각" value={t.before} onChange={(e) => setEarly(early.map((x, j) => (j === i ? { ...x, before: Number(e.target.value) } : x)))}>
            {HOURS.filter((m) => m <= 600).map((m) => <option key={m} value={m}>{hm(m)} 전 시작</option>)}
          </select>
          <span className="pinput">
            <input className="num" type="number" min={0} step={5000} aria-label="할증 금액" value={t.fee} onChange={(e) => setEarly(early.map((x, j) => (j === i ? { ...x, fee: num(e.target.value, 0, 1000000) } : x)))} />
            <span className="muted">원</span>
          </span>
          <button className="btn sm danger" onClick={() => setEarly(early.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <div><button className="btn sm ghost" onClick={() => setEarly([...early, { before: 300, fee: 70000 }])}>+ 할증 추가</button></div>
      <h3>취소·환불 규정</h3>
      <p className="note">손님이 예약 신청 전에 이 규정에 [필수] 동의해요. 메뉴·가격 화면에도 보여요. 한 줄에 하나씩 적어 주세요.</p>
      <div className="field"><label htmlFor="s-refund">규정</label>
        <textarea id="s-refund" rows={7} value={s.refund_policy ?? DEFAULT_REFUND_POLICY} onChange={(e) => set("refund_policy", e.target.value)} /></div>
      <h3>약속 문구</h3>
      <p className="note">첫 화면과 예약 완료 화면에 보여요. 비우면 나오지 않아요.</p>
      <div className="field"><label htmlFor="s-promise">문구</label>
        <input id="s-promise" value={s.promise ?? DEFAULT_PROMISE} onChange={(e) => set("promise", e.target.value)} /></div>
      <h3>별도 비용 안내</h3>
      <p className="note">메뉴·가격 화면과 예약 신청 화면에 보여요. 한 줄에 하나씩 적어 주세요. 비우면 안내가 나오지 않아요.</p>
      <div className="field"><label htmlFor="s-extra">안내 문구</label>
        <textarea id="s-extra" rows={3} value={s.extra_notice ?? DEFAULT_EXTRA_NOTICE} onChange={(e) => set("extra_notice", e.target.value)} /></div>
      <h3>개인정보</h3>
      <p className="note">손님 화면 아래 &ldquo;개인정보 처리방침&rdquo;에 그대로 보여요. 보관 기간이 지난 예약은 관리자 화면을 열 때 이름·연락처·주소가 자동으로 지워져요.</p>
      <div className="settings">
        <div className="field"><label htmlFor="s-ret">예약 정보 보관 기간 (행사일로부터, 개월)</label><input id="s-ret" type="number" min={1} max={60} value={s.retention_months ?? 12} onChange={(e) => set("retention_months", Math.min(60, Math.max(1, Number(e.target.value) || 1)))} /></div>
        <div className="field"><label htmlFor="s-po">개인정보 보호책임자</label><input id="s-po" value={s.privacy_officer ?? ""} onChange={(e) => set("privacy_officer", e.target.value)} placeholder="예: 대표 홍길동" /></div>
        <div className="field"><label htmlFor="s-pc">문의 연락처</label><input id="s-pc" value={s.privacy_contact ?? ""} onChange={(e) => set("privacy_contact", e.target.value)} placeholder="예: 010-0000-0000 또는 이메일" /></div>
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
