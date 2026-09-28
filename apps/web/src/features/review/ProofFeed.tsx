import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { ProofFeedItemDto } from "@/types/api";
import { ProofCard } from "./ProofCard";

interface ProofFeedProps {
  items: ProofFeedItemDto[];
  canModerate: boolean;
  finalized: boolean;
  myName: string;
}

export function ProofFeed({ items, canModerate, finalized, myName }: ProofFeedProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Không có bằng chứng nào"
        description="Chưa có check-in nào khớp bộ lọc trong ngày này."
      />
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProofCard
          key={item.checkin.id}
          item={item}
          canModerate={canModerate}
          finalized={finalized}
          myName={myName}
        />
      ))}
    </div>
  );
}
