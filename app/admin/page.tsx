import AdminApp from "@/components/admin/AdminApp";
import Shell from "@/components/Shell";

export const metadata = { title: "관리자 · 로즈 출장 헤어·메이크업", robots: { index: false } };

export default function AdminPage() {
  return (
    <Shell active="admin">
      <AdminApp />
    </Shell>
  );
}
