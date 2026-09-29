import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { fmtDate, fmtTime, formatVND } from "@/lib/format";
import type {
  CheckInCreatedEvent,
  CheckOutCompletedEvent,
  DailyResultUpdatedEvent,
  LiveBoardDto,
  MemberPresenceEvent,
  ProfileUpdatedEvent,
  ProofRejectedEvent,
  SessionStartedEvent,
} from "@/types/api";
import {
  invokeHub,
  onConnectionChange,
  onRealtimeEvent,
  startRealtime,
} from "./connection";

/**
 * Wires SignalR events for the selected group:
 * - joins the group on connect / reconnect (and leaves on unmount),
 * - invalidates the affected react-query caches,
 * - shows Vietnamese toasts for notable events.
 * Call once inside the authenticated app shell.
 */
export function useLiveEvents(): void {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!groupId) return;

    const invalidate = (keys: ReadonlyArray<readonly unknown[]>) => {
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    /** Resolve a display name from the live-board cache when available. */
    const nameOf = (uid: string): string => {
      const live = queryClient.getQueryData<LiveBoardDto>(["live", groupId]);
      return (
        live?.members.find((m) => m.userId === uid)?.displayName ?? "Thành viên"
      );
    };

    const unsubs = [
      // (Re)connect → re-join the current group.
      onConnectionChange(() => {
        void invokeHub("JoinGroup", groupId);
      }),

      onRealtimeEvent<CheckInCreatedEvent>("CheckInCreated", (p) => {
        invalidate([["live", groupId], ["today"], ["proofs"]]);
        if (p.userId !== userId) {
          toast.success(
            `${nameOf(p.userId)} vừa check-in "${p.activityName}" lúc ${fmtTime(p.checkinAt)}`,
          );
        }
      }),

      onRealtimeEvent<CheckOutCompletedEvent>("CheckOutCompleted", () => {
        invalidate([["live", groupId], ["today"]]);
      }),

      onRealtimeEvent<SessionStartedEvent>("SessionStarted", () => {
        invalidate([["live", groupId], ["today"]]);
      }),

      onRealtimeEvent<ProofRejectedEvent>("ProofRejected", (p) => {
        invalidate([
          ["proofs"],
          ["live", groupId],
          ["today"],
          ["stats"],
          ["fund", groupId],
        ]);
        toast.error(
          `Bằng chứng của ${nameOf(p.userId)} đã bị từ chối${p.reason ? `: ${p.reason}` : ""}`,
        );
      }),

      onRealtimeEvent<DailyResultUpdatedEvent>("DailyResultUpdated", (p) => {
        invalidate([
          ["live", groupId],
          ["today"],
          ["stats"],
          ["fund", groupId],
        ]);
        if (p.userId === userId) {
          toast(
            `Kết quả ngày ${fmtDate(p.date)}: ${p.failedCount} hoạt động fail — phạt ${formatVND(
              p.penaltyAmount,
            )} (${p.status}).`,
          );
        }
      }),

      onRealtimeEvent<MemberPresenceEvent>("MemberPresence", () => {
        invalidate([["live", groupId]]);
      }),

      onRealtimeEvent<ProfileUpdatedEvent>("ProfileUpdated", (p) => {
        invalidate([["group", groupId], ["me"]]);
        if (p.userId === userId) {
          const current = useAuthStore.getState().user;
          if (current) {
            useAuthStore.getState().setUser({
              ...current,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl,
            });
          }
        }
      }),
    ];

    void startRealtime()
      .then(() => void invokeHub("JoinGroup", groupId))
      .catch(() => {
        // Realtime is best-effort; pages keep working via queries/invalidation.
      });

    return () => {
      unsubs.forEach((u) => u());
      void invokeHub("LeaveGroup", groupId);
    };
  }, [groupId, userId, queryClient]);
}
