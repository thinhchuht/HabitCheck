import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fundApi } from "@/api/fund";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatVND } from "@/lib/format";
import type { MemberDto } from "@/types/api";

interface RecordPaymentDialogProps {
  groupId: string;
  members: MemberDto[];
}

export function RecordPaymentDialog({
  groupId,
  members,
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fundApi.recordPayment(groupId, {
        userId: memberId,
        amount: Number(amount),
        note: note.trim() || null,
      }),
    onSuccess: (res) => {
      toast.success(`Đã ghi nhận đóng ${formatVND(res.amount)}.`);
      setOpen(false);
      setAmount("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["fund", groupId] });
      void queryClient.invalidateQueries({
        queryKey: ["fund-history", groupId],
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const parsed = Number(amount);
  const invalid = memberId === "" || !Number.isFinite(parsed) || parsed <= 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Banknote className="mr-1.5 h-4 w-4" />
          Ghi nhận đóng tiền
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận đóng tiền</DialogTitle>
          <DialogDescription>
            Chỉ chủ nhóm thao tác được. Số tiền được trừ vào khoản nợ của thành
            viên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-member">Thành viên *</Label>
            <Select value={memberId || undefined} onValueChange={setMemberId}>
              <SelectTrigger id="pay-member" aria-label="Chọn thành viên">
                <SelectValue placeholder="Chọn thành viên" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-amount">Số tiền (VND) *</Label>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="20000"
            />
            {amount !== "" && !invalid ? (
              <p className="text-xs text-slate-400">= {formatVND(parsed)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-note">Ghi chú</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Chuyển khoản ngày 25/09"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Huỷ
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={invalid || mutation.isPending}
          >
            {mutation.isPending ? "Đang ghi nhận…" : "Ghi nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
