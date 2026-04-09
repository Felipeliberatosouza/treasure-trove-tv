import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Image, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AreaSelector from "@/components/AreaSelector";

interface ContentFormProps {
  table: "lessons" | "exam_solutions";
  onSaved: () => void;
  onCancel: () => void;
}

const ContentForm = ({ table, onSaved, onCancel }: ContentFormProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [carouselFile, setCarouselFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const uploadFile = async (file: File, bucket: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Preencha o título");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      let thumbnail_url = "";
      let carousel_cover_url = "";
      let video_url = "";

      if (thumbnailFile) thumbnail_url = await uploadFile(thumbnailFile, "thumbnails");
      if (carouselFile) carousel_cover_url = await uploadFile(carouselFile, "carousel-covers");
      if (videoFile) video_url = await uploadFile(videoFile, "videos");

      const { error } = await supabase.from(table).insert({
        teacher_id: user.id,
        title,
        description,
        thumbnail_url,
        carousel_cover_url,
        video_url,
        areas: selectedAreas,
      });

      if (error) throw error;
      toast.success("Conteúdo salvo com sucesso!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          {table === "lessons" ? "Nome da aula" : "Nome do conteúdo"}
        </label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary" rows={3} />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Image className="h-3.5 w-3.5" /> Capa do vídeo
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            className="bg-secondary text-xs"
          />
          {thumbnailFile && (
            <button type="button" onClick={() => setThumbnailFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Image className="h-3.5 w-3.5" /> Capa para carrossel
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setCarouselFile(e.target.files?.[0] || null)}
            className="bg-secondary text-xs"
          />
          {carouselFile && (
            <button type="button" onClick={() => setCarouselFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Video className="h-3.5 w-3.5" /> Upload de vídeo
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="bg-secondary text-xs"
          />
          {videoFile && (
            <button type="button" onClick={() => setVideoFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="font-display">
          <Upload className="h-4 w-4 mr-1" />
          {saving ? "Salvando..." : "Publicar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="font-display">
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ContentForm;
