import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Link2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { saveFullText } from "@/lib/icsr-fns";

export default function FullTextCard({ article, onSaved }) {
  const [status, setStatus] = useState("Not needed");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUri, setFileUri] = useState("");
  const saveFn = useServerFn(saveFullText);

  useEffect(() => {
    setStatus(article?.full_text_status || "Not needed");
    setFileUri(article?.full_text_file_uri || "");
  }, [article?.id, article?.full_text_status, article?.full_text_file_uri]);

  if (!article) return null;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setFileUri(file_uri);
      await saveFn({ data: { articleId: article.id, status: "Received", fileUri: file_uri } });
      setStatus("Received");
      toast.success("Full text uploaded (stored privately)");
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Could not upload the full text.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveFn({ data: { articleId: article.id, status, fileUri } });
      toast.success("Full text status saved");
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Could not save the full text status.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!fileUri) return;
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
    window.open(signed_url, "_blank", "noreferrer");
  };

  return (
    <section className="surface-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-[#0F172A]">Full text</p>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-7 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11px]"
        >
          <option>Not needed</option>
          <option>Requested</option>
          <option>Received</option>
        </select>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        {article.doi && (
          <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0D9488]">
            <Link2 className="h-3 w-3" /> DOI
          </a>
        )}
        {article.pmc_id && (
          <a
            href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmc_id}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#0D9488]"
          >
            <Link2 className="h-3 w-3" /> PubMed Central
          </a>
        )}
        {!article.doi && !article.pmc_id && <span className="text-[#94A3B8]">No DOI or PubMed Central record</span>}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#1E293B]">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
          {fileUri ? "Replace PDF" : "Upload PDF"}
          <input type="file" accept="application/pdf" onChange={upload} className="hidden" />
        </label>
        {fileUri && (
          <button onClick={download} className="text-[11px] font-semibold text-[#0D9488]">
            Open stored PDF
          </button>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#1E293B] disabled:opacity-50"
        >
          Save status
        </button>
      </div>
    </section>
  );
}