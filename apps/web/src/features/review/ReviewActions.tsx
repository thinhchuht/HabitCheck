import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { reviewApi } from "@/api/review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/app";

interface ReviewActionsProps {
  checkinId: string;
  canModerate: boolean;
  /** Ngày đã chốt FINAL — mọi thao tác bị khoá. */
  finalized: boolean;
  alreadyReviewed: boolean;
  alreadyReported: boolean;
}

const FINALIZED_TITLE = "Đã chốt (FINAL) — không thể thao tác";

export function ReviewActions({
  checkinId,
  canModerate,
  finalized,
  alreadyReviewed,
  alreadyReported,
}: ReviewActionsProps) {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);
  const [reportOpen, setReportOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["proofs", groupId] });
    if (groupId) {
      void queryClient.invalidateQueries({ queryKey: ["live", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["today"] });
    }
  };

  const report = useMutation({
    mutationFn: () => reviewApi.report(checkinId, reason.trim()),
    onSuccess: () => {
      toast.success("Đã gửi báo cáo. Owner/admin sẽ xem xét.");
      setReportOpen(false);
      setReason("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const approve = useMutation({
    mutationFn: () => reviewApi.approve(checkinId),
    onSuccess: () => {
      toast.success("Đã xác nhận bằng chứng.");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: () => reviewApi.reject(checkinId, reason.trim()),
    onSuccess: () => {
      toast.success("Đã từ chối bằng chứng — kết quả ngày được tính lại.");
      setRejectOpen(false);
      setReason("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const reportDisabled = finalized || alreadyReported;
  const moderateDisabled = finalized || alreadyReviewed;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className={reportDisabled ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
        disabled={reportDisabled}
        title={reportDisabled ? FINALIZED_TITLE : undefined}
        onClick={() => setReportOpen(true)}
      >
        <Flag className="mr-1.5 h-4 w-4" />
        Báo cáo
      </Button>

      {canModerate ? (
        <>
          <Button
            variant="success"
            size="sm"
            disabled={moderateDisabled}
            title={moderateDisabled ? FINALIZED_TITLE : undefined}
            onClick={() => approve.mutate()}
          >
            <ThumbsUp className="mr-1.5 h-4 w-4" />
            Xác nhận
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={moderateDisabled}
            title={moderateDisabled ? FINALIZED_TITLE : undefined}
            onClick={() => setRejectOpen(true)}
          >
            <ThumbsDown className="mr-1.5 h-4 w-4" />
            Từ chối
          </Button>
        </>
      ) : null}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Báo cáo bằng chứng</DialogTitle>
            <DialogDescription>Giải thích lý do nghi vấn để owner/admin xem xét.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="report-reason">Lý do *</Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="VD: Ảnh không đúng bối cảnh check-in…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={reason.trim().length === 0 || report.isPending}
              onClick={() => report.mutate()}
            >
              {report.isPending ? "Đang gửi…" : "Gửi báo cáo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối bằng chứng</DialogTitle>
            <DialogDescription>
              Hoạt động sẽ bị tính là FAIL và kết quả ngày được tính lại ngay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Lý do *</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="VD: Video không khớp thời điểm…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length === 0 || reject.isPending}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? "Đang gửi…" : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
