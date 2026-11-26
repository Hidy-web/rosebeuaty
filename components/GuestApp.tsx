"use client";
import { useMemo, useState } from "react";
import { imageUrl, sb } from "@/lib/supabase";
import { STATUS_LABEL, type Booking } from "@/lib/types";
import { dLabel, hm, won } from "@/lib/time";
import { Loading, Toast, useShopData, useToast } from "./useShopData";
import BookingFlow from "./BookingFlow";

const GRAD = [
  ["#C9849E", "#6B2D4A"], ["#B79E86", "#5A4636"], ["#8FA9A0", "#3F5A51"], ["#D7A9A0", "#7B4A43"],
  ["#A796B8", "#4D3F61"], ["#C4B08E", "#6A5634"], ["#9EB0C4", "#3E4F66"], ["#D6A3B6", "#7A3E58"],
];

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n}점`}>
      {"★".repeat(n)}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function GuestApp() {
  const { data, error, reload } = useShopData();
  const toast = useToast();
  const [tab, setTab] = useState<"price" | "portfolio" | "reviews" | "lookup">("price");
  const [booking, setBooking] = useState(false);
  const [pf, setPf] = useState("전체");

  const visibleReviews = useMemo(() => (data?.reviews ?? []).filter((r) => !r.hidden), [data]);
  const avg = visibleReviews.length ? visibleReviews.reduce((a, r) => a + r.rating, 0) / visibleReviews.length : 0;

  if (!data) return <Loading error={error} onRetry={reload} />;
  const { settings: st, cats, services, pcats, portfolio } = data;
  const live = (cid: string) => services.filter((s) => s.category_id === cid && !s.deleted);

  if (booking)
    return (
      <div className="guest">
        <BookingFlow
          data={data}
          onExit={() => {
            setBooking(false);
            window.scrollTo(0, 0);
          }}
          toast={toast.show}
        />
        <Toast msg={toast.msg} />
      </div>
    );

  const pcatName = (id: string | null) => pcats.find((c) => c.id === id)?.name ?? "";
  const pcatsWithItems = pcats.filter((c) => portfolio.some((p) => p.category_id === c.id));
  const shownPf = portfolio.filter((p) => pf === "전체" || pcatName(p.category_id) === pf);

  return (
    <div className="guest">
      <section className="hero">
        <p className="eyebrow">돌잔치 · 하객 · 촬영 출장 헤어메이크업</p>
        <h1>{st.tagline}</h1>
        <div className="meta">
          <span>{st.regions.filter((r) => r.fee !== null).map((r) => r.name).join("·")} 출장</span>
          {visibleReviews.length > 0 && (
            <span>
              ★ {avg.toFixed(1)} (리뷰 {visibleReviews.length})
            </span>
          )}
        </div>
        <div>
          <button className="btn" onClick={() => { setBooking(true); window.scrollTo(0, 0); }}>
            예약하기
          </button>
        </div>
      </section>

      <div>
        <div className="tabs" role="tablist">
          {([["price", "메뉴·가격"], ["portfolio", "포트폴리오"], ["reviews", "리뷰"], ["lookup", "예약 확인"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ paddingTop: 20 }}>
          {tab === "price" && (
            <div className="section">
              {cats.filter((c) => live(c.id).length).map((c) => (
                <div className="price-group" key={c.id}>
                  <h3>{c.name}</h3>
                  {live(c.id).map((s) => (
                    <div className="price-row" key={s.id}>
                      <div>
                        <div className="name">{s.name}</div>
                        {s.description && <div className="dur">{s.description}</div>}
                      </div>
                      <div className="won num">{won(s.price)}</div>
                    </div>
                  ))}
                </div>
              ))}
              <p className="note">
                가격은 1인 기준이에요. 모든 예약은 예약금 {won(st.deposit)} 입금 후 확정되며, 예약금은 당일 결제 금액에서 빠져요.
              </p>
            </div>
          )}

          {tab === "portfolio" && (
            <div className="section">
              {pcatsWithItems.length > 1 && (
                <div className="filters">
                  {["전체", ...pcatsWithItems.map((c) => c.name)].map((f) => (
                    <button key={f} className="chip" aria-pressed={pf === f} onClick={() => setPf(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
              {shownPf.length ? (
                <div className="gallery">
                  {shownPf.map((p, i) => {
                    const g = GRAD[i % GRAD.length];
                    return (
                      <div key={p.id} className="shot has-img" style={{ background: `linear-gradient(155deg,${g[0]},${g[1]})` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(p.image_path)} alt={p.title} loading="lazy" />
                        <span className="tag">{pcatName(p.category_id)}</span>
                        <span className="cap">{p.title}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">아직 올린 사진이 없어요.</div>
              )}
            </div>
          )}

          {tab === "reviews" && <ReviewsTab reviews={visibleReviews} avg={avg} onPosted={reload} toast={toast.show} />}
          {tab === "lookup" && <LookupTab />}
        </div>
      </div>
      <p className="footer">
        {st.shop_name} · <a href="/privacy"><b>개인정보 처리방침</b></a> · <a href="/admin">관리자</a>
      </p>
      <Toast msg={toast.msg} />
    </div>
  );
}

function ReviewsTab({ reviews, avg, onPosted, toast }: { reviews: import("@/lib/types").Review[]; avg: number; onPosted: () => void; toast: (m: string) => void }) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !body.trim()) return toast("이름과 후기를 입력해 주세요");
    setBusy(true);
    const masked = name.trim().slice(0, 1) + "*";
    const { error } = await sb().from("reviews").insert({ name: masked, rating, body: body.trim().slice(0, 1000), service_label: "출장 헤어메이크업" });
    setBusy(false);
    if (error) return toast("리뷰를 등록하지 못했어요. 잠시 후 다시 시도해 주세요");
    setName("");
    setBody("");
    setRating(5);
    toast("리뷰를 등록했어요");
    onPosted();
  }

  return (
    <div className="section">
      {reviews.length > 0 && (
        <div className="rating-sum">
          <div className="big num">{avg.toFixed(1)}</div>
          <div>
            <div className="stars">{"★".repeat(Math.round(avg))}</div>
            <div className="muted" style={{ fontSize: ".85rem" }}>리뷰 {reviews.length}개</div>
          </div>
        </div>
      )}
      <div>
        {reviews.length === 0 && <div className="empty">첫 리뷰를 남겨 주세요.</div>}
        {reviews.map((r) => (
          <div className="review" key={r.id}>
            <div className="head">
              <span>
                <Stars n={r.rating} />
                {r.service_label && ` · ${r.service_label}`}
              </span>
              <span className="muted num">
                {r.name} · {r.created_at.slice(5, 10).replace("-", ".")}
              </span>
            </div>
            <p>{r.body}</p>
            {r.reply && (
              <div className="reply">
                <b>사장님 답글</b>
                <p>{r.reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h3>리뷰 쓰기</h3>
        <div className="star-pick" role="group" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={n <= rating ? "on" : ""} aria-label={`${n}점`} onClick={() => setRating(n)}>
              ★
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="rv-name">이름</label>
          <input id="rv-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="예: 김지수 (첫 글자만 보여요)" />
        </div>
        <div className="field">
          <label htmlFor="rv-text">후기</label>
          <textarea id="rv-text" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="행사 날 어떠셨나요?" />
        </div>
        <div>
          <button className="btn" disabled={busy} onClick={submit}>
            {busy ? "등록 중…" : "리뷰 등록"}
          </button>
        </div>
        <p className="note">
          이름은 첫 글자만 남기고 가려서 저장돼요. 리뷰는 누구나 볼 수 있으니 연락처나 주소는 적지 말아 주세요.{" "}
          <a href="/privacy">개인정보 처리방침</a>
        </p>
      </div>
    </div>
  );
}

function LookupTab() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState<Partial<Booking> | null | "none">(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!code.trim() || !phone.trim()) return;
    setBusy(true);
    const { data, error } = await sb().rpc("lookup_booking", { p_code: code, p_phone: phone });
    setBusy(false);
    setRes(error || !data ? "none" : (data as Partial<Booking>));
  }

  return (
    <div className="section lookup">
      <p className="muted">예약 신청 후 받은 예약번호와 연락처로 예약 상태를 확인할 수 있어요.</p>
      <div className="field">
        <label htmlFor="lk-code">예약번호</label>
        <input id="lk-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: R1126-AB12" autoCapitalize="characters" />
      </div>
      <div className="field">
        <label htmlFor="lk-phone">연락처</label>
        <input id="lk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
      </div>
      <div>
        <button className="btn" onClick={go} disabled={busy}>
          {busy ? "확인 중…" : "예약 확인"}
        </button>
      </div>
      {res === "none" && <p className="err">일치하는 예약이 없어요. 예약번호와 연락처를 다시 확인해 주세요.</p>}
      {res && res !== "none" && (
        <div className="card summary">
          <div><span className="muted">예약번호</span><b className="num">{res.code}</b></div>
          <div><span className="muted">상태</span><span className={`pill st-${res.status}`}>{STATUS_LABEL[res.status!]}</span></div>
          <div><span className="muted">방문 시간</span><span className="num">{dLabel(res.date!)} {hm(res.start_min!)}</span></div>
          <div><span className="muted">메뉴</span><span style={{ textAlign: "right" }}>{res.items?.map((i) => i.name + (i.n > 1 ? ` ×${i.n}` : "")).join(", ")}</span></div>
          <div><span className="muted">총 금액</span><b className="num">{won(res.total!)}</b></div>
        </div>
      )}
    </div>
  );
}
