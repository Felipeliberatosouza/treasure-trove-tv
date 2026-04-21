import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  uploader_id: string;
  uploader_type: "user" | "admin";
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Map MIME → extensões aceitas
const MIME_EXTENSIONS: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/jpg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
};

// Rótulos amigáveis para mensagens
const MIME_LABEL: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
};

// Detecta o tipo real lendo os primeiros bytes (magic numbers)
const detectRealMime = async (file: File): Promise<string | null> => {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = Array.from(head)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // PDF: %PDF
  if (hex.startsWith("25504446")) return "application/pdf";
  // PNG
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  // JPEG
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  // GIF87a / GIF89a
  if (hex.startsWith("474946383761") || hex.startsWith("474946383961"))
    return "image/gif";
  // WEBP: "RIFF"...."WEBP"
  if (hex.startsWith("52494646") && hex.substring(16, 24) === "57454250")
    return "image/webp";
  return null;
};

const normalizeMime = (m: string) => (m === "image/jpg" ? "image/jpeg" : m);

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface UploaderProps {
  ticketId: string;
  uploaderType: "user" | "admin";
  onUploaded: () => void;
  disabled?: boolean;
}

export const TicketAttachmentUploader = ({
  ticketId,
  uploaderType,
  onUploaded,
  disabled,
}: UploaderProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      toast.error("Sessão expirada");
      return;
    }
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      // 1) Tipo declarado pelo navegador deve estar na allowlist
      if (!ALLOWED_MIME.includes(file.type)) {
        toast.error(
          `"${file.name}": tipo de arquivo não permitido. Envie apenas PNG, JPEG, WEBP, GIF ou PDF.`
        );
        continue;
      }
      // 2) Tamanho
      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" excede o limite de 10 MB.`);
        continue;
      }
      // 3) Extensão precisa bater com o MIME declarado
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const expectedExts = MIME_EXTENSIONS[file.type] || [];
      if (!ext || !expectedExts.includes(ext)) {
        toast.error(
          `"${file.name}": a extensão .${ext || "(nenhuma)"} não corresponde ao tipo ${MIME_LABEL[file.type] || file.type}. Renomeie o arquivo para .${expectedExts[0]} ou envie um arquivo válido.`
        );
        continue;
      }
      // 4) Magic number precisa bater com o MIME declarado (impede renomear .exe → .pdf)
      const realMime = await detectRealMime(file);
      if (!realMime) {
        toast.error(
          `"${file.name}": não foi possível identificar o conteúdo do arquivo. Envie um PNG, JPEG, WEBP, GIF ou PDF válido.`
        );
        continue;
      }
      if (normalizeMime(realMime) !== normalizeMime(file.type)) {
        toast.error(
          `"${file.name}": o conteúdo real do arquivo (${MIME_LABEL[realMime] || realMime}) não confere com a extensão .${ext}. Envie um arquivo legítimo.`
        );
        continue;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `${ticketId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, {
          contentType: normalizeMime(file.type),
          upsert: false,
        });
      if (upErr) {
        toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await (supabase as any)
        .from("support_ticket_attachments")
        .insert({
          ticket_id: ticketId,
          uploader_id: user.id,
          uploader_type: uploaderType,
          storage_path: path,
          file_name: file.name.slice(0, 200),
          mime_type: normalizeMime(file.type),
          size_bytes: file.size,
        });
      if (dbErr) {
        await supabase.storage.from("support-attachments").remove([path]);
        toast.error(`Falha ao registrar ${file.name}`);
        continue;
      }
      success += 1;
    }
    setUploading(false);
    if (success > 0) {
      toast.success(
        success === 1 ? "Anexo enviado" : `${success} anexos enviados`
      );
      onUploaded();
    }
  };

  return (
    <label
      className={`inline-flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors ${
        disabled || uploading ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Paperclip className="h-3.5 w-3.5" />
      )}
      {uploading ? "Enviando anexos..." : "Anexar imagem ou PDF"}
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        disabled={disabled || uploading}
      />
    </label>
  );
};

interface ListProps {
  ticketId: string;
  refreshKey: number;
  canDelete?: (att: TicketAttachment) => boolean;
  onChanged?: () => void;
}

export const TicketAttachmentsList = ({
  ticketId,
  refreshKey,
  canDelete,
  onChanged,
}: ListProps) => {
  const [items, setItems] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_ticket_attachments")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar anexos");
      setLoading(false);
      return;
    }
    const list = (data || []) as TicketAttachment[];
    setItems(list);

    // Generate signed URLs for previews and downloads (1 hour)
    const urls: Record<string, string> = {};
    for (const att of list) {
      const { data: signed } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(att.storage_path, 3600);
      if (signed?.signedUrl) urls[att.id] = signed.signedUrl;
    }
    setSignedUrls(urls);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, refreshKey]);

  const handleDelete = async (att: TicketAttachment) => {
    if (!confirm(`Remover anexo "${att.file_name}"?`)) return;
    const { error: dbErr } = await (supabase as any)
      .from("support_ticket_attachments")
      .delete()
      .eq("id", att.id);
    if (dbErr) {
      toast.error("Erro ao remover anexo");
      return;
    }
    await supabase.storage
      .from("support-attachments")
      .remove([att.storage_path]);
    toast.success("Anexo removido");
    onChanged?.();
    load();
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Carregando anexos...</p>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Paperclip className="h-3 w-3" /> Anexos ({items.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((att) => {
          const url = signedUrls[att.id];
          const isImage = att.mime_type.startsWith("image/");
          const showDelete = canDelete ? canDelete(att) : false;
          return (
            <div
              key={att.id}
              className="rounded-lg border border-border bg-card p-2 flex items-start gap-2"
            >
              <div className="shrink-0 w-12 h-12 rounded bg-secondary flex items-center justify-center overflow-hidden">
                {isImage && url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={att.file_name}
                      className="w-12 h-12 object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : att.mime_type === "application/pdf" ? (
                  <FileText className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" title={att.file_name}>
                  {att.file_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(att.size_bytes)} ·{" "}
                  {att.uploader_type === "admin" ? "Suporte" : "Usuário"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {url && (
                    <a
                      href={url}
                      download={att.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </a>
                  )}
                  {showDelete && (
                    <button
                      onClick={() => handleDelete(att)}
                      className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketAttachmentsList;