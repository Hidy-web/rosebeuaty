// 관리자 설정 화면의 카카오톡 알림: 상태 보기 · 시험 보내기 · 연결 끊기 (사람별)
import { getLink, getLinks, isAdminRequest, keepAlive, missingEnv, saveLink, sendMemo, validSlot, type Link } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

const view = (l: Link) => ({
  slot: l.id,
  label: l.label ?? "",
  connected: Boolean(l.refresh_token),
  connected_at: l.connected_at,
  last_sent_at: l.last_sent_at,
  last_error: l.last_error ?? "",
});

export async function POST(req: Request) {
  const missing = missingEnv();
  if (missing.length) return Response.json({ people: [], missing });
  if (!(await isAdminRequest(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const { action, slot } = (await req.json().catch(() => ({}))) as { action?: string; slot?: number };
  const origin = new URL(req.url).origin;

  let error = "";
  try {
    if (action === "test" || action === "disconnect") {
      if (!validSlot(slot)) return Response.json({ error: "bad_slot" }, { status: 400 });
      const l = await getLink(slot);
      if (!l?.refresh_token) throw new Error("not_connected");
      if (action === "test") await sendMemo(l, "시험 알림이에요. 카카오톡 예약 알림이 잘 연결돼 있어요.", `${origin}/admin`);
      else await saveLink(slot, { access_token: null, access_expires_at: null, refresh_token: null, refresh_expires_at: null, last_error: "", connected_at: null, last_sent_at: null, label: "" });
    } else {
      await keepAlive(await getLinks());
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "error";
  }
  try {
    const people = (await getLinks()).filter((l) => l.refresh_token || l.label).map(view);
    return Response.json({ ok: !error, error, people, missing: [] });
  } catch {
    return Response.json({ ok: false, error: "db_update_needed", people: [], missing: [] });
  }
}
