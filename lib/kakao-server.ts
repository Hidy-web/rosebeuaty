// 카카오톡 '나에게 보내기'로 새 예약 알림을 관리자에게 보내요. (서버에서만 써요)
// 카카오 토큰은 데이터베이스 kakao_link 표에 보관하고, 이 표는 서버(비밀 키)만 읽고 쓸 수 있어요.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
// Supabase 화면에 따라 secret 키 또는 service_role 키로 나와서 둘 다 받아요.
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";
const CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET ?? "";

export type Missing = "supabase_secret" | "kakao_rest_key";
export function missingEnv(): Missing[] {
  const m: Missing[] = [];
  if (!SUPA_URL || !SECRET_KEY) m.push("supabase_secret");
  if (!REST_KEY) m.push("kakao_rest_key");
  return m;
}

let admin: SupabaseClient | null = null;
export function serviceDb(): SupabaseClient {
  if (!admin) admin = createClient(SUPA_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** 요청을 보낸 사람이 로그인한 관리자인지 확인해요. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON_KEY) return false;
  const c = createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.rpc("is_admin");
  return !error && data === true;
}

export function redirectUri(req: Request) {
  return process.env.KAKAO_REDIRECT_URI || `${new URL(req.url).origin}/api/kakao/callback`;
}

export type Link = {
  id: number;
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  oauth_state: string | null;
  oauth_state_at: string | null;
  last_error: string;
  last_sent_at: string | null;
  connected_at: string | null;
};

export async function getLink(): Promise<Link | null> {
  const { data } = await serviceDb().from("kakao_link").select("*").eq("id", 1).maybeSingle();
  return (data as Link) ?? null;
}

export async function saveLink(patch: Partial<Link>) {
  const { error } = await serviceDb().from("kakao_link").upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error("db_" + error.message);
}

const addSec = (s: number | undefined) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

type TokenRes = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_code?: string;
};

async function tokenCall(params: Record<string, string>): Promise<TokenRes> {
  const body = new URLSearchParams({ client_id: REST_KEY, ...params });
  if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET);
  const r = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    cache: "no-store",
  });
  return (await r.json().catch(() => ({ error: "bad_response" }))) as TokenRes;
}

export function authorizeUrl(req: Request, state: string) {
  const u = new URL("https://kauth.kakao.com/oauth/authorize");
  u.searchParams.set("client_id", REST_KEY);
  u.searchParams.set("redirect_uri", redirectUri(req));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "talk_message");
  u.searchParams.set("state", state);
  return u.toString();
}

/** 카카오 로그인에서 받은 code 를 토큰으로 바꿔 저장해요. */
export async function exchangeCode(req: Request, code: string) {
  const t = await tokenCall({ grant_type: "authorization_code", redirect_uri: redirectUri(req), code });
  if (!t.access_token || !t.refresh_token) throw new Error("token_" + (t.error_code || t.error || "unknown"));
  await saveLink({
    access_token: t.access_token,
    access_expires_at: addSec(t.expires_in),
    refresh_token: t.refresh_token,
    refresh_expires_at: addSec(t.refresh_token_expires_in),
    oauth_state: null,
    oauth_state_at: null,
    last_error: "",
    connected_at: new Date().toISOString(),
  });
}

/** 쓸 수 있는 접근 토큰을 돌려줘요. 곧 만료되면 새로 받아요. (리프레시 토큰이 바뀌면 그것도 저장) */
async function accessToken(force = false): Promise<string> {
  const l = await getLink();
  if (!l?.refresh_token) throw new Error("not_connected");
  const soon = Date.now() + 5 * 60e3;
  const accessOk = l.access_token && l.access_expires_at && new Date(l.access_expires_at).getTime() > soon;
  // 리프레시 토큰이 한 달 안 남았으면 미리 갱신해 두면 카카오가 새 리프레시 토큰을 줘요.
  const refreshSoon = l.refresh_expires_at && new Date(l.refresh_expires_at).getTime() < Date.now() + 30 * 864e5;
  if (accessOk && !force && !refreshSoon) return l.access_token!;

  const t = await tokenCall({ grant_type: "refresh_token", refresh_token: l.refresh_token });
  if (!t.access_token) {
    const reason = t.error === "invalid_grant" ? "reconnect_needed" : "refresh_" + (t.error_code || t.error || "unknown");
    await saveLink({ last_error: reason });
    throw new Error(reason);
  }
  await saveLink({
    access_token: t.access_token,
    access_expires_at: addSec(t.expires_in),
    ...(t.refresh_token ? { refresh_token: t.refresh_token, refresh_expires_at: addSec(t.refresh_token_expires_in) } : {}),
  });
  return t.access_token;
}

/** 관리자 설정 화면을 열 때 토큰을 미리 갱신해 연결이 끊기지 않게 해요. */
export async function keepAlive() {
  try {
    await accessToken();
  } catch {
    /* 상태 화면에서 last_error 로 보여줘요 */
  }
}

/** 관리자 카카오톡 '나와의 채팅'으로 글을 보내요. 글은 200자까지예요. */
export async function sendMemo(text: string, linkUrl: string, buttonTitle = "관리자 화면 열기") {
  const template = {
    object_type: "text",
    text: text.length > 200 ? text.slice(0, 199) + "…" : text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: buttonTitle,
  };
  const send = async (tok: string) =>
    fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
      cache: "no-store",
    });
  let r = await send(await accessToken());
  if (r.status === 401) r = await send(await accessToken(true));
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { code?: number; msg?: string };
    const reason = j.code === -402 ? "no_message_consent" : `send_${j.code ?? r.status}`;
    await saveLink({ last_error: reason });
    throw new Error(reason);
  }
  await saveLink({ last_error: "", last_sent_at: new Date().toISOString() });
}
