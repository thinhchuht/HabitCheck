import { Badge } from "@/components/ui/badge";
import { fmtTime, formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";

interface FinalizeCountdownProps {
  /** "12:00 (giờ VN) ngày hôm sau" — null nếu ngày đã chốt FINAL. */
  finalizeAt: string | null;
}

export function FinalizeCountdown({ finalizeAt }: FinalizeCountdownProps) {
  const now = useNow();

  if (finalizeAt == null) {
    return <Badge variant="secondary">Đã chốt FINAL</Badge>;
  }

  const ms = Date.parse(finalizeAt);
  if (ms <= now) {
    return <Badge variant="danger">Đã qua giờ chốt ({fmtTime(finalizeAt)})</Badge>;
  }

  return (
    <Badge variant="warning" className="font-mono">
      Chốt lúc {fmtTime(finalizeAt)} — còn {formatCountdown(ms, now)}
    </Badge>
  );
}
