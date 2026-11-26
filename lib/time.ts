// 날짜는 모두 한국 시간 기준 "YYYY-MM-DD" 문자열로 다뤄요.
const pad = (n: number) => String(n).padStart(2, "0");

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function seoulNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function parseD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function dstr(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(s: string, n: number) {
  const d = parseD(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dstr(d);
}
export function dow(s: string) {
  return parseD(s).getUTCDay();
}
export function dLabel(s: string) {
  const d = parseD(s);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DOW[d.getUTCDay()]})`;
}
export const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const DEFAULT_EXTRA_NOTICE = "주차비는 실비로 받아요. (무료 주차가 되면 0원)\n가발(헤어피스)·속눈썹 비용은 별도로 받아요.";
export const won = (n: number) => n.toLocaleString("ko-KR") + "원";
