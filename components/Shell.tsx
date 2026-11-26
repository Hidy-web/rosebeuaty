import Link from "next/link";
import { isConfigured } from "@/lib/supabase";

export default function Shell({ active, children }: { active: "guest" | "admin"; children: React.ReactNode }) {
  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <Link href="/">로즈 출장 헤어·메이크업</Link>
        </div>
        {active === "admin" && (
          <nav className="seg" aria-label="화면 전환">
            <Link href="/">손님 화면</Link>
            <Link href="/admin" aria-current="page">관리자 화면</Link>
          </nav>
        )}
      </header>
      <main>
        {isConfigured() ? (
          children
        ) : (
          <div className="center-msg">
            <h2>설정이 아직 끝나지 않았어요</h2>
            <p className="muted">
              Vercel 프로젝트 설정에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣고 다시 배포해 주세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
