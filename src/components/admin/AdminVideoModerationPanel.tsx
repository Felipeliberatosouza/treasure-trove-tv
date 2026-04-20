import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Download, Trash2, Link2, ShieldCheck, Loader2 } from "lucide-react";

interface Props {
  contentId: string;
  contentType: "lesson" | "exam_solution";
  videoUrl: string | null | undefined;
  onChanged?: () => void;
}

const STORAGE_MARKER = "/videos/";

const extractStoragePath = (url?: string | null) => {
  if (!url) return null;
  const idx = url.indexOf(STORAGE_MARKER);
  if (idx < 0) return null;
  return decodeURIComponent(url.slice(idx + STORAGE_MARKER.length).split("?")[0]);
};

const AdminVideoModerationPanel = ({ contentId, contentType, videoUrl, onChanged }: Props) => {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [externalUrl, setExternalUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const table = contentType === "lesson" ? "lessons" : "exam_solutions";
  const storagePath = extractStoragePath(videoUrl);
  const isStored = !!storagePath;
  const isExternal = !!videoUrl && !isStored && /^https?:\/\//.test(videoUrl);

  const handleDownload = async () => {
    if (!storagePath) {
      toast({ title: "Sem arquivo", description: "Não há arquivo armazenado na plataforma para baixar.", variant: "destructive" });
      return;
    }
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(storagePath, 60 * 10, { download: true });
      if (error || !data?.signedUrl) throw error || new Error("Falha ao gerar URL");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = storagePath.split("/").pop() || "video.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await logAction("admin_video_download", { targetTable: table, targetId: contentId, metadata: { path: storagePath } });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao baixar vídeo.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteFromStorage = async () => {
    if (!storagePath) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase.storage.from("videos").remove([storagePath]);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase.from(table).update({ video_url: "" }).eq("id", contentId);
      if (updErr) throw updErr;
      await logAction("admin_video_storage_deleted", { targetTable: table, targetId: contentId, metadata: { path: storagePath } });
      toast({ title: "Arquivo removido", description: "O vídeo foi excluído do armazenamento da plataforma." });
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao excluir.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSaveExternalUrl = async () => {
    const url = externalUrl.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      toast({ title: "URL inválida", description: "Informe uma URL completa (http:// ou https://).", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from(table).update({ video_url: url }).eq("id", contentId);
      if (error) throw error;
      await logAction("admin_video_url_replaced", { targetTable: table, targetId: contentId, metadata: { new_url: url, previous_url: videoUrl } });
      toast({ title: "URL atualizada", description: "O vídeo agora aponta para a URL externa." });
      setExternalUrl("");
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao salvar URL.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold text-foreground">Moderação do Vídeo (Admin)</h3>
      </div>

      <div className="text-xs text-muted-foreground">
        {isStored ? (
          <span>Arquivo armazenado na plataforma: <code className="text-foreground">{storagePath}</code></span>
        ) : isExternal ? (
          <span>Vídeo hospedado externamente: <code className="text-foreground break-all">{videoUrl}</code></span>
        ) : (
          <span>Nenhum vídeo configurado.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={!isStored || downloading}
          className="gap-1.5"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar arquivo
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          disabled={!isStored || deleting}
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Deletar do armazenamento
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <Label htmlFor="external-url" className="text-xs flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Substituir por URL externa
        </Label>
        <div className="flex gap-2">
          <Input
            id="external-url"
            type="url"
            placeholder="https://..."
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="h-9 text-xs"
          />
          <Button size="sm" onClick={handleSaveExternalUrl} disabled={saving || !externalUrl.trim()} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Após salvar, o vídeo passará a ser carregado da URL externa. Se ainda houver arquivo no armazenamento, exclua-o separadamente.
        </p>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vídeo do armazenamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o arquivo do bucket de vídeos e limpa a URL do conteúdo. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFromStorage} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminVideoModerationPanel;
