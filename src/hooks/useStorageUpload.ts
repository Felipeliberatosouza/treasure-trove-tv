import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useStorageUpload(bucket: string) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File, path: string): Promise<string | null> => {
    const allowed = /^(image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)|video\/(mp4|webm|quicktime)|application\/pdf|audio\/(mpeg|mp4|wav|webm))$/i;
    if (file.type && !allowed.test(file.type)) {
      toast({ title: "Tipo de arquivo não permitido", description: "Envie imagem, vídeo, áudio ou PDF.", variant: "destructive" });
      return null;
    }
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

      if (error) {
        toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
        return null;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      toast({ title: "Erro no upload", description: "Falha ao enviar arquivo.", variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
