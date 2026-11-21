import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { importArticles } from "@/lib/server-fns";
import FormDialog from "@/components/pv/FormDialog";

export default function ImportDialog({ open, onOpenChange, runId, onImported }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [database, setDatabase] = useState("Embase import");
  const [saving, setSaving] = useState(false);
  const importFn = useServerFn(importArticles);

  const readFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error("Choose a CSV or RIS file, or paste the export.");
      return;
    }
    setSaving(true);
    try {
      const result = await importFn({
        data: { runId, text, format: /\.ris$/i.test(fileName) ? "ris" : "auto", database },
      });
      toast.success(`${result.imported} records imported · ${result.duplicates} duplicates linked · ${result.sentToReview} sent to review.`);
      setText("");
      setFileName("");
      onOpenChange(false);
      onImported?.();
    } catch (error) {
      toast.error(error?.message || "Could not import the file.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import an Embase or Canada Vigilance export"
      description="CSV and RIS are both supported. Records are de-duplicated against every earlier article and case."
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#64748B]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-[#0D9488] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Importing and triaging…" : "Import and triage"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#475569]">Database</label>
          <select
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[13px]"
          >
            <option>Embase import</option>
            <option>Canada Vigilance import</option>
            <option>Other</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-4 text-[12px] font-semibold text-[#0F172A]">
          <Upload className="h-4 w-4 text-[#0D9488]" />
          {fileName || "Choose a .csv or .ris file"}
          <input type="file" accept=".csv,.ris,.txt" className="hidden" onChange={readFile} />
        </label>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#475569]">Or paste the export</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-[#E2E8F0] bg-white p-2 font-mono text-[11px]"
            placeholder={"title,authors,journal,publication_date,abstract,pmid,doi\n..."}
          />
        </div>
      </div>
    </FormDialog>
  );
}