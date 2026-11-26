import GuestApp from "@/components/GuestApp";
import Shell from "@/components/Shell";

export default function Home() {
  return (
    <Shell active="guest">
      <GuestApp />
    </Shell>
  );
}
