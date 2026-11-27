// 관리자 설정 화면의 '카카오톡 연결하기' 버튼이 부르는 곳이에요. 카카오 로그인 주소를 돌려줘요.
import { authorizeUrl, isAdminRequest, missingEnv, saveLink } from "@/lib/kakao-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const missing = missingEnv();
  if (missing.length) return Response.json({ error: "missing_env", missing }, { status: 400 });
  if (!(await isAdminRequest(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const state = crypto.randomUUID().replace(/-/g, "");
  try {
    await saveLink({ oauth_state: state, oauth_state_at: new Date().toISOString() });
  } catch {
    return Response.json({ error: "db_update_needed" }, { status: 500 });
  }
  return Response.json({ url: authorizeUrl(req, state) });
}
