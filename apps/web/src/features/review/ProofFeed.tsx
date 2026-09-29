import { BadgeCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { ProofFeedItemDto } from "@/types/api";
import { ProofCard } from "./ProofCard";

interface ProofFeedProps {
  items: ProofFeedItemDto[];
}

export function ProofFeed({ items }: ProofFeedProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BadgeCheck className="h-7 w-7" />}
        title="Không có bằng chứng nào"
        description="Chưa có check-in nào trong ngày này. Chọn ngày khác để xem."
      />
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProofCard key={item.checkin.id} item={item} />
      ))}
    </div>
  );
}
