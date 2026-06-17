import { STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", meta.className)}>
      {meta.label}
    </span>
  );
}