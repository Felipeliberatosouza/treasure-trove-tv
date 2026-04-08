import { useEffect, useState } from "react";
import { usePlatformSettings, FeaturedVideosSettings } from "@/hooks/usePlatformSettings";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, X, Video } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VideoOption {
  id: string;
  title: string;
  type: string;
}

const SettingsFeaturedVideos = () => {
  const { data, loading, update } = usePlatformSettings("featured_videos");
  const [form, setForm] = useState<FeaturedVideosSettings>({
    video_ids: [], section_title: "", section_subtitle: "",
  });
  const [saving, setSaving] = useState(false);
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectedVideo, setSelectedVideo] = useState("");

  useEffect(() => { if (data) setForm(data); }, [data]);

  useEffect(() => {
    const fetchVideos = async () => {
      const [lessonsRes, examsRes] = await Promise.all([
        supabase.from("lessons").select("id, title").eq("published", true).eq("admin_approved", true),
        supabase.from("exam_solutions").select("id, title").eq("published", true).eq("admin_approved", true),
      ]);
      const all: VideoOption[] = [
        ...(lessonsRes.data || []).map((l) => ({ ...l, type: "Aula" })),
        ...(examsRes.data || []).map((e) => ({ ...e, type: "Resolução" })),
      ];
      setVideos(all);
    };
    fetchVideos();
  }, []);

  const addVideo = () => {
    if (selectedVideo && !form.video_ids.includes(selectedVideo)) {
      setForm({ ...form, video_ids: [...form.video_ids, selectedVideo] });
      setSelectedVideo("");
    }
  };

  const removeVideo = (id: string) => {
    setForm({ ...form, video_ids: form.video_ids.filter((v) => v !== id) });
  };

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Título da Seção</Label>
        <Input value={form.section_title} onChange={(e) => setForm({ ...form, section_title: e.target.value })} />
      </div>
      <div>
        <Label>Subtítulo da Seção</Label>
        <Input value={form.section_subtitle} onChange={(e) => setForm({ ...form, section_subtitle: e.target.value })} />
      </div>
      <div>
        <Label>Vídeos em Destaque</Label>
        <div className="flex gap-2 mt-1">
          <Select value={selectedVideo} onValueChange={setSelectedVideo}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecionar vídeo..." />
            </SelectTrigger>
            <SelectContent>
              {videos.filter((v) => !form.video_ids.includes(v.id)).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  [{v.type}] {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={addVideo} disabled={!selectedVideo}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {form.video_ids.map((id) => {
            const video = videos.find((v) => v.id === id);
            return (
              <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">
                <Video className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{video?.title || id.slice(0, 8)}</span>
                <button onClick={() => removeVideo(id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {form.video_ids.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum vídeo selecionado</p>
          )}
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsFeaturedVideos;
