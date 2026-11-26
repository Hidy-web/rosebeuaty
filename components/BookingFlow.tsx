"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { bookingErrorText, sb } from "@/lib/supabase";
import { DOW, addDays, dLabel, dow, hm, seoulNow, won } from "@/lib/time";
import type { ShopData } from "./useShopData";
import { ConsentSummary } from "./PrivacyPolicy";
import ExtraNotice from "./ExtraNotice";

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

const MAX_DAYS = 180; // 예약 받는 기간 (데이터베이스 함수와 같아요)
const MONTHS = 6;

type PostcodeData = { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string; apartment: string; sido: string };
declare global {
  interface Window {
    daum?: { Postcode: new (o: { oncomplete: (d: PostcodeData) => void; width: string; height: string }) => { embed: (el: HTMLElement) => void } };
  }
}
const POSTCODE_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  return new Promise((ok, fail) => {
    const el = document.createElement("script");
    el.src = POSTCODE_SRC;
    el.async = true;
    el.onload = () => (window.daum?.Postcode ? ok() : fail());
    el.onerror = () => fail();
    document.head.appendChild(el);
  });
}

function monthKey(ds: string) {
  return ds.slice(0, 7);
}
function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default function BookingFlow({ data, onExit, toast }: { data: ShopData; onExit: () => void; toast: (m: string) => void }) {
  const { settings: st, cats, services } = data;
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", region: st.regions[0]?.id ?? "", zip: "", base: "", detail: "", event: "", memo: "" });
  const [finder, setFinder] = useState<"closed" | "loading" | "open" | "failed">("closed");
  const finderEl = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [agree, setAgree] = useState(false);
  const [made, setMade] = useState<{ res: Made; date: string; start: number; deadline: Date } | null>(null);

  const now = seoulNow();
  const lastDay = addDays(now.date, MAX_DAYS);
  const months = Array.from({ length: MONTHS + 1 }, (_, i) => addMonths(monthKey(now.date), i)).filter((k) => k <= monthKey(lastDay));
  const [month, setMonth] = useState(monthKey(now.date));
  const confirmDays = st.confirm_days ?? 3;
  const address = form.base ? `${form.zip ? `[${form.zip}] ` : ""}${form.base}${form.detail.trim() ? `, ${form.detail.trim()}` : ""}` : form.detail.trim();

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

  async function openFinder() {
    setFinder("loading");
    try {
      await loadPostcode();
      setFinder("open");
    } catch {
      setFinder("failed");
    }
  }
  useEffect(() => {
    if (finder !== "open" || !finderEl.current || !window.daum) return;
    finderEl.current.innerHTML = "";
    new window.daum.Postcode({
      width: "100%",
      height: "100%",
      oncomplete: (d) => {
        const extra = d.buildingName ? ` (${d.buildingName})` : "";
        const seoul = d.sido.startsWith("서울");
        const match = st.regions.find((r) => (seoul ? r.name.includes("서울") : !r.name.includes("서울")));
        setForm((f) => ({ ...f, zip: d.zonecode, base: (d.roadAddress || d.jibunAddress) + extra, region: match?.id ?? f.region }));
        setFinder("closed");
        setTimeout(() => document.getElementById("g-detail")?.focus(), 50);
      },
    }).embed(finderEl.current);
  }, [finder, st.regions]);

  async function submit() {
    if (finder !== "failed" && !form.base) return toast("주소 검색으로 방문 주소를 찾아 주세요");
    if (!address) return toast("방문 주소를 입력해 주세요");
    if (!form.name.trim()) return toast("예약자 이름을 입력해 주세요");
    if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) return toast("연락처를 010-0000-0000 형식으로 입력해 주세요");
    if (!agree) return toast("개인정보 수집·이용에 동의해 주세요");
    if (!date || start === null) return;
    setSaving(true);
    const { data: res, error } = await sb().rpc("create_booking", {
      p_name: form.name,
      p_phone: form.phone,
      p_items: items.map((i) => ({ id: i.svc.id, n: i.n })),
      p_region: form.region,
      p_address: address,
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
          <p className="muted">여러 메뉴를 함께 고를 수 있어요. 예: 혼주 메이크업 1명, 혼주(남) 1명, 하객 헤어 1명</p>
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
              <div className="months" role="tablist" aria-label="월 선택">
                {months.map((k) => {
                  const [y, m] = k.split("-").map(Number);
                  const showYear = y !== Number(now.date.slice(0, 4));
                  return (
                    <button key={k} role="tab" className="month" aria-selected={month === k} onClick={() => { setMonth(k); setDate(null); setStart(null); }}>
                      {showYear && <small>{y}년</small>}
                      {m}월
                    </button>
                  );
                })}
              </div>
              <div className="days">
                {DOW.map((d, i) => <div className={"dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")} key={d}>{d}</div>)}
                {Array.from({ length: dow(month + "-01") }, (_, i) => <span key={"b" + i} />)}
                {Array.from({ length: daysInMonth(month) }, (_, i) => {
                  const ds = `${month}-${String(i + 1).padStart(2, "0")}`;
                  const past = ds < now.date || ds > lastDay;
                  const closed = st.closed_dates.includes(ds);
                  const full = !past && !closed && !slotsFor(ds).some((x) => x.ok);
                  const wd = dow(ds);
                  return (
                    <button key={ds} className={"day num" + (wd === 0 ? " sun" : wd === 6 ? " sat" : "") + (ds === now.date ? " today" : "")}
                      aria-pressed={date === ds} disabled={past || closed || full} aria-label={dLabel(ds) + (closed && !past ? " 휴무" : full ? " 마감" : "")}
                      onClick={() => { setDate(ds); setStart(null); }}>
                      <b>{i + 1}</b>
                      <small>{past ? "\u00a0" : closed ? "휴무" : full ? "마감" : ds === now.date ? "오늘" : "\u00a0"}</small>
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
                  {start !== null && <p className="num"><b>{hm(start)}</b>에 방문해요.</p>}
                  <p className="callout">
                    같은 날 앞뒤 예약 장소와의 거리에 따라 고르신 시간에 방문이 어려울 수 있어요. 그런 경우 예약금 입금 전에 먼저 연락드려 시간을 조정할게요.
                  </p>
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
            <label htmlFor="g-detail">방문 주소</label>
            {finder !== "failed" && (
              <div className="addr-row">
                <input value={form.base ? `${form.zip ? `[${form.zip}] ` : ""}${form.base}` : ""} readOnly placeholder="주소 검색을 눌러 찾아 주세요"
                  aria-label="기본 주소" onClick={openFinder} />
                <button type="button" className="btn sm" onClick={openFinder}>{form.base ? "다시 검색" : "주소 검색"}</button>
              </div>
            )}
            {(finder === "loading" || finder === "open") && (
              <div className="finder">
                <div className="finder-bar">
                  <span className="muted">도로명, 건물 이름, 아파트 이름으로 찾아 주세요</span>
                  <button type="button" className="btn ghost sm" onClick={() => setFinder("closed")}>닫기</button>
                </div>
                <div ref={finderEl} className="finder-box">{finder === "loading" && <div className="spinner" style={{ margin: "40px auto" }} />}</div>
              </div>
            )}
            {finder === "failed" && <p className="note">주소 검색을 불러오지 못했어요. 아래 칸에 주소 전체를 적어 주세요.</p>}
            <input id="g-detail" value={form.detail} maxLength={120} onChange={(e) => setForm({ ...form, detail: e.target.value })}
              placeholder={finder === "failed" ? "예: 서울 송파구 올림픽로 300, 101동 1203호" : "상세 주소: 101동 1203호 / ○○홀 신부대기실"} autoComplete="address-line2" />
          </div>
          <div className="field">
            <label htmlFor="g-event">행사 시작 시간과 종류</label>
            <input id="g-event" value={form.event} maxLength={100} onChange={(e) => setForm({ ...form, event: e.target.value })} placeholder="예: 11:00 결혼식 (혼주), 14:00 상견례" />
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
          <div className="consent">
            <label className="consent-check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span><b>[필수]</b> 예약을 위한 개인정보 수집·이용에 동의해요</span>
            </label>
            <ConsentSummary months={st.retention_months ?? 12} />
            <p className="note">
              동의하지 않으실 수 있지만, 그 경우 온라인 예약은 할 수 없어요. 자세한 내용은{" "}
              <a href="/privacy" target="_blank" rel="noopener">개인정보 처리방침</a>에서 볼 수 있어요.
            </p>
          </div>
          <Summary withTime />
          <ExtraNotice text={st.extra_notice} />
          <p className="callout">
            예약 신청 후 {st.deadline_hours}시간 안에 예약금을 입금해 주셔야 예약이 확정돼요. 시간 안에 입금이 없으면 취소될 수 있어요.
            {confirmDays > 0 && <> 행사일 {confirmDays}일 전까지는 꼭 입금을 마쳐 예약을 확정해 주세요.</>}
          </p>
          <div><button className="btn" disabled={saving} onClick={submit}>{saving ? "신청 중…" : "예약 신청하기"}</button></div>
        </>
      )}

      {step === 4 && made && (
        <>
          <div className="done-mark">✓</div>
          <h2>예약 신청이 접수됐어요</h2>
          <p className="muted">
            아직 확정 전이에요. 아래 계좌로 예약금을 보내 주시면 확인 후 확정 연락을 드려요.
            {confirmDays > 0 && <> 행사일 {confirmDays}일 전까지 입금이 확인되어야 예약이 확정돼요.</>}
          </p>
          <div className="bank">
            <div className="eyebrow">예약금 입금 계좌</div>
            {st.account.trim() ? (
              <>
                <div className="acct num" id="acct">{st.bank} {st.account}</div>
                <div>예금주 {st.holder}</div>
              </>
            ) : (
              <div>입금 계좌는 확인 연락을 드릴 때 안내해 드려요.</div>
            )}
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
            {st.account.trim() && <div className="row-actions"><button className="btn sm" onClick={copyAccount}>계좌번호 복사</button></div>}
          </div>
          <div className="card summary">
            <div><span className="muted">예약번호</span><b className="num">{made.res.code}</b></div>
            <div><span className="muted">상태</span><span className="pill st-pending">입금 대기</span></div>
            <div><span className="muted">방문 시간</span><span className="num">{dLabel(made.date)} {hm(made.start)}</span></div>
            <div><span className="muted">방문 주소</span><span style={{ textAlign: "right" }}>{address}</span></div>
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
