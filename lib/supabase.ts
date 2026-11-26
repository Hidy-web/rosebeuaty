import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase 환경 변수가 설정되지 않았어요.");
    client = createClient(url, key);
  }
  return client;
}

export function imageUrl(path: string) {
  return sb().storage.from("portfolio").getPublicUrl(path).data.publicUrl;
}

/** Supabase 함수가 돌려주는 오류 코드를 손님이 읽을 문장으로 바꿔요. */
export function bookingErrorText(message: string) {
  const map: Record<string, string> = {
    invalid_name: "예약자 이름을 입력해 주세요.",
    invalid_phone: "연락처를 010-0000-0000 형식으로 입력해 주세요.",
    invalid_address: "방문 주소를 입력해 주세요.",
    invalid_items: "메뉴를 다시 골라 주세요.",
    menu_not_found: "고르신 메뉴 중 판매가 끝난 메뉴가 있어요. 메뉴를 다시 골라 주세요.",
    invalid_region: "지역을 다시 골라 주세요.",
    invalid_date: "예약할 수 없는 날짜예요. 다른 날짜를 골라 주세요.",
    closed_day: "휴무일이에요. 다른 날짜를 골라 주세요.",
    invalid_time: "예약할 수 없는 시간이에요. 다른 시간을 골라 주세요.",
    slot_taken: "방금 다른 예약이 들어왔어요. 다른 시간을 골라 주세요.",
  };
  for (const k of Object.keys(map)) if (message.includes(k)) return map[k];
  return "예약을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
