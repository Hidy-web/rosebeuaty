"use client";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import type { Service } from "@/lib/types";
import type { TabProps } from "./AdminApp";

export default function MenuTab({ data, reload, toast }: TabProps) {
  const { cats, services } = data;
  const [addIn, setAddIn] = useState<string | null>(null);
  const [ns, setNs] = useState({ name: "", price: "", dur: "60" });
  const [delId, setDelId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null);
  const live = (cid: string) => services.filter((s) => s.category_id === cid && !s.deleted);

  async function run(p: PromiseLike<{ error: unknown }>, ok: string) {
    const { error } = await p;
    if (error) {
      toast("저장하지 못했어요. 다시 시도해 주세요");
      return false;
    }
    toast(ok);
    await reload();
    return true;
  }

  async function addService(cid: string) {
    const name = ns.name.trim();
    const price = Math.round(Number(ns.price));
    if (!name) return toast("메뉴 이름을 입력해 주세요");
    if (!(price > 0)) return toast("가격을 숫자로 입력해 주세요");
    const sort = Math.max(0, ...live(cid).map((s) => s.sort)) + 1;
    if (await run(sb().from("services").insert({ category_id: cid, name, price, duration_min: Number(ns.dur), sort }), `${name} 메뉴를 추가했어요`)) {
      setNs({ name: "", price: "", dur: "60" });
      setAddIn(null);
    }
  }

  async function saveField(s: Service, patch: Partial<Service>, msg: string) {
    await run(sb().from("services").update(patch).eq("id", s.id), msg);
  }

  async function addCat() {
    const name = (newCat ?? "").trim();
    if (!name) return toast("분류 이름을 입력해 주세요");
    if (cats.some((c) => c.name === name)) return toast("이미 있는 분류예요");
    const sort = Math.max(0, ...cats.map((c) => c.sort)) + 1;
    const { data: row, error } = await sb().from("service_categories").insert({ name, sort }).select().single();
    if (error) return toast("저장하지 못했어요");
    toast(`${name} 분류를 추가했어요. 메뉴를 넣어 주세요`);
    setNewCat(null);
    setAddIn(row.id);
    await reload();
  }

  async function delCat(cid: string, name: string) {
    // 기존 예약 기록이 메뉴 이름을 따로 저장하고 있어서, 메뉴는 숨김 처리만 해요.
    const c = sb();
    const a = await c.from("services").update({ deleted: true, category_id: null }).eq("category_id", cid);
    if (a.error) return toast("삭제하지 못했어요");
    setDelId(null);
    await run(c.from("service_categories").delete().eq("id", cid), `${name} 분류를 삭제했어요`);
  }

  return (
    <section className="panel">
      <h2>메뉴 가격</h2>
      <p className="note">
        분류 옆 <b>+</b>로 메뉴를 추가하고 <b>−</b>로 분류를 지워요. 이름이나 금액을 고치고 칸 밖을 누르면 저장돼요.
      </p>
      {cats.map((c) => {
        const L = live(c.id);
        const delKey = "cat:" + c.id;
        return (
          <div className="price-group" key={c.id}>
            <div className="cat-head">
              <h3>{c.name}</h3>
              <span className="cat-btns">
                <button className="icon-btn" title="메뉴 추가" aria-label={`${c.name}에 메뉴 추가`}
                  onClick={() => { setAddIn(addIn === c.id ? null : c.id); setNs({ name: "", price: "", dur: "60" }); }}>+</button>
                {delId === delKey ? (
                  <>
                    <button className="btn sm danger" onClick={() => delCat(c.id, c.name)}>{L.length ? `메뉴 ${L.length}개와 함께 삭제` : "분류 삭제"}</button>
                    <button className="btn sm ghost" onClick={() => setDelId(null)}>취소</button>
                  </>
                ) : (
                  <button className="icon-btn minus" title="분류 삭제" aria-label={`${c.name} 분류 삭제`} onClick={() => setDelId(delKey)}>−</button>
                )}
              </span>
            </div>
            {addIn === c.id && (
              <div className="add-row">
                <div className="field">
                  <label htmlFor="ns-name">메뉴 이름</label>
                  <input id="ns-name" value={ns.name} maxLength={60} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="예: 신부 이모 메이크업" autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="ns-price">가격 (원)</label>
                  <input id="ns-price" type="number" min={0} step={5000} inputMode="numeric" value={ns.price} onChange={(e) => setNs({ ...ns, price: e.target.value })} placeholder="100000" />
                </div>
                <div className="field">
                  <label htmlFor="ns-dur">예상 소요 시간</label>
                  <select id="ns-dur" value={ns.dur} onChange={(e) => setNs({ ...ns, dur: e.target.value })}>
                    {[30, 60, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m}분</option>)}
                  </select>
                </div>
                <div className="row-actions">
                  <button className="btn sm" onClick={() => addService(c.id)}>추가</button>
                  <button className="btn sm ghost" onClick={() => setAddIn(null)}>닫기</button>
                </div>
                <p className="note" style={{ gridColumn: "1/-1" }}>소요 시간은 손님에게 보이지 않고, 예약 시간이 겹치지 않게 계산하는 데만 써요.</p>
              </div>
            )}
            {L.length === 0 && addIn !== c.id && (
              <div className="empty" style={{ padding: "12px 0", textAlign: "left" }}>메뉴가 없어요. + 를 눌러 추가하세요. 메뉴가 없는 분류는 손님 화면에 보이지 않아요.</div>
            )}
            {L.map((s) => (
              <div className="price-row svc-edit" key={s.id}>
                <input className="sname" defaultValue={s.name} aria-label="메뉴 이름" maxLength={60}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) saveField(s, { name: v }, "메뉴 이름을 바꿨어요"); }} />
                <span className="pinput">
                  <input className="num" type="number" min={0} step={5000} inputMode="numeric" defaultValue={s.price} aria-label={`${s.name} 가격`}
                    onBlur={(e) => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== s.price) saveField(s, { price: v }, `${s.name} 가격을 ${v.toLocaleString("ko-KR")}원으로 바꿨어요`); }} />
                  <span className="muted">원</span>
                </span>
                {delId === s.id ? (
                  <button className="btn sm danger" onClick={() => { setDelId(null); saveField(s, { deleted: true }, `${s.name} 메뉴를 삭제했어요`); }}>정말 삭제</button>
                ) : (
                  <button className="btn sm danger" onClick={() => setDelId(s.id)}>삭제</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {newCat !== null ? (
        <div className="add-row cat-add">
          <div className="field">
            <label htmlFor="nc-name">새 분류 이름</label>
            <input id="nc-name" value={newCat} maxLength={30} onChange={(e) => setNewCat(e.target.value)} placeholder="예: 신부 동행" autoFocus />
          </div>
          <div className="row-actions">
            <button className="btn sm" onClick={addCat}>분류 추가</button>
            <button className="btn sm ghost" onClick={() => setNewCat(null)}>닫기</button>
          </div>
        </div>
      ) : (
        <div><button className="btn ghost" onClick={() => setNewCat("")}>+ 분류 추가</button></div>
      )}
    </section>
  );
}
