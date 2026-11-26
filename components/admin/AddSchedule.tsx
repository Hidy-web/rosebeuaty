"use client";
import { useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Booking } from "@/lib/types";
import type { ShopData } from "../useShopData";
import { dLabel, hm, won } from "@/lib/time";
import { price } from "@/lib/pricing";

const TIMES = Array.from({ length: 37 }, (_, i) => 240 + i * 30); // 04:00 ~ 22:00

/** 전화·카톡으로 받은 예약이나 개인 일정을 관리자가 직접 넣어요. 넣은 시간은 손님 화면에서 막혀요. */
export default function AddSchedule({ data, day, rows, onClose, onSaved, toast }: {
  data: ShopData; day: string; rows: Booking[]; onClose: () => void; onSaved: () => void; toast: (m: string) => void;
}) {
  const { settings: st, services, cats } = data;
  const [kind, setKind] = useState<"manual" | "block">("manual");
  const [date, setDate] = useState(day);
  const [start, setStart] = useState(600);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [f, setF] = useState({ name: "", phone: "", address: "", memo: "", status: "confirmed" as Booking["status"] });
  const [blockEnd, setBlockEnd] = useState(720);
  const [durOverride, setDurOverride] = useState<number | null>(null);
  const [totalOverride, setTotalOverride] = useState<string>("");
  const [depositOverride, setDepositOverride] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const live = services.filter((s) => !s.deleted);
  const items = Object.entries(cart).filter(([, n]) => n > 0).map(([id, n]) => ({ svc: live.find((s) => s.id === id)!, n })).filter((x) => x.svc);
  const subtotal = items.reduce((a, i) => a + i.svc.price * i.n, 0);
  const people = items.reduce((a, i) => a + i.n, 0);
  const autoDur = Math.max(30, items.reduce((a, i) => a + i.svc.duration_min * i.n, 0));
  const dur = kind === "block" ? Math.max(30, blockEnd - start) : durOverride ?? autoDur;
  const pr = price(st, { subtotal, people, travelFee: 0, date, start });
  const total = totalOverride.trim() ? Math.max(0, Math.round(Number(totalOverride) || 0)) : pr.total;
  const deposit = depositOverride.trim() ? Math.max(0, Math.round(Number(depositOverride) || 0)) : Math.min(pr.deposit, total);

  const clash = useMemo(
    () => rows.filter((b) => b.date === date && b.status !== "canceled" && b.status !== "done" && start < b.start_min + b.duration_min && start + dur > b.start_min),
    [rows, date, start, dur]
  );

  async function save() {
    if (kind === "manual" && !f.name.trim()) return toast("손님 이름을 입력해 주세요");
    if (kind === "manual" && !items.length) return toast("메뉴를 하나 이상 골라 주세요");
    if (kind === "block" && blockEnd <= start) return toast("끝나는 시간이 시작보다 늦어야 해요");
    setBusy(true);
    const code = (kind === "block" ? "B" : "M") + date.slice(5).replace("-", "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const row: Record<string, unknown> =
      kind === "block"
        ? { kind, code, name: f.memo.trim() || "개인 일정", phone: "", items: [], region: "", region_name: "", address: "", event_note: "",
            date, start_min: start, duration_min: dur, subtotal: 0, travel_fee: 0, total: 0, deposit: 0, status: "confirmed", memo: f.memo.trim() }
        : { kind, code, name: f.name.trim().slice(0, 20), phone: f.phone.trim(), region: st.regions[0]?.id ?? "seoul", region_name: st.regions[0]?.name ?? "",
            items: items.map((i) => ({ id: i.svc.id, name: i.svc.name, price: i.svc.price, n: i.n })),
            address: f.address.trim(), event_note: "", date, start_min: start, duration_min: dur, subtotal, travel_fee: 0,
            total, deposit, early_fee: pr.early, discount: pr.discount, status: f.status, memo: f.memo.trim() };
    const { error } = await sb().from("bookings").insert(row);
    setBusy(false);
    if (error) return toast(/kind/.test(error.message) ? "데이터베이스 업데이트가 필요해요. 안내받은 SQL을 먼저 실행해 주세요" : "저장하지 못했어요. 다시 시도해 주세요");
    toast(kind === "block" ? "시간을 막았어요. 손님 화면에서 이 시간은 예약할 수 없어요" : "일정을 등록했어요. 손님 화면에서 이 시간은 막혀요");
    onSaved();
  }

  return (
    <div className="add-sched">
      <div className="panel-head">
        <h3 style={{ margin: 0 }}>일정 직접 추가</h3>
        <button className="btn sm ghost" onClick={onClose}>닫기</button>
      </div>
      <div className="filters">
        <button className="chip" aria-pressed={kind === "manual"} onClick={() => setKind("manual")}>전화·카톡 예약</button>
        <button className="chip" aria-pressed={kind === "block"} onClick={() => setKind("block")}>개인 일정 (시간 막기)</button>
      </div>
      <div className="settings">
        <div className="field"><label htmlFor="as-date">날짜</label><input id="as-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="as-start">시작 시간</label>
          <select id="as-start" value={start} onChange={(e) => setStart(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{hm(t)}</option>)}</select></div>
        {kind === "block" ? (
          <div className="field"><label htmlFor="as-end">끝나는 시간</label>
            <select id="as-end" value={blockEnd} onChange={(e) => setBlockEnd(Number(e.target.value))}>{TIMES.map((t) => <option key={t} value={t}>{hm(t)}</option>)}</select></div>
        ) : (
          <div className="field"><label htmlFor="as-dur">걸리는 시간</label>
            <select id="as-dur" value={dur} onChange={(e) => setDurOverride(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => 30 + i * 30).map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? " 30분" : ""}` : "30분"}</option>)}
            </select></div>
        )}
      </div>

      {kind === "block" ? (
        <div className="field"><label htmlFor="as-memo">메모 (손님에게는 보이지 않아요)</label><input id="as-memo" value={f.memo} maxLength={100} onChange={(e) => setF({ ...f, memo: e.target.value })} placeholder="예: 개인 일정, 교육, 다른 출장" /></div>
      ) : (
        <>
          <div className="settings">
            <div className="field"><label htmlFor="as-name">손님 이름</label><input id="as-name" value={f.name} maxLength={20} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="as-phone">연락처</label><input id="as-phone" value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="010-0000-0000" /></div>
          </div>
          <div className="field"><label htmlFor="as-addr">방문 주소</label><input id="as-addr" value={f.address} maxLength={200} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="field">
            <label>메뉴</label>
            <div className="as-menu">
              {cats.map((c) => live.filter((s) => s.category_id === c.id).map((s) => {
                const n = cart[s.id] ?? 0;
                return (
                  <div className="as-item" key={s.id}>
                    <span>{s.name} <small className="muted num">{won(s.price)}</small></span>
                    <span className="counter">
                      <button onClick={() => setCart({ ...cart, [s.id]: Math.max(0, n - 1) })} disabled={!n} aria-label={`${s.name} 빼기`}>−</button>
                      <span className="n num">{n}</span>
                      <button onClick={() => setCart({ ...cart, [s.id]: Math.min(10, n + 1) })} aria-label={`${s.name} 더하기`}>+</button>
                    </span>
                  </div>
                );
              }))}
            </div>
          </div>
          <div className="settings">
            <div className="field"><label htmlFor="as-total">총 금액 (원)</label><input id="as-total" type="number" min={0} step={5000} value={totalOverride} placeholder={String(pr.total)} onChange={(e) => setTotalOverride(e.target.value)} /></div>
            <div className="field"><label htmlFor="as-dep">예약금 (원)</label><input id="as-dep" type="number" min={0} step={5000} value={depositOverride} placeholder={String(Math.min(pr.deposit, total))} onChange={(e) => setDepositOverride(e.target.value)} /></div>
            <div className="field"><label htmlFor="as-status">상태</label>
              <select id="as-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Booking["status"] })}>
                <option value="confirmed">확정 (예약금 받음)</option>
                <option value="pending">입금 대기</option>
              </select></div>
          </div>
          <p className="note">금액 칸을 비워 두면 할인·할증 규칙대로 자동 계산돼요. 현장 결제 금액은 {won(Math.max(0, total - deposit))}이에요.</p>
          <div className="field"><label htmlFor="as-memo2">메모</label><input id="as-memo2" value={f.memo} maxLength={500} onChange={(e) => setF({ ...f, memo: e.target.value })} placeholder="행사 종류, 요청사항 등" /></div>
        </>
      )}

      <p className="note num">{dLabel(date)} {hm(start)}–{hm(start + dur)} · 앞뒤 이동 시간({st.buffer_min}분)까지 손님 화면에서 막혀요.</p>
      {clash.length > 0 && (
        <p className="err" style={{ margin: 0 }}>이 시간에 이미 일정이 있어요: {clash.map((b) => `${hm(b.start_min)} ${b.name}`).join(", ")}. 그래도 저장할 수 있어요.</p>
      )}
      <div><button className="btn" disabled={busy} onClick={save}>{busy ? "저장 중…" : kind === "block" ? "시간 막기" : "일정 등록"}</button></div>
    </div>
  );
}
