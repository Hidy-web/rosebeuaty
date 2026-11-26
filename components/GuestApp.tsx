"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageUrl, reviewErrorText, reviewPhotoUrl, sb } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { STATUS_LABEL, type Booking } from "@/lib/types";
import { dLabel, hm, won } from "@/lib/time";
import ExtraNotice from "./ExtraNotice";
import { DEFAULT_REFUND_POLICY, lines } from "@/lib/pricing";
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
  const [reviewToken, setReviewToken] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  // 관리자가 보낸 리뷰 링크(?review=…)로 들어오면 리뷰 탭을 바로 열어요.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("review");
    if (t) {
      setReviewToken(t);
      setTab("reviews");
    }
    const lk = q.get("lookup");
    if (lk) {
      setLookupCode(lk);
      setTab("lookup");
    }
  }, []);
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
        <p className="eyebrow">혼주 · 하객 · 행사 출장 헤어메이크업</p>
        <h1>{st.tagline}</h1>
        {(st.promise ?? "").trim() && <p className="promise">{st.promise}</p>}
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
                가격은 1인 기준이에요. 모든 예약은 예약금{(st.deposit_pct ?? 0) > 0 ? `(총 금액의 ${st.deposit_pct}%, 최소 ${won(st.deposit)})` : ` ${won(st.deposit)}`} 입금 후 확정되며, 예약금은 당일 결제 금액에서 빠져요.
              </p>
              {((st.weekday_discount_pct ?? 0) > 0 || ((st.group_min ?? 0) > 0 && (st.group_discount ?? 0) > 0) || (st.early_fees ?? []).length > 0) && (
                <div className="extra-notice">
                  <b>할인 · 할증</b>
                  <ul>
                    {(st.weekday_discount_pct ?? 0) > 0 && <li>평일(월~금) 예약은 시술 금액 {st.weekday_discount_pct}% 할인</li>}
                    {(st.group_min ?? 0) > 0 && (st.group_discount ?? 0) > 0 && <li>{st.group_min}명 이상 예약하면 1인당 {won(st.group_discount!)} 할인</li>}
                    {[...(st.early_fees ?? [])].sort((a, b) => b.before - a.before).map((t) => (
                      <li key={t.before}>{hm(t.before)} 전 시작 +{won(t.fee)} (방문 1회당)</li>
                    ))}
                  </ul>
                </div>
              )}
              <ExtraNotice text={st.extra_notice} />
              {lines(st.refund_policy ?? DEFAULT_REFUND_POLICY).length > 0 && (
                <details className="refund">
                  <summary>취소·환불 규정 보기</summary>
                  <ul>{lines(st.refund_policy ?? DEFAULT_REFUND_POLICY).map((l, i) => <li key={i}>{l}</li>)}</ul>
                </details>
              )}
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

          {tab === "reviews" && <ReviewsTab reviews={visibleReviews} avg={avg} onPosted={reload} toast={toast.show} token={reviewToken}
            onTokenUsed={() => { setReviewToken(""); window.history.replaceState(null, "", window.location.pathname); }} />}
          {tab === "lookup" && <LookupTab initialCode={lookupCode} />}
        </div>
      </div>
      <p className="footer">
        {st.shop_name} · <a href="/privacy"><b>개인정보 처리방침</b></a> · <a href="/admin">관리자</a>
      </p>
      <Toast msg={toast.msg} />
    </div>
  );
}


function ReviewsTab({ reviews, avg, onPosted, toast, token, onTokenUsed }: {
  reviews: import("@/lib/types").Review[]; avg: number; onPosted: () => void; toast: (m: string) => void; token: string; onTokenUsed: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const formRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (token) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [token]);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [shrinking, setShrinking] = useState(false);
  const picRef = useRef<HTMLInputElement>(null);

  async function addPics(files: FileList | null) {
    if (!files?.length) return;
    const room = 3 - pics.length;
    if (room <= 0) return setErr("사진은 3장까지 올릴 수 있어요.");
    setErr("");
    setShrinking(true);
    const out: { blob: Blob; url: string }[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) continue;
      try {
        const blob = await compressImage(f);
        out.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        setErr("열 수 없는 사진이 있어요. 다른 사진을 골라 주세요.");
      }
    }
    setShrinking(false);
    setPics((p) => [...p, ...out]);
    if (files.length > room) setErr("사진은 3장까지만 올라가요.");
    if (picRef.current) picRef.current.value = "";
  }
  function removePic(i: number) {
    setPics((p) => {
      URL.revokeObjectURL(p[i].url);
      return p.filter((_, j) => j !== i);
    });
  }

  async function submit() {
    setErr("");
    if (!token) {
      if (!phone.trim()) return setErr("예약하실 때 적은 연락처를 입력해 주세요.");
      if (!code.trim() && !date) return setErr("예약번호나 행사 날짜 중 하나를 입력해 주세요.");
    }
    if (body.trim().length < 5) return setErr("후기를 5자 이상 적어 주세요.");
    setBusy(true);
    // 사진을 먼저 올리고, 올린 경로를 리뷰와 함께 보내요.
    const paths: string[] = [];
    for (const p of pics) {
      const path = `pending/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await sb().storage.from("review-photos").upload(path, p.blob, { contentType: "image/jpeg" });
      if (upErr) {
        setBusy(false);
        return setErr("사진을 올리지 못했어요. 잠시 후 다시 시도하거나 사진 없이 등록해 주세요.");
      }
      paths.push(path);
    }
    const args: Record<string, unknown> = {
      p_token: token || null,
      p_code: token ? null : code.trim() || null,
      p_phone: token ? null : phone,
      p_date: token || code.trim() ? null : date || null,
      p_rating: rating,
      p_body: body,
    };
    if (paths.length) args.p_photos = paths;
    const { error } = await sb().rpc("submit_review", args);
    setBusy(false);
    if (error) return setErr(reviewErrorText(error.message));
    const hadPhotos = paths.length > 0;
    pics.forEach((p) => URL.revokeObjectURL(p.url));
    setPics([]);
    if (token) onTokenUsed();
    setCode("");
    setDate("");
    setPhone("");
    setBody("");
    setRating(5);
    toast(hadPhotos ? "리뷰를 등록했어요. 사진 리뷰는 사장님 확인 후 공개돼요" : "리뷰를 등록했어요");
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
            {(r.photos ?? []).length > 0 && (
              <div className="rv-photos">
                {r.photos!.map((ph) => (
                  <a key={ph} href={reviewPhotoUrl(ph)} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={reviewPhotoUrl(ph)} alt="손님이 올린 사진" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
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
        <h3 ref={formRef}>리뷰 쓰기</h3>
        {token ? (
          <p className="callout" style={{ margin: 0 }}>보내 드린 리뷰 링크로 들어오셨어요. 별점과 후기만 남겨 주시면 돼요.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>
              방문을 받으신 손님만 쓸 수 있어요. (예약당 한 번) 연락처와 함께 <b>예약번호</b>나 <b>행사 날짜</b> 중 하나만 넣어 주세요.
            </p>
            <div className="field">
              <label htmlFor="rv-phone">연락처</label>
              <input id="rv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" />
            </div>
            <div className="settings">
              <div className="field">
                <label htmlFor="rv-date">행사 날짜</label>
                <input id="rv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="rv-code">또는 예약번호</label>
                <input id="rv-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: R1126-AB12" autoCapitalize="characters" />
              </div>
            </div>
          </>
        )}
        <div className="star-pick" role="group" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={n <= rating ? "on" : ""} aria-label={`${n}점`} onClick={() => setRating(n)}>
              ★
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="rv-text">후기</label>
          <textarea id="rv-text" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="행사 날 어떠셨나요?" />
        </div>
        <div className="field">
          <label>사진 (선택, 3장까지)</label>
          <div className="rv-pick">
            {pics.map((p, i) => (
              <span className="rv-thumb" key={p.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`고른 사진 ${i + 1}`} />
                <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => removePic(i)}>×</button>
              </span>
            ))}
            {pics.length < 3 && (
              <button type="button" className="rv-add" onClick={() => picRef.current?.click()} disabled={shrinking}>
                {shrinking ? "줄이는 중…" : "+ 사진"}
              </button>
            )}
          </div>
          <input ref={picRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPics(e.target.files)} />
          <p className="note" style={{ margin: 0 }}>사진은 자동으로 작게 줄여서 올라가요. 사진이 있는 리뷰는 사장님 확인 후 공개돼요.</p>
        </div>
        {err && <p className="err" style={{ margin: 0 }}>{err}</p>}
        <div>
          <button className="btn" disabled={busy} onClick={submit}>
            {busy ? "등록 중…" : "리뷰 등록"}
          </button>
        </div>
        <p className="note">
          이름은 예약자 이름의 첫 글자만 보여요. 리뷰는 누구나 볼 수 있으니 연락처나 주소는 적지 말아 주세요.{" "}
          <a href="/privacy">개인정보 처리방침</a>
        </p>
      </div>
    </div>
  );
}

function LookupTab({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
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
