import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EXCLUSION_REASONS } from "@/lib/pv";

export default function NotOurProductDialog({ open, onOpenChange, onSubmit, busy }) {
  const [reason, setReason] = useState(EXCLUSION_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setReason(EXCLUSION_REASONS[0]);
      setDetail("");
      setComment("");
    }
  }, [open]);

  const needsDetail = reason === "Other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Not our product</DialogTitle>
          <DialogDescription className="text-[12px] text-[#64748B]">
            Choose the exclusion reason. If you are unsure, keep the article as our product and send it to medical review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="block">
            <span className="label-caps">Exclusion reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 h-9 w-full rounded border border-[#E2E8F0] bg-white px-2 text-[12px]"
            >
              {EXCLUSION_REASONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-caps">{needsDetail ? "Detail (required)" : "Detail"}</span>
            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              className="mt-1 h-9 w-full rounded border border-[#E2E8F0] px-2 text-[12px] outline-none focus:border-[#0D9488]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Reviewer comment</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-[#E2E8F0] p-2 text-[12px] outline-none focus:border-[#0D9488]"
            />
          </label>
          <button
            disabled={busy || (needsDetail && !detail.trim())}
            onClick={() => onSubmit({ exclusionReason: reason, exclusionDetail: detail, comment })}
            className="w-full rounded bg-[#DC2626] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Record as not our product
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}