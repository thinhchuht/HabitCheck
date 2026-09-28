import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { groupsApi } from "@/api/groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatVND } from "@/lib/format";
import type { GroupDto } from "@/types/api";

interface PenaltyTiersEditorProps {
  group: GroupDto;
}

function parseNonNegativeInt(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** OWNER-only editor for the group's penalty tiers (bậc phạt). */
export function PenaltyTiersEditor({ group }: PenaltyTiersEditorProps) {
  const queryClient = useQueryClient();
  const [tierValues, setTierValues] = useState<string[]>(
    group.penaltyTiers.tiers.slice(1).map(String)
  );
  const [extra, setExtra] = useState(String(group.penaltyTiers.extraPerActivity));

  const parsedTiers = tierValues.map(parseNonNegativeInt);
  const parsedExtra = parseNonNegativeInt(extra);

  let validationError: string | null = null;
  if (tierValues.length === 0) {
    validationError = "Cần ít nhất 1 bậc phạt.";
  } else if (parsedTiers.some((v) => v == null)) {
    validationError = "Mỗi bậc phải là số nguyên ≥ 0 (VND).";
  } else if (parsedExtra == null) {
    validationError = "Phạt thêm mỗi hoạt động phải là số nguyên ≥ 0 (VND).";
  } else {
    for (let i = 1; i < parsedTiers.length; i++) {
      if ((parsedTiers[i] as number) <= (parsedTiers[i - 1] as number)) {
        validationError = "Các bậc phạt phải tăng dần theo số hoạt động fail.";
        break;
      }
    }
  }

  const previewTiers =
    validationError == null
      ? ([0, ...(parsedTiers as number[])])
      : null;

  const save = useMutation({
    mutationFn: () =>
      groupsApi.updatePenaltyTiers(group.id, {
        tiers: [0, ...(parsedTiers as number[])],
        extraPerActivity: parsedExtra as number,
      }),
    onSuccess: () => {
      toast.success("Đã cập nhật bảng phạt.");
      void queryClient.invalidateQueries({ queryKey: ["group", group.id] });
      void queryClient.invalidateQueries({ queryKey: ["live", group.id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function setTier(i: number, value: string) {
    setTierValues((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cấu hình bậc phạt</CardTitle>
        <CardDescription>
          Tiền phạt mỗi ngày theo số hoạt động fail. Chỉ hiệu lực với các kỳ bắt đầu sau khi lưu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tierValues.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-sm text-slate-600">{i + 1} fail →</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={value}
              onChange={(e) => setTier(i, e.target.value)}
              className="max-w-[180px]"
              aria-label={`Bậc phạt ${i + 1}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400"
              title="Xoá bậc"
              onClick={() =>
                setTierValues((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setTierValues((prev) => [...prev, ""])}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm bậc
        </Button>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className="shrink-0 text-sm text-slate-600">Mỗi fail thêm →</span>
          <Input
            type="number"
            min={0}
            step={1000}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="max-w-[180px]"
            aria-label="Phạt thêm mỗi hoạt động fail"
          />
        </div>

        {previewTiers ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {previewTiers
              .slice(1)
              .map((amount, i) => `${i + 1} fail: ${formatVND(amount)}`)
              .join(" • ")}
          </p>
        ) : null}
        {validationError ? <p className="text-xs text-rose-600">{validationError}</p> : null}

        <Button onClick={() => save.mutate()} disabled={validationError != null || save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu bảng phạt"}
        </Button>
      </CardContent>
    </Card>
  );
}
