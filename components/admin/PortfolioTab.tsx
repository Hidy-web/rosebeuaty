"use client";
import { useEffect, useRef, useState } from "react";
import { imageUrl, sb } from "@/lib/supabase";
import type { PortfolioItem } from "@/lib/types";
import type { TabProps } from "./AdminApp";

/** 사진을 긴 변 1600px JPEG로 줄여서 올려요. */
function shrink(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const M = 1600;
      const sc = Math.min(1, M / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * sc);
      c.height = Math.round(im.height * sc);
      c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("변환 실패"))), "image/jpeg", 0.85);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없어요"));
    };
    im.src = url;
  });
}

export default function PortfolioTab({ data, reload, toast }: TabProps) {
  const { pcats, portfolio } = data;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<string>(pcats[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pcats.some((c) => c.id === cat)) setCat(pcats[0]?.id ?? "");
  }, [pcats, cat]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function uploadOne(f: File, t: string, cid: string, sort: number) {
    const blob = await shrink(f);
    const path = `${crypto.randomUUID()}.jpg`;
    const up = await sb().storage.from("portfolio").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const ins = await sb().from("portfolio_items").insert({ category_id: cid, title: t, image_path: path, sort });
    if (ins.error) throw ins.error;
  }

  const minSort = () => Math.min(0, ...portfolio.map((p) => p.sort)) - 1;
  const catName = (id: string | null) => pcats.find((c) => c.id === id)?.name ?? "";

  async function handleFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return toast("사진 파일만 올릴 수 있어요");
    if (files.length === 1) {
      setFile(files[0]);
      toast("사진을 불러왔어요. 제목을 넣고 올려 주세요");
      return;
    }
    if (!cat) return toast("먼저 분류를 하나 만들어 주세요");
    setBusy(true);
    try {
      let s = minSort();
      for (const f of files) await uploadOne(f, `${catName(cat)} 스타일`, cat, s--);
      toast(`사진 ${files.length}장을 ${catName(cat)} 분류로 올렸어요`);
    } catch {
      toast("일부 사진을 올리지 못했어요. 다시 시도해 주세요");
    }
    setBusy(false);
    reload();
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const fs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!fs.length) return;
      e.preventDefault();
      handleFiles(fs);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function addPicked() {
    if (!file || !cat) return;
    setBusy(true);
    try {
      await uploadOne(file, title.trim() || `${catName(cat)} 스타일`, cat, minSort());
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      toast("포트폴리오에 올렸어요");
    } catch {
      toast("사진을 올리지 못했어요. 다시 시도해 주세요");
    }
    setBusy(false);
    reload();
  }

  async function move(p: PortfolioItem, dir: -1 | 1) {
    const i = portfolio.findIndex((x) => x.id === p.id);
    const q = portfolio[i + dir];
    if (!q) return;
    const c = sb();
    // 순서 값이 같을 수 있어서 위치 번호로 다시 매겨요.
    const order = portfolio.map((x) => x.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    const res = await Promise.all([
      c.from("portfolio_items").update({ sort: order.indexOf(p.id) }).eq("id", p.id),
      c.from("portfolio_items").update({ sort: order.indexOf(q.id) }).eq("id", q.id),
      ...portfolio.filter((x) => x.id !== p.id && x.id !== q.id).map((x) => c.from("portfolio_items").update({ sort: order.indexOf(x.id) }).eq("id", x.id)),
    ]);
    if (res.some((r) => r.error)) toast("순서를 바꾸지 못했어요");
    reload();
  }

  async function del(p: PortfolioItem) {
    setDelId(null);
    const c = sb();
    const r = await c.from("portfolio_items").delete().eq("id", p.id);
    if (r.error) return toast("삭제하지 못했어요");
    await c.storage.from("portfolio").remove([p.image_path]);
    toast("사진을 삭제했어요");
    reload();
  }

  async function addCat() {
    const name = (newCat ?? "").trim();
    if (!name) return toast("분류 이름을 입력해 주세요");
    if (pcats.some((c) => c.name === name)) return toast("이미 있는 분류예요");
    const sort = Math.max(0, ...pcats.map((c) => c.sort)) + 1;
    const { data: row, error } = await sb().from("portfolio_categories").insert({ name, sort }).select().single();
    if (error) return toast("저장하지 못했어요");
    setNewCat(null);
    setCat(row.id);
    toast(`${name} 분류를 추가했어요`);
    reload();
  }

  async function delCat(cid: string, name: string) {
    setDelId(null);
    const c = sb();
    const paths = portfolio.filter((p) => p.category_id === cid).map((p) => p.image_path);
    const r = await c.from("portfolio_categories").delete().eq("id", cid); // 사진 행은 함께 지워져요
    if (r.error) return toast("삭제하지 못했어요");
    if (paths.length) await c.storage.from("portfolio").remove(paths);
    toast(`${name} 분류를 삭제했어요`);
    reload();
  }

  return (
    <section
      className="panel"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="panel-head">
        <h2>포트폴리오</h2>
        <span className="muted num">사진 {portfolio.length}장</span>
      </div>

      <div className="pcat-row">
        <span className="muted" style={{ fontSize: ".85rem" }}>분류</span>
        {pcats.map((c) => {
          const n = portfolio.filter((p) => p.category_id === c.id).length;
          const key = "pcat:" + c.id;
          return delId === key ? (
            <span className="pcat confirm" key={c.id}>
              {c.name}
              <button className="btn sm danger" onClick={() => delCat(c.id, c.name)}>{n ? `사진 ${n}장과 함께 삭제` : "삭제"}</button>
              <button className="btn sm ghost" onClick={() => setDelId(null)}>취소</button>
            </span>
          ) : (
            <span className="pcat" key={c.id}>
              {c.name} <small className="num">{n}</small>
              <button className="pcat-x" aria-label={`${c.name} 분류 삭제`} title="분류 삭제" onClick={() => setDelId(key)}>−</button>
            </span>
          );
        })}
        {newCat !== null ? (
          <span className="pcat-new">
            <input value={newCat} maxLength={30} onChange={(e) => setNewCat(e.target.value)} placeholder="새 분류 이름" aria-label="새 분류 이름" autoFocus />
            <button className="btn sm" onClick={addCat}>추가</button>
            <button className="btn sm ghost" onClick={() => setNewCat(null)}>닫기</button>
          </span>
        ) : (
          <button className="icon-btn" aria-label="분류 추가" title="분류 추가" onClick={() => setNewCat("")}>+</button>
        )}
      </div>

      <div className={`pf-add ${drag ? "drag" : ""}`}>
        <div className="pf-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="올릴 사진 미리보기" /> : <span>사진을 여기로<br />끌어다 놓거나<br />복사한 사진을<br />붙여넣으세요</span>}
        </div>
        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          <div className="field">
            <label htmlFor="pf-file">사진</label>
            <input id="pf-file" ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <div className="field">
            <label htmlFor="pf-title">제목</label>
            <input id="pf-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="예: 한복 로우번 업스타일" />
          </div>
          <div className="field">
            <label htmlFor="pf-cat">분류</label>
            <select id="pf-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
              {pcats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <button className="btn" disabled={!file || !cat || busy} onClick={addPicked}>{busy ? "올리는 중…" : "포트폴리오에 올리기"}</button>
          </div>
        </div>
      </div>
      <p className="note">
        사진 파일을 고르거나, 이 화면으로 끌어다 놓거나, 복사한 사진을 붙여넣으면(Ctrl+V, 맥은 ⌘+V) 돼요. 여러 장을 한 번에 고르거나 놓으면 선택된 분류로 바로 올라가요.
      </p>

      {portfolio.length === 0 ? (
        <div className="empty">아직 올린 사진이 없어요.</div>
      ) : (
        <div className="pf-admin">
          {portfolio.map((p, i) => (
            <div className="pf-item" key={p.id}>
              <div className="shot has-img" style={{ background: "var(--sunk)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(p.image_path)} alt={p.title} loading="lazy" />
                <span className="tag">{catName(p.category_id)}</span>
                <span className="cap">{p.title}</span>
              </div>
              <div className="row-actions">
                <button className="btn sm ghost" aria-label="앞으로" disabled={i === 0} onClick={() => move(p, -1)}>←</button>
                <button className="btn sm ghost" aria-label="뒤로" disabled={i === portfolio.length - 1} onClick={() => move(p, 1)}>→</button>
                {delId === p.id ? (
                  <button className="btn sm danger" onClick={() => del(p)}>정말 삭제</button>
                ) : (
                  <button className="btn sm danger" onClick={() => setDelId(p.id)}>삭제</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
