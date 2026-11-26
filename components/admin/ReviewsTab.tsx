"use client";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import type { Review } from "@/lib/types";
import type { TabProps } from "./AdminApp";

export default function ReviewsTab({ data, reload, toast }: TabProps) {
  const { reviews } = data;
  const [replyId, setReplyId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  async function update(r: Review, patch: Partial<Review>, msg: string) {
    const { error } = await sb().from("reviews").update(patch).eq("id", r.id);
    if (error) return toast("저장하지 못했어요");
    toast(msg);
    reload();
  }
  async function del(r: Review) {
    setDelId(null);
    const { error } = await sb().from("reviews").delete().eq("id", r.id);
    if (error) return toast("삭제하지 못했어요");
    toast("리뷰를 삭제했어요");
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>리뷰 관리</h2>
        <span className="muted num">전체 {reviews.length}개 · 숨김 {reviews.filter((r) => r.hidden).length}개</span>
      </div>
      <p className="note">숨긴 리뷰는 손님 화면에 보이지 않고 평점 계산에서도 빠져요. 답글을 달면 리뷰 아래에 &ldquo;사장님 답글&rdquo;로 보여요.</p>
      <div>
        {reviews.length === 0 && <div className="empty">아직 리뷰가 없어요.</div>}
        {reviews.map((r) => (
          <div key={r.id} className={`review ${r.hidden ? "is-hidden" : ""}`}>
            <div className="head">
              <span>
                <span className="stars">{"★".repeat(r.rating)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - r.rating)}</span></span>
                {r.service_label && ` · ${r.service_label}`}
                {r.hidden && <> <span className="pill st-canceled">숨김</span></>}
              </span>
              <span className="muted num">{r.name} · {r.created_at.slice(5, 10).replace("-", ".")}</span>
            </div>
            <p>{r.body}</p>
            {replyId === r.id ? (
              <>
                <div className="field">
                  <label htmlFor="rp-text">사장님 답글</label>
                  <textarea id="rp-text" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} autoFocus />
                </div>
                <div className="row-actions">
                  <button className="btn sm" onClick={() => { setReplyId(null); update(r, { reply: text.trim() }, text.trim() ? "답글을 저장했어요" : "답글을 지웠어요"); }}>답글 저장</button>
                  <button className="btn sm ghost" onClick={() => setReplyId(null)}>닫기</button>
                </div>
              </>
            ) : (
              <>
                {r.reply && <div className="reply"><b>사장님 답글</b><p>{r.reply}</p></div>}
                <div className="row-actions">
                  <button className="btn sm ghost" onClick={() => { setReplyId(r.id); setText(r.reply); setDelId(null); }}>{r.reply ? "답글 수정" : "답글 달기"}</button>
                  <button className="btn sm ghost" onClick={() => update(r, { hidden: !r.hidden }, r.hidden ? "리뷰를 다시 보이게 했어요" : "리뷰를 숨겼어요")}>{r.hidden ? "다시 보이기" : "숨기기"}</button>
                  {delId === r.id ? (
                    <button className="btn sm danger" onClick={() => del(r)}>정말 삭제</button>
                  ) : (
                    <button className="btn sm danger" onClick={() => setDelId(r.id)}>삭제</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
