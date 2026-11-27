// 카카오 로그인이 끝나면 카카오가 이 주소로 돌려보내요. 토큰을 저장하고 시험 알림을 보내요.
import { exchangeCode, linkByState, saveLink, sendMemo, getLink } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

const PAGE_TEXT: Record<string, string> = {
  ok: "연결이 끝났어요! 카카오톡 '나와의 채팅'에 시험 알림이 왔는지 확인해 보세요. 이제 이 창은 닫으셔도 돼요.",
  denied: "카카오 로그인에서 동의하지 않아 연결되지 않았어요. 받은 링크를 다시 열어 동의해 주세요.",
  expired: "링크 시간이 지났어요. 관리자에게 새 링크를 받아 주세요.",
  token_failed: "카카오 연결에 실패했어요. 관리자에게 알려 주세요.",
  no_consent: "'카카오톡 메시지 전송'에 동의해야 알림을 받을 수 있어요. 링크를 다시 열어 동의해 주세요.",
  send_failed: "연결은 됐지만 시험 알림을 보내지 못했어요. 관리자에게 알려 주세요.",
  error: "연결에 실패했어요. 관리자에게 알려 주세요.",
};

function page(result: string) {
  const msg = PAGE_TEXT[result] ?? PAGE_TEXT.error;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>카카오톡 예약 알림</title></head>
<body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 20px;text-align:center;line-height:1.6;color:#222;background:#fff">
<h1 style="font-size:1.3rem">카카오톡 예약 알림</h1><p>${msg}</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const state = u.searchParams.get("state") ?? "";
  const toAdmin = state.startsWith("a");
  const back = (result: string) =>
    toAdmin ? Response.redirect(`${u.origin}/admin?kakao=${encodeURIComponent(result)}`, 302) : page(result);
  const code = u.searchParams.get("code");
  if (u.searchParams.get("error")) return back(u.searchParams.get("error") === "access_denied" ? "denied" : "error");
  if (!code || !state) return back("error");

  // 관리자 화면에서 만든 연결인지 확인해요.
  const link = await linkByState(state).catch(() => null);
  if (!link) return back("expired");
  await saveLink(link.id, { oauth_state: null, oauth_state_at: null });

  try {
    await exchangeCode(req, link.id, code);
  } catch {
    return back("token_failed");
  }
  try {
    const fresh = await getLink(link.id);
    await sendMemo(fresh!, "카카오톡 예약 알림이 연결됐어요. 앞으로 손님이 예약하면 여기로 알려 드릴게요.", `${u.origin}/admin`);
  } catch (e) {
    return back(e instanceof Error && e.message === "no_message_consent" ? "no_consent" : "send_failed");
  }
  return back("ok");
}
