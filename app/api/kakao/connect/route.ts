// 관리자 설정 화면에서 부르는 곳이에요. 알림 받는 사람(slot)의 카카오 연결 주소를 만들어 줘요.
// mode "self": 지금 이 기기에서 바로 카카오 로그인 / mode "invite": 다른 사람에게 보낼 초대 링크 (하루 동안 쓸 수 있어요)
import { authorizeUrl, isAdminRequest, missingEnv, saveLink, validSlot } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const missing = missingEnv();
  if (missing.length) return Response.json({ error: "missing_env", missing }, { status: 400 });
  if (!(await isAdminRequest(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const { slot, label, mode } = (await req.json().catch(() => ({}))) as { slot?: number; label?: string; mode?: string };
  if (!validSlot(slot)) return Response.json({ error: "bad_slot" }, { status: 400 });
  // state 앞 글자로 연결이 끝난 뒤 어디로 보낼지 정해요. (a: 관리자 화면, i: 안내 페이지)
  const state = (mode === "invite" ? "i" : "a") + crypto.randomUUID().replace(/-/g, "");
  try {
    await saveLink(slot, {
      oauth_state: state,
      oauth_state_at: new Date().toISOString(),
      ...(typeof label === "string" ? { label: label.trim().slice(0, 20) } : {}),
    });
  } catch {
    return Response.json({ error: "db_update_needed" }, { status: 500 });
  }
  return Response.json({ url: authorizeUrl(req, state) });
}
