// 손님이 예약을 마치면 화면이 이 주소를 불러요. 관리자 카카오톡으로 새 예약을 알려요.
// 예약 저장은 이미 끝난 뒤라, 여기서 실패해도 예약에는 영향이 없어요.
import { missingEnv, sendAll, serviceDb } from "@/lib/kakao-server";
import { dLabel, hm } from "@/lib/time";

export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/[^0-9]/g, "");
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

type Row = {
  id: string;
  code: string;
  name: string;
  phone: string;
  items: { name: string; n: number }[];
  address: string;
  event_note: string;
  date: string;
  start_min: number;
  total: number;
  travel_fee: number | null;
  deposit: number;
  memo: string;
  kind: string;
  created_at: string;
  admin_notified_at: string | null;
};

export async function POST(req: Request) {
  if (missingEnv().length) return Response.json({ ok: false, reason: "not_set_up" });
  const { code, phone } = (await req.json().catch(() => ({}))) as { code?: string; phone?: string };
  if (typeof code !== "string" || typeof phone !== "string" || code.length > 20) return Response.json({ ok: false }, { status: 400 });

  const db = serviceDb();
  const { data } = await db.from("bookings").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  const b = data as Row | null;
  // 방금(15분 안) 손님이 직접 넣은 예약이고, 연락처가 맞고, 아직 알리지 않은 것만 보내요.
  const recent = b && Date.now() - new Date(b.created_at).getTime() < 15 * 60e3;
  if (!b || !recent || b.kind !== "online" || digits(b.phone) !== digits(phone)) return Response.json({ ok: false }, { status: 404 });

  // 같은 예약으로 두 번 알리지 않도록 먼저 표시해요.
  const { data: claimed } = await db
    .from("bookings")
    .update({ admin_notified_at: new Date().toISOString() })
    .eq("id", b.id)
    .is("admin_notified_at", null)
    .select("id");
  if (!claimed?.length) return Response.json({ ok: true, already: true });

  const menu = b.items.map((i) => i.name + (i.n > 1 ? ` ×${i.n}` : "")).join(", ");
  const lines = [
    `[새 예약] ${b.code}`,
    `${dLabel(b.date)} ${hm(b.start_min)}`,
    `${b.name} ${b.phone}`,
    menu,
    b.address,
    `총 ${won(b.total)}${b.travel_fee == null ? " + 출장비" : ""} · 예약금 ${won(b.deposit)}`,
  ];
  if (b.event_note) lines.splice(4, 0, `행사 ${b.event_note}`);
  if (b.memo) lines.push(`요청 ${b.memo}`);

  // 알림 받는 사람 모두에게 보내요. 한 사람이 실패해도 다른 사람에게는 가요.
  try {
    const r = await sendAll(lines.join("\n"), `${new URL(req.url).origin}/admin`);
    return Response.json({ ok: r.sent > 0, ...r });
  } catch {
    return Response.json({ ok: false, reason: "send_failed" });
  }
}
