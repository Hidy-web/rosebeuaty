// 카카오 로그인이 끝나면 카카오가 이 주소로 돌려보내요. 토큰을 저장하고 시험 알림을 보내요.
import { exchangeCode, getLink, saveLink, sendMemo } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (result: string) => Response.redirect(`${u.origin}/admin?kakao=${encodeURIComponent(result)}`, 302);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (u.searchParams.get("error")) return back(u.searchParams.get("error") === "access_denied" ? "denied" : "error");
  if (!code || !state) return back("error");

  // 관리자 화면에서 시작한 연결인지 확인해요. (10분 안에 시작한 것만)
  const link = await getLink().catch(() => null);
  const fresh = link?.oauth_state_at && Date.now() - new Date(link.oauth_state_at).getTime() < 10 * 60e3;
  if (!link?.oauth_state || link.oauth_state !== state || !fresh) return back("expired");
  await saveLink({ oauth_state: null, oauth_state_at: null });

  try {
    await exchangeCode(req, code);
  } catch {
    return back("token_failed");
  }
  try {
    await sendMemo("카카오톡 예약 알림이 연결됐어요. 앞으로 손님이 예약하면 여기로 알려 드릴게요.", `${u.origin}/admin`);
  } catch (e) {
    return back(e instanceof Error && e.message === "no_message_consent" ? "no_consent" : "send_failed");
  }
  return back("ok");
}
