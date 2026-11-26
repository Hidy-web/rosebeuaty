import type { Settings } from "./types";
import { dow, hm } from "./time";

// 예약 금액 계산. 데이터베이스 함수 create_booking 과 같은 규칙이에요. (한쪽을 바꾸면 다른 쪽도 바꿔 주세요)
export type EarlyTier = { before: number; fee: number };

export const DEFAULT_REFUND_POLICY = [
  "행사 30일 전까지 취소하면 예약금을 전액 돌려드려요.",
  "행사 29일~8일 전에 취소하면 예약금에서 총 금액의 10%를 뺀 나머지를 돌려드려요.",
  "행사 7일 이내에 취소하거나 연락 없이 예약을 지키지 않으면 예약금은 돌려드리지 않아요.",
  "날짜·시간 변경은 행사 14일 전까지 1회 무료예요. 그 뒤에는 가능한 일정 안에서 1회 2만 원이 들어요.",
  "가게 사정으로 취소하게 되면 예약금 전액을 돌려드리고 총 금액의 10%를 더 배상해 드려요.",
  "천재지변·감염병 등으로 진행이 어려우면 위약금 없이 일정을 바꾸거나 전액 돌려드려요.",
].join("\n");

export const DEFAULT_PROMISE = "행사 시간에 늦지 않도록 전날 꼭 확인 연락을 드려요.";

export const lines = (t?: string) => (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

const floor1000 = (n: number) => Math.floor(n / 1000) * 1000;

export function earlyFee(st: Settings, start: number) {
  return (st.early_fees ?? []).filter((t) => start < t.before).reduce((a, t) => Math.max(a, t.fee), 0);
}

export function earlyLabel(t: EarlyTier) {
  return `${hm(t.before)} 전 시작`;
}

export function price(st: Settings, opts: { subtotal: number; people: number; travelFee: number | null; date: string | null; start: number | null }) {
  const { subtotal, people, travelFee, date, start } = opts;
  const pct = st.weekday_discount_pct ?? 0;
  const wd = date ? dow(date) : -1;
  const weekday = date && pct > 0 && wd >= 1 && wd <= 5 ? floor1000((subtotal * pct) / 100) : 0;
  const gmin = st.group_min ?? 0;
  const group = gmin > 0 && people >= gmin ? (st.group_discount ?? 0) * people : 0;
  const discount = Math.min(subtotal, weekday + group);
  const early = start === null ? 0 : earlyFee(st, start);
  const total = subtotal - discount + (travelFee ?? 0) + early;
  const dp = st.deposit_pct ?? 0;
  const deposit = dp > 0 ? Math.max(st.deposit, floor1000((total * dp) / 100)) : st.deposit;
  return { weekday, group, discount, early, total, deposit };
}
