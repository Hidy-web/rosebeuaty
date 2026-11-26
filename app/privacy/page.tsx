import Shell from "@/components/Shell";
import PrivacyPolicy from "@/components/PrivacyPolicy";

export const metadata = { title: "개인정보 처리방침 · 로즈 출장 헤어·메이크업" };

export default function PrivacyPage() {
  return (
    <Shell active="guest">
      <PrivacyPolicy />
    </Shell>
  );
}
