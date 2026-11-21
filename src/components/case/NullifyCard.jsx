import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveX } from "lucide-react";
import { nullifyRecord } from "@/lib/icsr-fns";

export default function NullifyCard({ record, canMedical }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const nullifyFn = useServerFn(nullifyRecord);
  const queryClient = useQueryClient();

  if (record.nullified) {
    return (
      <section className="surface-card p-4">
        <p className="text-[12px] font-semibold text-[#475569]">Record nullified</p>
        <p className="mt-1 text-[11px] text-[#64748B]">
          {record.nullified_reason} · the record is retained for 25 years, not deleted.
        </p>
      </section>
    );
  }

  if (!canMedical) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await nullifyFn({ data: { entity: "Case", id: record.id, reason } });
      toast.success("Case nullified · the record is retained");
      setOpen(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not nullify the record.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card p-4">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] hover:text-[#DC2626]"
      >
        <ArchiveX className="h-3 w-3" /> {open ? "Cancel nullification" : "Nullify this case"}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[10.5px] text-[#64748B]">
            Cases are never deleted. Nullify only when a duplicate or an error is confirmed, and give the reason.
          </p>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (duplicate or error)"
            className="h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px]"
          />
          <button
            onClick={submit}
            disabled={busy || reason.trim().length < 5}
            className="rounded bg-[#DC2626] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Nullify and retain
          </button>
        </div>
      )}
    </section>
  );
}