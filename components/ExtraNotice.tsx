import { DEFAULT_EXTRA_NOTICE } from "@/lib/time";
export default function ExtraNotice({ text }: { text?: string }) {
  const lines = (text ?? DEFAULT_EXTRA_NOTICE).split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <div className="extra-notice">
      <b>별도 비용 안내</b>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
