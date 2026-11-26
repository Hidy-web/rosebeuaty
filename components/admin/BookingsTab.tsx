"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { STATUS_LABEL, type Booking } from "@/lib/types";
import { DOW, addDays, dLabel, hm, parseD, seoulNow, won } from "@/lib/time";
import type { TabProps } from "./AdminApp";
import AddSchedule from "./AddSchedule";

type Filter = Booking["status"] | "all";

export default function BookingsTab({ data, reload, toast, onPending }: TabProps & { onPending: (n: number) => void }) {
  const st = data.settings;
  const today = seoulNow().date;
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: r, error } = await sb()
      .from("bookings")
      .select("*")
      .gte("date", addDays(today, -60))
      .order("date")
      .order("start_min");
    if (error) return toast("예약을 불러오지 못했어요");
    setRows(r as Booking[]);
  }, [today, toast]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (rows) onPending(rows.filter((b) => b.status === "pending").length);
  }, [rows, onPending]);

  async function setStatus(b: Booking, status: Booking["status"], msg: string) {
    const { error } = await sb().from("bookings").update({ status }).eq("id", b.id);
    if (error) return toast("바꾸지 못했어요. 다시 시도해 주세요");
    toast(msg);
    load();
  }

  async function removeBooking(b: Booking) {
    const { data: gone, error } = await sb().from("bookings").delete().eq("id", b.id).select("id");
    setDelId(null);
    if (error || !gone?.length) return toast("삭제하지 못했어요. 취소된 예약만 완전히 지울 수 있어요");
    toast("예약을 완전히 삭제했어요");
    load();
  }

  async function removeBlock(b: Booking) {
    const { error } = await sb().from("bookings").delete().eq("id", b.id);
    if (error) return toast("지우지 못했어요. 다시 시도해 주세요");
    toast("개인 일정을 지웠어요. 그 시간이 다시 열려요");
    load();
  }

  async function toggleClosed() {
    const closed = st.closed_dates.includes(day);
    const next = closed ? st.closed_dates.filter((d) => d !== day) : [...st.closed_dates, day];
    const { error } = await sb().from("settings").update({ closed_dates: next }).eq("id", 1);
    if (error) return toast("저장하지 못했어요");
    toast(closed ? "휴무를 해제했어요" : "휴무로 지정했어요");
    reload();
  }

  if (!rows) return <div className="center-msg"><div className="spinner" /></div>;

  const isBlock = (b: Booking) => b.kind === "block";
  const active = rows.filter((b) => b.status !== "canceled");
  const customers = active.filter((b) => !isBlock(b));
  const pend = rows.filter((b) => b.status === "pending");
  const wk = addDays(today, 7);
  const upcoming = rows.filter((b) => b.status === "confirmed" && b.date >= today && !isBlock(b));
  const remain = upcoming.reduce((a, b) => a + b.total - b.deposit, 0);

  let list = rows.filter((b) => (filter === "all" || b.status === filter) && !(isBlock(b) && filter !== "all" && filter !== "confirmed"));
  if (filter === "pending" || filter === "confirmed") list = list.filter((b) => b.date >= addDays(today, -1));
  if (filter === "done" || filter === "canceled" || filter === "all") list = [...list].reverse();

  const F: [Filter, string][] = [["pending", "입금 대기"], ["confirmed", "확정"], ["done", "완료"], ["canceled", "취소"], ["all", "전체"]];
  const itemsText = (b: Booking) => b.items.map((i) => i.name + (i.n > 1 ? ` ×${i.n}` : "")).join(", ");

  const nRows = (st.close_min - st.open_min) / 30;
  const bufRows = Math.round(st.buffer_min / 30);
  const dayB = active.filter((b) => b.date === day);
  const closed = st.closed_dates.includes(day);

  return (
    <>
      <div className="tiles">
        <div className="tile"><span className="eyebrow">오늘 출장</span><span className="v num">{customers.filter((b) => b.date === today).length}건</span></div>
        <div className={`tile ${pend.length ? "alert" : ""}`}><span className="eyebrow">입금 확인 필요</span><span className="v num">{pend.length}건</span></div>
        <div className="tile"><span className="eyebrow">7일 내 확정</span><span className="v num">{upcoming.filter((b) => b.date <= wk).length}건</span></div>
        <div className="tile"><span className="eyebrow">받을 잔금 (확정 예약)</span><span className="v num">{won(remain)}</span></div>
      </div>
      <div className="admin-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>예약 관리</h2>
            <button className="btn sm" onClick={() => setAdding(!adding)}>+ 일정 직접 추가</button>
            <div className="filters">
              {F.map(([k, l]) => (
                <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l} <span className="num">{k === "all" ? rows.length : rows.filter((b) => b.status === k).length}</span>
                </button>
              ))}
            </div>
          </div>
          {adding && (
            <AddSchedule data={data} day={day >= today ? day : today} rows={rows} toast={toast}
              onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
          )}
          {filter === "canceled" && (
            <p className="note">완전 삭제하면 기록이 사라지고 되돌릴 수 없어요. 예약금을 받았던 예약은 나중을 위해 취소 상태로 남겨 두길 권해요.</p>
          )}
          {filter === "pending" && pend.length > 0 && (
            <p className="note">통장에 입금자명과 예약금이 들어왔는지 확인한 뒤 확정을 눌러 주세요.</p>
          )}
          <div>
            {list.length === 0 && <div className="empty">해당하는 예약이 없어요.</div>}
            {list.map((b) => {
              const d = parseD(b.date);
              return (
                <div key={b.id} className={`bk ${b.status === "pending" ? "pending" : ""}`}>
                  <div className="when num">
                    {d.getUTCMonth() + 1}/{d.getUTCDate()}
                    <small>{DOW[d.getUTCDay()]} {hm(b.start_min)}</small>
                  </div>
                  <div className="who">
                    <div className="n">
                      {b.name}{" "}
                      {isBlock(b) ? <span className="pill st-block">개인 일정</span> : <span className={`pill st-${b.status}`}>{STATUS_LABEL[b.status]}</span>}
                      {b.kind === "manual" && <span className="pill st-manual">직접 등록</span>}
                    </div>
                    {!isBlock(b) && <div className="s">{itemsText(b)}</div>}
                    {!isBlock(b) && <div className="where">{b.region_name.split(" (")[0]} · {b.address}{b.event_note && ` · 행사 ${b.event_note}`}</div>}
                    <div className="where num">
                      {b.phone && <a href={`tel:${b.phone}`} style={{ color: "inherit" }}>{b.phone}</a>}
                      {b.memo && !isBlock(b) && ` · “${b.memo}”`}
                    </div>
                    {!isBlock(b) && <div className="money num">
                      총 {won(b.total)}{b.travel_fee == null ? " + 출장비" : ""} · 예약금 {won(b.deposit)} · 현장 결제 {won(b.total - b.deposit)}
                      {(b.early_fee ?? 0) > 0 && <> · 이른 시간 +{won(b.early_fee!)}</>}
                      {(b.discount ?? 0) > 0 && <> · 할인 −{won(b.discount!)}</>}
                    </div>}
                  </div>
                  <div className="muted num" style={{ fontSize: ".8rem", textAlign: "right" }}>{b.code}</div>
                  <div className="acts">
                    {isBlock(b) && (
                      <button className="btn sm danger" onClick={() => removeBlock(b)}>지우기 (시간 다시 열기)</button>
                    )}
                    {!isBlock(b) && b.status === "pending" && (
                      <>
                        <button className="btn sm sage" onClick={() => setStatus(b, "confirmed", `${b.name}님 예약을 확정했어요`)}>입금 확인 · 확정</button>
                        <button className="btn sm danger" onClick={() => setStatus(b, "canceled", "예약을 취소했어요")}>취소</button>
                      </>
                    )}
                    {!isBlock(b) && b.status === "confirmed" && (
                      <>
                        <button className="btn sm ghost" onClick={() => setStatus(b, "done", "시술 완료로 표시했어요")}>시술 완료</button>
                        <button className="btn sm danger" onClick={() => setStatus(b, "canceled", "예약을 취소했어요")}>취소</button>
                        {b.date <= today && <ReviewLinkButton b={b} toast={toast} />}
                      </>
                    )}
                    {b.status === "done" && <ReviewLinkButton b={b} toast={toast} />}
                    {b.status === "canceled" && !isBlock(b) && (
                      <>
                        <button className="btn sm ghost" onClick={() => setStatus(b, "pending", "입금 대기로 되돌렸어요")}>입금 대기로 되돌리기</button>
                        {delId === b.id ? (
                          <>
                            <button className="btn sm danger solid" onClick={() => removeBooking(b)}>정말 삭제 (되돌릴 수 없어요)</button>
                            <button className="btn sm ghost" onClick={() => setDelId(null)}>그만두기</button>
                          </>
                        ) : (
                          <button className="btn sm danger" onClick={() => setDelId(b.id)}>완전 삭제</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>출장 일정</h2>
            <div className="daynav">
              <button className="btn sm ghost" onClick={() => setDay(addDays(day, -1))} aria-label="이전 날">‹</button>
              <b className="num">{dLabel(day)}</b>
              <button className="btn sm ghost" onClick={() => setDay(addDays(day, 1))} aria-label="다음 날">›</button>
              {day !== today && <button className="btn sm ghost" onClick={() => setDay(today)}>오늘</button>}
            </div>
          </div>
          {closed && <div className="closed-note">휴무로 지정된 날이에요. 손님 화면에서 예약할 수 없어요.</div>}
          <div className="timeline">
            <div className="tl-hours">
              {Array.from({ length: nRows }, (_, i) => {
                const t = st.open_min + i * 30;
                return <div key={t} className="num">{t % 60 === 0 ? hm(t) : ""}</div>;
              })}
            </div>
            <div className="tl-body" style={{ gridTemplateRows: `repeat(${nRows},28px)` }}>
              {dayB.map((b) => {
                const r = Math.max(1, (b.start_min - st.open_min) / 30 + 1);
                const span = Math.max(1, b.duration_min / 30);
                const bs = Math.max(1, r - bufRows);
                return [
                  r - bs > 0 && (
                    <div key={b.id + "-buf"} className="tl-buf" style={{ gridRow: `${bs} / span ${r - bs}` }}>이동</div>
                  ),
                  <div key={b.id} className={`tl-ev ${isBlock(b) ? "block" : b.status}`} style={{ gridRow: `${r} / span ${span}`, gridColumn: 1 }}>
                    <b className="num">{hm(b.start_min)}–{hm(b.start_min + b.duration_min)}</b> {b.name}
                    {!isBlock(b) && <>{span > 1 ? <br /> : " · "}{itemsText(b)}</>}
                    {span > 2 && (<><br />{b.address}</>)}
                  </div>,
                ];
              })}
            </div>
          </div>
          <p className="note">점선 칸은 예약 사이에 비워 두는 이동 시간({st.buffer_min}분)이에요.</p>
          <div><button className="btn sm ghost" onClick={toggleClosed}>{closed ? "휴무 해제" : "이 날 휴무로 지정"}</button></div>
        </section>
      </div>
    </>
  );
}

/** 손님에게 보낼 리뷰 링크를 복사해요. 링크로 들어오면 별점과 후기만 쓰면 돼요. */
function ReviewLinkButton({ b, toast }: { b: Booking; toast: (m: string) => void }) {
  if (!b.review_token) return null;
  const url = `${window.location.origin}/?review=${b.review_token}`;
  async function copy() {
    const text = `${b.name}님, 오늘 이용해 주셔서 감사해요. 짧은 후기를 남겨 주시면 큰 힘이 돼요.\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("리뷰 요청 문구와 링크를 복사했어요. 문자나 카톡에 붙여넣어 보내 주세요");
    } catch {
      window.prompt("아래 링크를 복사해 주세요", url);
    }
  }
  return <button className="btn sm ghost" onClick={copy}>리뷰 링크 복사</button>;
}
