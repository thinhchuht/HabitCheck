import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InviteCodeCardProps {
  code: string;
}

export function InviteCodeCard({ code }: InviteCodeCardProps) {
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Đã sao chép mã mời.");
    } catch {
      toast.error("Không sao chép được. Hãy tự copy mã.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mã mời</CardTitle>
        <CardDescription>
          Chia sẻ mã này cho bạn bè để mời vào nhóm.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <span className="flex-1 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-indigo-700">
            {code}
          </span>
          <Button variant="outline" onClick={() => void copyCode()}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
