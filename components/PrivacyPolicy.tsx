"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import type { Settings } from "@/lib/types";

export const EFFECTIVE_DATE = "2026년 11월 26일";

/** 예약 화면 동의 칸에 보여 주는 짧은 안내예요. */
export function ConsentSummary({ months }: { months: number }) {
  return (
    <table className="consent-table">
      <tbody>
        <tr><th>수집 항목</th><td>예약자 이름, 연락처, 방문 주소, 행사 시간·종류, 요청사항</td></tr>
        <tr><th>이용 목적</th><td>예약 접수·확인, 예약금 입금 확인, 방문 일정 안내 및 연락</td></tr>
        <tr><th>보관 기간</th><td>행사일로부터 {months}개월 보관 후 지체 없이 파기</td></tr>
      </tbody>
    </table>
  );
}

export default function PrivacyPolicy() {
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => {
    sb().from("settings").select("*").eq("id", 1).single().then(({ data }) => data && setSt(data as Settings));
  }, []);
  const shop = st?.shop_name || "로즈 출장 헤어·메이크업";
  const months = st?.retention_months ?? 12;
  const officer = st?.privacy_officer?.trim();
  const contact = st?.privacy_contact?.trim();

  return (
    <article className="policy">
      <h1>개인정보 처리방침</h1>
      <p className="muted">
        {shop}(이하 &ldquo;가게&rdquo;)는 손님의 개인정보를 소중히 여기며, 「개인정보 보호법」에 따라 아래와 같이 개인정보를 처리해요.
      </p>

      <h2>1. 수집하는 개인정보와 이용 목적</h2>
      <table className="consent-table">
        <thead><tr><th>언제</th><th>수집 항목</th><th>이용 목적</th></tr></thead>
        <tbody>
          <tr><td>예약 신청</td><td>[필수] 예약자 이름, 연락처, 방문 주소, 행사 시간·종류<br />[선택] 요청사항</td><td>예약 접수·확인, 예약금 입금 확인, 방문 일정 안내 및 연락, 출장 방문</td></tr>
          <tr><td>리뷰 작성</td><td>[선택] 작성자 이름(첫 글자만 남기고 가려서 저장), 별점, 리뷰 내용</td><td>리뷰 게시</td></tr>
        </tbody>
      </table>
      <p>예약금은 손님이 직접 계좌로 입금하며, 가게는 카드번호나 계좌 비밀번호 같은 결제 정보를 받지 않아요.</p>

      <h2>2. 보관 기간</h2>
      <ul>
        <li>예약 정보: 행사일로부터 <b>{months}개월</b> 동안 보관해요. 예약 확인, 일정 문의와 분쟁 대응을 위해서예요.</li>
        <li>리뷰: 게시하는 동안 보관하며, 작성자가 삭제를 요청하면 지체 없이 지워요.</li>
        <li>법령에 따로 보관하라는 규정이 있으면 그 기간 동안 보관해요.</li>
      </ul>

      <h2>3. 파기 절차와 방법</h2>
      <p>
        보관 기간이 지난 예약 정보는 지체 없이 파기해요. 예약 기록에서 이름, 연락처, 방문 주소, 행사 정보, 요청사항을 지우고 다시 되살릴 수 없게 처리하며,
        매출 확인을 위한 날짜·메뉴·금액만 남겨요. 종이에 적어 둔 정보가 있다면 분쇄하거나 태워서 없애요.
      </p>

      <h2>4. 다른 곳에 제공하거나 맡기는 경우</h2>
      <p>가게는 손님의 개인정보를 다른 사람이나 회사에 제공하지 않아요. 다만 예약 정보를 안전하게 저장하기 위해 아래 업체의 서비스를 이용해요.</p>
      <table className="consent-table">
        <thead><tr><th>맡기는 곳</th><th>맡기는 일</th></tr></thead>
        <tbody>
          <tr><td>Supabase Inc.</td><td>예약 정보 저장 (서버 위치: 대한민국 서울)</td></tr>
        </tbody>
      </table>

      <h2>5. 손님의 권리</h2>
      <p>
        손님은 언제든지 본인의 개인정보를 열람, 정정, 삭제하거나 처리를 멈추라고 요청할 수 있어요. 아래 연락처로 말씀해 주시면 지체 없이 처리해 드려요.
        개인정보 수집에 동의하지 않을 수 있지만, 그 경우 온라인 예약은 할 수 없어요.
      </p>

      <h2>6. 안전하게 지키는 방법</h2>
      <ul>
        <li>예약 정보는 비밀번호로 보호된 관리자만 볼 수 있어요.</li>
        <li>예약 확인은 예약번호와 연락처가 모두 맞을 때만 보여 줘요.</li>
        <li>모든 통신은 암호화(HTTPS)해서 주고받아요.</li>
      </ul>

      <h2>7. 개인정보 보호책임자</h2>
      <ul>
        <li>책임자: {officer || `${shop} 대표`}</li>
        <li>연락처: {contact || "예약 확정 연락을 드린 번호로 문의해 주세요"}</li>
      </ul>
      <p className="muted">
        개인정보 침해 신고나 상담은 개인정보침해신고센터(국번 없이 118, privacy.kisa.or.kr) 또는 개인정보분쟁조정위원회(1833-6972, kopico.go.kr)에도 문의할 수 있어요.
      </p>

      <h2>8. 시행일</h2>
      <p>이 방침은 {EFFECTIVE_DATE}부터 적용돼요. 내용이 바뀌면 이 페이지에 알려 드려요.</p>

      <p><Link href="/" className="btn ghost">예약 화면으로</Link></p>
    </article>
  );
}
