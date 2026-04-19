import { useState, useEffect, useCallback } from "react";
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
import { compositeVideo, type ImpactWord } from "@/utils/videoCompositor";

interface ResourcePriceInfo {
  resource_type: string;
  price: number;
  min_price: number;
  platform_percentage: number;
}

const RESOURCE_LABELS: Record<string, string> = {
  revisoes: "Revisão (vídeo)",
  resumos: "Resumo",
  simulados: "Simulado",
  top_questoes: "Top Questões",
  colinhas: "Colinha",
};

interface ContentFormProps {
  table: "lessons";
  editData?: any;
  onSaved: () => void;
  onCancel: () => void;
}

const ContentForm = ({ table, editData, onSaved, onCancel }: ContentFormProps) => {
  const { user } = useAuth();
  const { data: productConfig } = usePlatformSettings("product_config");
  const [title, setTitle] = useState(editData?.title || "");
  const [description, setDescription] = useState(editData?.description || "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(editData?.areas || []);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [carouselFile, setCarouselFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [resumoFile, setResumoFile] = useState<File | null>(null);
  const [simuladoFile, setSimuladoFile] = useState<File | null>(null);
  const [topQuestoesFile, setTopQuestoesFile] = useState<File | null>(null);
  const [colinhaFile, setColinhaFile] = useState<File | null>(null);
  const [videoType, setVideoType] = useState<string>(editData?.video_type || "revisao");
  const [saving, setSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [subtitlesVtt, setSubtitlesVtt] = useState<string>("");
  const [teacherName, setTeacherName] = useState("");
  const [processingUpload, setProcessingUpload] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [resourcePrices, setResourcePrices] = useState<ResourcePriceInfo[]>([]);

  const recordingEnabled = productConfig?.revisoes?.enable_recording ?? false;
  const maxRecordingMinutes = productConfig?.revisoes?.max_recording_minutes ?? 30;
  const enableSubtitles = productConfig?.revisoes?.enable_subtitles ?? false;
  const enableBlackboard = productConfig?.revisoes?.enable_blackboard ?? false;
  const enableAutoCover = productConfig?.revisoes?.enable_auto_cover ?? false;
  const needsProcessing = enableSubtitles || enableBlackboard || enableAutoCover;

  const revisaoPricing = resourcePrices.find((r) => r.resource_type === "revisoes");

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

  // Fetch resource pricing config to display to teacher
  useEffect(() => {
    supabase
      .from("resource_prices")
      .select("resource_type, price, min_price, platform_percentage")
      .eq("active", true)
      .then(({ data }) => {
        if (data) setResourcePrices(data as unknown as ResourcePriceInfo[]);
      });
  }, []);

  // Extract audio from a video file and return base64
  const extractAudioBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        try {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);

          const audioRecorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
          const chunks: Blob[] = [];
          audioRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

          const done = new Promise<Blob>((res) => {
            audioRecorder.onstop = () => res(new Blob(chunks, { type: "audio/webm" }));
          });

          audioRecorder.start(500);
          video.muted = false;
          video.playbackRate = 16;
          await video.play();

          video.onended = () => {
            audioRecorder.stop();
            audioCtx.close();
            URL.revokeObjectURL(video.src);
          };

          const audioBlob = await done;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error("Failed to read audio"));
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          URL.revokeObjectURL(video.src);
          reject(err);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Failed to load video"));
      };
    });
  }, []);

  // Process an uploaded video file through the AI pipeline
  const processUploadedVideo = useCallback(async (file: File): Promise<{ processedFile: File; vtt: string }> => {
    setProcessingUpload(true);
    setProcessingStep("Extraindo áudio do vídeo...");

    let impactWords: ImpactWord[] = [];
    let vtt = "";

    try {
      if (enableSubtitles || enableBlackboard) {
        const audioBase64 = await extractAudioBase64(file);
        setProcessingStep("Transcrevendo áudio com IA...");

        const { data: funcData, error: funcError } = await supabase.functions.invoke(
          "process-recorded-video",
          { body: { audioBase64, title, mimeType: "audio/webm" } }
        );

        if (funcError) {
          console.error("Transcription function error:", funcError);
          toast.error("Erro na transcrição. O vídeo será salvo sem legendas/quadro negro.");
        } else if (funcData) {
          vtt = funcData.subtitlesVtt || "";
          impactWords = funcData.impactWords || [];
        }
      }

      if ((enableBlackboard && impactWords.length > 0) || enableAutoCover) {
        setProcessingStep("Processando vídeo com quadro negro e capa...");

        const videoBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        const compositedBlob = await compositeVideo(videoBlob, {
          impactWords: enableBlackboard ? impactWords : [],
          introTitle: enableAutoCover ? title : undefined,
          introArea: enableAutoCover ? (selectedAreas[0] || "") : undefined,
          introTeacher: enableAutoCover ? teacherName : undefined,
          onProgress: () => {},
        });

        const processedFile = new File([compositedBlob], `processado-${Date.now()}.webm`, { type: compositedBlob.type });
        return { processedFile, vtt };
      }

      return { processedFile: file, vtt };
    } finally {
      setProcessingUpload(false);
      setProcessingStep("");
    }
  }, [enableSubtitles, enableBlackboard, enableAutoCover, title, selectedAreas, teacherName, extractAudioBase64]);

  const uploadFile = async (file: File, bucket: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;

    if (bucket === "videos") {
      return path;
    }

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
      let subtitles_url = "";
      if (videoFile) {
        let finalVideoFile = videoFile;
        if (needsProcessing && !subtitlesVtt) {
          try {
            const result = await processUploadedVideo(videoFile);
            finalVideoFile = result.processedFile;
            if (result.vtt) {
              setSubtitlesVtt(result.vtt);
              const vttBlob = new Blob([result.vtt], { type: "text/vtt" });
              const vttFile = new File([vttBlob], `legendas-${Date.now()}.vtt`, { type: "text/vtt" });
              subtitles_url = await uploadFile(vttFile, "materials");
            }
          } catch (err) {
            console.error("Video processing error:", err);
            toast.error("Erro ao processar vídeo. Enviando original.");
          }
        }
        video_url = await uploadFile(finalVideoFile, "videos");
      }
      if (resumoFile) resumo_url = await uploadFile(resumoFile, "materials");
      if (simuladoFile) simulado_url = await uploadFile(simuladoFile, "materials");
      if (topQuestoesFile) top_questoes_url = await uploadFile(topQuestoesFile, "materials");
      if (colinhaFile) colinha_url = await uploadFile(colinhaFile, "materials");

      if (subtitlesVtt && !subtitles_url) {
        const vttBlob = new Blob([subtitlesVtt], { type: "text/vtt" });
        const vttFile = new File([vttBlob], `legendas-${Date.now()}.vtt`, { type: "text/vtt" });
        subtitles_url = await uploadFile(vttFile, "materials");
      }

      const contentData: any = {
        title,
        description,
        areas: selectedAreas,
        video_type: videoType,
        published: true,
        admin_approved: false,
      };

      if (thumbnail_url) contentData.thumbnail_url = thumbnail_url;
      if (carousel_cover_url) contentData.carousel_cover_url = carousel_cover_url;
      if (video_url) contentData.video_url = video_url;
      if (resumo_url) contentData.resumo_url = resumo_url;
      if (simulado_url) contentData.simulado_url = simulado_url;
      if (top_questoes_url) contentData.top_questoes_url = top_questoes_url;
      if (colinha_url) contentData.colinha_url = colinha_url;

      let error;
      if (editData?.id) {
        ({ error } = await supabase.from(table).update(contentData).eq("id", editData.id));
      } else {
        contentData.teacher_id = user.id;
        contentData.thumbnail_url = thumbnail_url;
        contentData.carousel_cover_url = carousel_cover_url;
        contentData.video_url = video_url;
        contentData.resumo_url = resumo_url;
        contentData.simulado_url = simulado_url;
        contentData.top_questoes_url = top_questoes_url;
        contentData.colinha_url = colinha_url;
        contentData.duvidas_url = duvidas_url;
        contentData.aula_particular_url = aula_particular_url;
        ({ error } = await supabase.from(table).insert(contentData));
      }

      if (error) throw error;

      // Notify admins when editing previously approved content
      if (editData?.id && editData?.admin_approved) {
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          const { data: teacherProfile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("user_id", user.id)
            .maybeSingle();

          for (const admin of adminRoles) {
            const { data: adminProfile } = await supabase
              .from("profiles")
              .select("email")
              .eq("user_id", admin.user_id)
              .maybeSingle();

            if (adminProfile?.email) {
              supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "content-edited-admin-notify",
                  recipientEmail: adminProfile.email,
                  idempotencyKey: `content-edited-${editData.id}-${Date.now()}`,
                  templateData: {
                    teacherName: teacherProfile?.name || "",
                    teacherEmail: teacherProfile?.email || "",
                    contentTitle: title,
                    contentType: table,
                  },
                },
              });
            }
          }
        }
      }

      toast.success(
        editData?.id
          ? "Conteúdo atualizado e reenviado para aprovação!"
          : "Sua aula foi enviada para aprovação da Revisão Fácil! Se estiver de acordo com as regras da plataforma, será publicada em até 3 dias úteis. Você receberá um e-mail com a confirmação da publicação ou com orientações sobre eventuais ajustes necessários.",
        { duration: editData?.id ? 5000 : 12000 }
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
        <label className="text-sm text-muted-foreground mb-1 block">Tipo de aula</label>
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
        <label className="text-sm text-muted-foreground mb-1 block">Nome da aula</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Áreas do conteúdo</label>
        <AreaSelector selected={selectedAreas} onChange={setSelectedAreas} max={3} />
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
          {saving ? (processingUpload ? processingStep || "Processando..." : "Enviando...") : editData?.id ? "Salvar Alterações" : "Submeter para Aprovação"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="font-display">
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ContentForm;
