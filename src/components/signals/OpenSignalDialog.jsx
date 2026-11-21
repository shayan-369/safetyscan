import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { openSignal } from "@/lib/icsr-fns";

export default function OpenSignalDialog({ open, onOpenChange, flag }) {
  const [reaction, setReaction] = useState("");
  const [assessment, setAssessment] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const submit = useServerFn(openSignal);

  useEffect(() => {
    if (open && flag) {
      setReaction(flag.reaction);
      setAssessment("");
    }
  }, [open, flag?.reaction]);

  const save = async () => {
    setBusy(true);
    try {
      await submit({ data: { productId: flag.productId, reaction, assessment, source: "Auto flag" } });
      toast.success(`Signal opened for ${reaction}`);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not open the signal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Open a signal</DialogTitle>
          <DialogDescription className="text-[12px] text-[#64748B]">
            {flag?.product} · flagged for {flag?.count90 >= 3 ? `${flag?.count90} reports in 90 days` : "being unexpected"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="block">
            <span className="label-caps">Reaction</span>
            <input
              value={reaction}
              onChange={(event) => setReaction(event.target.value)}
              className="mt-1 h-9 w-full rounded border border-[#E2E8F0] px-2 text-[12px]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Initial assessment</span>
            <textarea
              value={assessment}
              onChange={(event) => setAssessment(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-[#E2E8F0] p-2 text-[12px]"
            />
          </label>
          <button
            onClick={save}
            disabled={busy || reaction.trim().length < 2}
            className="w-full rounded bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Opening…" : "Open signal"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}