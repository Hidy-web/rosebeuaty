"use client";
import { useState } from "react";
import { sb, reviewPhotoUrl } from "@/lib/supabase";
import type { Review } from "@/lib/types";
import type { TabProps } from "./AdminApp";

export default function ReviewsTab({ data, reload, toast }: TabProps) {
  const reviews = [...data.reviews].sort((a, b) => Number(!!b.pending) - Number(!!a.pending));
  const pendingCount = reviews.filter((r) => r.pending).length;
  const [photoDel, setPhotoDel] = useState<string | null>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  async function update(r: Review, patch: Partial<Review>, msg: string) {
    const { error } = await sb().from("reviews").update(patch).eq("id", r.id);
    if (error) return toast("저장하지 못했어요");
    toast(msg);
    reload();
  }
  async function removePhotos(paths: string[]) {
    if (!paths.length) return true;
    const { error } = await sb().storage.from("review-photos").remove(paths);
    return !error;
  }
  async function delPhoto(r: Review, path: string) {
    setPhotoDel(null);
    if (!(await removePhotos([path]))) return toast("사진을 지우지 못했어요. 다시 시도해 주세요");
    update(r, { photos: (r.photos ?? []).filter((p) => p !== path) }, "사진을 삭제했어요");
  }
  async function del(r: Review) {
    setDelId(null);
    await removePhotos(r.photos ?? []);
    const { error } = await sb().from("reviews").delete().eq("id", r.id);
    if (error) return toast("삭제하지 못했어요");
    toast("리뷰를 삭제했어요");
    reload();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>리뷰 관리</h2>
        <span className="muted num">전체 {reviews.length}개 · 숨김 {reviews.filter((r) => r.hidden && !r.pending).length}개{pendingCount > 0 && <> · <b>승인 대기 {pendingCount}개</b></>}</span>
      </div>
      <p className="note">숨긴 리뷰는 손님 화면에 보이지 않고 평점 계산에서도 빠져요. 답글을 달면 리뷰 아래에 &ldquo;사장님 답글&rdquo;로 보여요. 사진이 있는 리뷰는 <b>승인</b>을 눌러야 손님 화면에 보여요. 사진 오른쪽 위 ×로 사진만 지울 수 있어요.</p>
      <div>
        {reviews.length === 0 && <div className="empty">아직 리뷰가 없어요.</div>}
        {reviews.map((r) => (
          <div key={r.id} className={`review ${r.hidden ? "is-hidden" : ""}`}>
            <div className="head">
              <span>
                <span className="stars">{"★".repeat(r.rating)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - r.rating)}</span></span>
                {r.service_label && ` · ${r.service_label}`}
                {r.pending ? <> <span className="pill st-pending">승인 대기</span></> : r.hidden && <> <span className="pill st-canceled">숨김</span></>}
              </span>
              <span className="muted num">{r.name} · {r.created_at.slice(5, 10).replace("-", ".")}</span>
            </div>
            <p>{r.body}</p>
            {!!r.photos?.length && (
              <div className="rv-pick">
                {r.photos.map((p, i) => (
                  <div className="rv-thumb" key={p}>
                    <a href={reviewPhotoUrl(p)} target="_blank" rel="noreferrer"><img src={reviewPhotoUrl(p)} alt={`리뷰 사진 ${i + 1}`} loading="lazy" /></a>
                    {photoDel === p ? (
                      <button className="rv-confirm" aria-label="사진 정말 삭제" onClick={() => delPhoto(r, p)}>삭제</button>
                    ) : (
                      <button aria-label={`사진 ${i + 1} 삭제`} title="사진 삭제" onClick={() => setPhotoDel(p)}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                  {r.pending && <button className="btn sm" onClick={() => update(r, { hidden: false, pending: false }, "리뷰를 승인했어요. 이제 손님 화면에 보여요")}>승인 (공개하기)</button>}
                  <button className="btn sm ghost" onClick={() => { setReplyId(r.id); setText(r.reply); setDelId(null); }}>{r.reply ? "답글 수정" : "답글 달기"}</button>
                  {!r.pending && <button className="btn sm ghost" onClick={() => update(r, { hidden: !r.hidden }, r.hidden ? "리뷰를 다시 보이게 했어요" : "리뷰를 숨겼어요")}>{r.hidden ? "다시 보이기" : "숨기기"}</button>}
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
