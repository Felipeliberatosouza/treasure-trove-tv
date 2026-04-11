import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Image, Video, FileText, ClipboardList, Trophy, StickyNote, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AreaSelector from "@/components/AreaSelector";
import VideoRecorder from "./VideoRecorder";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

interface ContentFormProps {
  table: "lessons" | "exam_solutions";
  onSaved: () => void;
  onCancel: () => void;
}

const ContentForm = ({ table, onSaved, onCancel }: ContentFormProps) => {
  const { user } = useAuth();
  const { data: productConfig } = usePlatformSettings("product_config");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [carouselFile, setCarouselFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [resumoFile, setResumoFile] = useState<File | null>(null);
  const [simuladoFile, setSimuladoFile] = useState<File | null>(null);
  const [topQuestoesFile, setTopQuestoesFile] = useState<File | null>(null);
  const [colinhaFile, setColinhaFile] = useState<File | null>(null);
  const [videoType, setVideoType] = useState<string>("revisao");
  const [saving, setSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [subtitlesVtt, setSubtitlesVtt] = useState<string>("");
  const [teacherName, setTeacherName] = useState("");

  const recordingEnabled = productConfig?.revisoes?.enable_recording ?? false;
  const maxRecordingMinutes = productConfig?.revisoes?.max_recording_minutes ?? 30;
  const enableSubtitles = productConfig?.revisoes?.enable_subtitles ?? false;
  const enableBlackboard = productConfig?.revisoes?.enable_blackboard ?? false;
  const enableAutoCover = productConfig?.revisoes?.enable_auto_cover ?? false;

  // Fetch teacher name for auto cover
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setTeacherName(data.name);
      });
  }, [user]);

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
      let resumo_url = "";
      let simulado_url = "";
      let top_questoes_url = "";
      let colinha_url = "";
      let duvidas_url = "";
      let aula_particular_url = "";

      if (thumbnailFile) thumbnail_url = await uploadFile(thumbnailFile, "thumbnails");
      if (carouselFile) carousel_cover_url = await uploadFile(carouselFile, "carousel-covers");
      if (videoFile) video_url = await uploadFile(videoFile, "videos");
      if (resumoFile) resumo_url = await uploadFile(resumoFile, "materials");
      if (simuladoFile) simulado_url = await uploadFile(simuladoFile, "materials");
      if (topQuestoesFile) top_questoes_url = await uploadFile(topQuestoesFile, "materials");
      if (colinhaFile) colinha_url = await uploadFile(colinhaFile, "materials");

      // Upload subtitles VTT if available
      let subtitles_url = "";
      if (subtitlesVtt) {
        const vttBlob = new Blob([subtitlesVtt], { type: "text/vtt" });
        const vttFile = new File([vttBlob], `legendas-${Date.now()}.vtt`, { type: "text/vtt" });
        subtitles_url = await uploadFile(vttFile, "materials");
      }

      const insertData: any = {
        teacher_id: user.id,
        title,
        description,
        thumbnail_url,
        carousel_cover_url,
        video_url,
        areas: selectedAreas,
        video_type: videoType,
        resumo_url,
        simulado_url,
        top_questoes_url,
        colinha_url,
        duvidas_url,
        aula_particular_url,
        published: true,
        admin_approved: false,
      };

      const { error } = await supabase.from(table).insert(insertData);

      if (error) throw error;
      toast.success(
        "Sua aula foi enviada para aprovação da Revisão Fácil! Se estiver de acordo com as regras da plataforma, será publicada em até 3 dias úteis. Você receberá um e-mail com a confirmação da publicação ou com orientações sobre eventuais ajustes necessários.",
        { duration: 12000 }
      );
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
        <label className="text-sm text-muted-foreground mb-1 block">Áreas do conteúdo</label>
        <AreaSelector selected={selectedAreas} onChange={setSelectedAreas} max={3} />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Tipo de vídeo</label>
        <Select value={videoType} onValueChange={setVideoType}>
          <SelectTrigger className="bg-secondary">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revisao">Revisão</SelectItem>
            <SelectItem value="resolucao_prova">Resolução de Questões de Prova</SelectItem>
          </SelectContent>
        </Select>
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
          <Video className="h-3.5 w-3.5" /> Vídeo
        </label>

        {showRecorder ? (
          <VideoRecorder
            maxMinutes={maxRecordingMinutes}
            enableSubtitles={enableSubtitles}
            enableBlackboard={enableBlackboard}
            enableAutoCover={enableAutoCover}
            lessonTitle={title}
            lessonArea={selectedAreas[0] || ""}
            teacherName={teacherName}
            onRecorded={(file, vtt) => {
              setVideoFile(file);
              if (vtt) setSubtitlesVtt(vtt);
              setShowRecorder(false);
              toast.success("Vídeo gravado e processado com sucesso!");
            }}
            onCancel={() => setShowRecorder(false)}
          />
        ) : (
          <div className="space-y-2">
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
            {recordingEnabled && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRecorder(true)}
                className="gap-1"
              >
                <Camera className="h-4 w-4" /> Gravar Vídeo
              </Button>
            )}
            {videoFile && (
              <p className="text-xs text-muted-foreground">
                Arquivo: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-sm font-semibold text-muted-foreground pt-2">Materiais complementares</p>

      {([
        { label: "Resumo", icon: FileText, file: resumoFile, setFile: setResumoFile },
        { label: "Simulado", icon: ClipboardList, file: simuladoFile, setFile: setSimuladoFile },
        { label: "Top Questões de Provas", icon: Trophy, file: topQuestoesFile, setFile: setTopQuestoesFile },
        { label: "Colinha", icon: StickyNote, file: colinhaFile, setFile: setColinhaFile },
      ] as const).map(({ label, icon: Icon, file, setFile }) => (
        <div key={label}>
          <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" /> {label}
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="bg-secondary text-xs"
            />
            {file && (
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}

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
