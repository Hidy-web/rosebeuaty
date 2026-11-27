// 관리자 설정 화면의 카카오톡 알림 상태 보기 · 시험 보내기 · 연결 끊기
import { getLink, isAdminRequest, keepAlive, missingEnv, saveLink, sendMemo } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const missing = missingEnv();
  if (missing.length) return Response.json({ connected: false, missing });
  if (!(await isAdminRequest(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const origin = new URL(req.url).origin;

  try {
    if (action === "test") {
      await sendMemo("시험 알림이에요. 카카오톡 예약 알림이 잘 연결돼 있어요.", `${origin}/admin`);
    } else if (action === "disconnect") {
      await saveLink({ access_token: null, access_expires_at: null, refresh_token: null, refresh_expires_at: null, last_error: "", connected_at: null });
    } else {
      await keepAlive();
    }
  } catch (e) {
    const link = await getLink().catch(() => null);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "error", ...status(link) });
  }
  const link = await getLink().catch(() => undefined);
  if (link === undefined) return Response.json({ ok: false, error: "db_update_needed", connected: false });
  return Response.json({ ok: true, ...status(link) });
}

function status(l: Awaited<ReturnType<typeof getLink>>) {
  return {
    connected: Boolean(l?.refresh_token),
    connected_at: l?.connected_at ?? null,
    last_sent_at: l?.last_sent_at ?? null,
    last_error: l?.last_error ?? "",
    missing: [] as string[],
  };
}
