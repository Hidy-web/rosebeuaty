export type Region = { id: string; name: string; fee: number | null };

export type Settings = {
  id: number;
  shop_name: string;
  tagline: string;
  bank: string;
  account: string;
  holder: string;
  deposit: number;
  deadline_hours: number;
  /** 행사일 며칠 전까지 입금해야 확정되는지. 0이면 안내 안 함 */
  confirm_days?: number;
  /** 예약 개인정보 보관 기간(개월) */
  retention_months?: number;
  privacy_officer?: string;
  privacy_contact?: string;
  /** 추가 비용 안내 (주차비, 가발·속눈썹 등). 한 줄에 하나 */
  extra_notice?: string;
  /** 이른 시간 할증: before(분) 이전 시작이면 fee 원 (방문 1회당, 해당하는 것 중 가장 큰 금액) */
  early_fees?: { before: number; fee: number }[];
  weekday_discount_pct?: number;
  group_min?: number;
  group_discount?: number;
  deposit_pct?: number;
  refund_policy?: string;
  promise?: string;
  open_min: number;
  close_min: number;
  buffer_min: number;
  closed_dates: string[];
  regions: Region[];
};

export type Category = { id: string; name: string; sort: number };

export type Service = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  duration_min: number;
  price: number;
  sort: number;
  deleted: boolean;
};

export type PortfolioItem = {
  id: string;
  category_id: string | null;
  title: string;
  image_path: string;
  sort: number;
  created_at: string;
};

export type Review = {
  id: string;
  name: string;
  rating: number;
  service_label: string;
  body: string;
  hidden: boolean;
  reply: string;
  created_at: string;
};

export type BookingItem = { id: string; name: string; price: number; n: number };

export type Booking = {
  id: string;
  code: string;
  name: string;
  phone: string;
  items: BookingItem[];
  region: string;
  region_name: string;
  address: string;
  event_note: string;
  date: string;
  start_min: number;
  duration_min: number;
  subtotal: number;
  travel_fee: number | null;
  total: number;
  deposit: number;
  early_fee?: number;
  discount?: number;
  status: "pending" | "confirmed" | "done" | "canceled";
  memo: string;
  created_at: string;
};

export const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "입금 대기",
  confirmed: "예약 확정",
  done: "시술 완료",
  canceled: "취소",
};
