"use client";
import { useEffect, useMemo, useState } from "react";
import { bookingErrorText, sb } from "@/lib/supabase";
import { DOW, addDays, dLabel, dow, hm, parseD, seoulNow, won } from "@/lib/time";
import type { ShopData } from "./useShopData";

type Busy = { date: string; start_min: number; end_min: number };
type Made = {
  code: string;
  items: { name: string; price: number; n: number }[];
  subtotal: number;
  travel_fee: number | null;
  total: number;
  deposit: number;
  region_name: string;
};

const WEEKS = 5;

export default function BookingFlow({ data, onExit, toast }: { data: ShopData; onExit: () => void; toast: (m: string) => void }) {
  const { settings: st, cats, services } = data;
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", region: st.regions[0]?.id ?? "", address: "", event: "", memo: "" });
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<{ res: Made; date: string; start: number; deadline: Date } | null>(null);

  const now = seoulNow();
  const firstDay = addDays(now.date, -dow(now.date));
  const lastDay = addDays(firstDay, WEEKS * 7 - 1);

  const live = (cid: string) => services.filter((s) => s.category_id === cid && !s.deleted);
  const items = Object.entries(cart)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ svc: services.find((s) => s.id === id)!, n }))
    .filter((x) => x.svc && !x.svc.deleted);
  const dur = items.reduce((a, i) => a + i.svc.duration_min * i.n, 0);
  const subtotal = items.reduce((a, i) => a + i.svc.price * i.n, 0);
  const people = items.reduce((a, i) => a + i.n, 0);
  const region = st.regions.find((r) => r.id === form.region) ?? st.regions[0];
  const itemsText = items.map((i) => i.svc.name + (i.n > 1 ? ` ×${i.n}` : "")).join(", ");

  async function loadBusy() {
    setBusy(null);
    const { data: rows, error } = await sb().rpc("busy_slots", { d_from: now.date, d_to: lastDay });
    if (error) {
      toast("예약 가능한 시간을 불러오지 못했어요. 잠시 후 다시 시도해 주세요");
      setBusy([]);
      return;
    }
    setBusy((rows ?? []) as Busy[]);
  }
  useEffect(() => {
    if (step === 2) loadBusy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const slotsFor = useMemo(
    () => (ds: string) => {
      const out: { t: number; ok: boolean }[] = [];
      const b = (busy ?? []).filter((x) => x.date === ds);
      for (let t = st.open_min; t + 30 <= st.close_min; t += 30) {
        const ok =
          t + dur <= st.close_min &&
          !b.some((x) => t < x.end_min + st.buffer_min && t + dur + st.buffer_min > x.start_min) &&
          !(ds === now.date && t <= now.minutes + 120);
        out.push({ t, ok });
      }
      return out;
    },
    [busy, dur, st, now.date, now.minutes]
  );

  function setN(id: string, d: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(10, (c[id] ?? 0) + d)) }));
    setDate(null);
    setStart(null);
  }

  async function submit() {
    if (!form.address.trim()) return toast("방문 주소를 입력해 주세요");
    if (!form.name.trim()) return toast("예약자 이름을 입력해 주세요");
    if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) return toast("연락처를 010-0000-0000 형식으로 입력해 주세요");
    if (!date || start === null) return;
    setSaving(true);
    const { data: res, error } = await sb().rpc("create_booking", {
      p_name: form.name,
      p_phone: form.phone,
      p_items: items.map((i) => ({ id: i.svc.id, n: i.n })),
      p_region: form.region,
      p_address: form.address,
      p_event_note: form.event,
      p_date: date,
      p_start: start,
      p_memo: form.memo,
    });
    setSaving(false);
    if (error) {
      const msg = bookingErrorText(error.message);
      toast(msg);
      if (/slot_taken|invalid_time|closed_day|invalid_date/.test(error.message)) {
        setStart(null);
        setStep(2);
      }
      return;
    }
    setMade({ res: res as Made, date, start, deadline: new Date(Date.now() + st.deadline_hours * 3600e3) });
    setStep(4);
    window.scrollTo(0, 0);
  }

  async function copyAccount() {
    const txt = `${st.bank} ${st.account}`;
    try {
      await navigator.clipboard.writeText(txt);
      toast("계좌번호를 복사했어요");
    } catch {
      const el = document.getElementById("acct");
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }
      toast("계좌번호를 선택했어요. 길게 눌러 복사하세요");
    }
  }

  const go = (n: number) => {
    setStep(n);
    window.scrollTo(0, 0);
  };
  const labels = ["메뉴·인원", "날짜·시간", "방문 정보", "입금 안내"];

  const Summary = ({ withTime }: { withTime: boolean }) => (
    <div className="card summary">
      <div><span className="muted">메뉴</span><b style={{ textAlign: "right" }}>{itemsText}</b></div>
      {withTime && date && start !== null && (
        <div><span className="muted">방문 시간</span><b className="num">{dLabel(date)} {hm(start)}</b></div>
      )}
      <div><span className="muted">시술 금액</span><span className="num">{won(subtotal)}</span></div>
      <div><span className="muted">출장비 ({region?.name.split(" (")[0]})</span><span className="num">{region?.fee == null ? "상담 후 안내" : region.fee === 0 ? "무료" : won(region.fee)}</span></div>
      <div><span className="muted">총 금액</span><b className="num">{won(subtotal + (region?.fee ?? 0))}{region?.fee == null ? " + 출장비" : ""}</b></div>
      <div><span className="muted">예약금 (먼저 입금)</span><b className="num">{won(st.deposit)}</b></div>
    </div>
  );

  return (
    <div className="book">
      {step < 4 && (
        <div>
          <button className="btn ghost sm" onClick={() => (step === 1 ? onExit() : go(step - 1))}>
            ← {step === 1 ? "처음으로" : "이전"}
          </button>
        </div>
      )}
      <div className="steps">
        {labels.map((l, i) => (
          <span key={l} className={step === i + 1 ? "on" : ""}>
            {i + 1}. {l}
          </span>
        ))}
      </div>

      {step === 1 && (
        <>
          <h2>어떤 메뉴를 몇 분이 받으시나요?</h2>
          <p className="muted">여러 메뉴를 함께 고를 수 있어요. 예: 엄마 헤어+메이크업 1명, 아이 헤어 1명</p>
          {cats.filter((c) => live(c.id).length).map((c) => (
            <div className="svc-list" key={c.id}>
              <h3>{c.name}</h3>
              {live(c.id).map((s) => {
                const n = cart[s.id] ?? 0;
                return (
                  <div className="svc" key={s.id} aria-pressed={n > 0}>
                    <span className="info">
                      <b>{s.name}</b>
                      <br />
                      <small className="muted">
                        {won(s.price)}
                        {s.description && ` · ${s.description}`}
                      </small>
                    </span>
                    <span className="counter">
                      <button onClick={() => setN(s.id, -1)} disabled={!n} aria-label={`${s.name} 한 명 빼기`}>−</button>
                      <span className="n num">{n}</span>
                      <button onClick={() => setN(s.id, 1)} disabled={n >= 10} aria-label={`${s.name} 한 명 더하기`}>+</button>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {items.length ? (
            <div className="cartbar">
              <span className="num">{people}명 · {won(subtotal)}</span>
              <button className="btn" onClick={() => go(2)}>다음</button>
            </div>
          ) : (
            <div><button className="btn" disabled>메뉴를 골라 주세요</button></div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h2>행사 날짜와 방문 시간을 골라 주세요</h2>
          <p className="muted">{itemsText}</p>
          {busy === null ? (
            <div className="center-msg" style={{ margin: "24px auto" }}><div className="spinner" /></div>
          ) : (
            <>
              <div className="days">
                {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
                {Array.from({ length: WEEKS * 7 }, (_, i) => {
                  const ds = addDays(firstDay, i);
                  const past = ds < now.date;
                  const closed = st.closed_dates.includes(ds);
                  const full = !past && !closed && !slotsFor(ds).some((x) => x.ok);
                  const d = parseD(ds);
                  return (
                    <button key={ds} className="day num" aria-pressed={date === ds} disabled={past || closed || full}
                      onClick={() => { setDate(ds); setStart(null); }}>
                      <b>{d.getUTCDate()}</b>
                      <small>{closed && !past ? "휴무" : full ? "마감" : `${d.getUTCMonth() + 1}월`}</small>
                    </button>
                  );
                })}
              </div>
              {date && (
                <>
                  <h3>{dLabel(date)} 방문 시작 시간</h3>
                  <div className="slots">
                    {slotsFor(date).map((x) => (
                      <button key={x.t} className="slot num" aria-pressed={start === x.t} disabled={!x.ok} onClick={() => setStart(x.t)}>
                        {hm(x.t)}
                      </button>
                    ))}
                  </div>
                  {start !== null ? (
                    <p className="num"><b>{hm(start)}</b>에 방문해요.</p>
                  ) : (
                    <p className="note">앞뒤 예약과 이동 시간이 겹치는 시간은 고를 수 없어요.</p>
                  )}
                </>
              )}
            </>
          )}
          <div><button className="btn" disabled={!date || start === null} onClick={() => go(3)}>다음</button></div>
        </>
      )}

      {step === 3 && (
        <>
          <h2>어디로 찾아갈까요?</h2>
          <div className="field">
            <label htmlFor="g-region">지역</label>
            <select id="g-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
              {st.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · 출장비 {r.fee == null ? "상담 후 안내" : r.fee === 0 ? "무료" : won(r.fee)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="g-addr">방문 주소</label>
            <input id="g-addr" value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="예: 서울 송파구 ○○아파트 101동 1203호 / ○○홀 신부대기실" autoComplete="street-address" />
          </div>
          <div className="field">
            <label htmlFor="g-event">행사 시작 시간과 종류</label>
            <input id="g-event" value={form.event} maxLength={100} onChange={(e) => setForm({ ...form, event: e.target.value })} placeholder="예: 12:00 돌잔치" />
          </div>
          <div className="field">
            <label htmlFor="g-name">예약자 이름</label>
            <input id="g-name" value={form.name} maxLength={20} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="g-phone">연락처</label>
            <input id="g-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="g-memo">요청사항 (선택)</label>
            <textarea id="g-memo" value={form.memo} maxLength={500} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="한복 착용 여부, 원하는 스타일, 주차 안내 등" />
          </div>
          <Summary withTime />
          <p className="note">
            예약 신청 후 {st.deadline_hours}시간 안에 예약금을 입금해 주셔야 예약이 확정돼요. 시간 안에 입금이 없으면 취소될 수 있어요.
          </p>
          <div><button className="btn" disabled={saving} onClick={submit}>{saving ? "신청 중…" : "예약 신청하기"}</button></div>
        </>
      )}

      {step === 4 && made && (
        <>
          <div className="done-mark">✓</div>
          <h2>예약 신청이 접수됐어요</h2>
          <p className="muted">아직 확정 전이에요. 아래 계좌로 예약금을 보내 주시면 확인 후 확정 연락을 드려요.</p>
          <div className="bank">
            <div className="eyebrow">예약금 입금 계좌</div>
            <div className="acct num" id="acct">{st.bank} {st.account}</div>
            <div>예금주 {st.holder}</div>
            <div className="summary">
              <div><span>입금할 금액</span><b className="num">{won(made.res.deposit)}</b></div>
              <div>
                <span>입금 기한</span>
                <b className="num">
                  {made.deadline.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}까지
                </b>
              </div>
              <div><span>입금자명</span><b>{form.name.trim()}</b></div>
            </div>
            <div className="row-actions"><button className="btn sm" onClick={copyAccount}>계좌번호 복사</button></div>
          </div>
          <div className="card summary">
            <div><span className="muted">예약번호</span><b className="num">{made.res.code}</b></div>
            <div><span className="muted">상태</span><span className="pill st-pending">입금 대기</span></div>
            <div><span className="muted">방문 시간</span><span className="num">{dLabel(made.date)} {hm(made.start)}</span></div>
            <div><span className="muted">방문 주소</span><span style={{ textAlign: "right" }}>{form.address.trim()}</span></div>
            <div><span className="muted">총 금액</span><b className="num">{won(made.res.total)}{made.res.travel_fee == null ? " + 출장비" : ""}</b></div>
          </div>
          <p className="note">
            예약번호를 꼭 저장해 두세요. &ldquo;예약 확인&rdquo; 탭에서 예약번호와 연락처로 상태를 볼 수 있어요. 당일에는 총 금액에서 예약금을 뺀{" "}
            {won(made.res.total - made.res.deposit)}을 결제하시면 돼요.
          </p>
          <div><button className="btn ghost" onClick={onExit}>처음으로</button></div>
        </>
      )}
    </div>
  );
}
