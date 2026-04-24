import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SpellCheckedInput, SpellCheckedTextarea } from "@/components/ui/spellchecked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image as ImageIcon, Video, Camera, DollarSign, CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AreaSelector from "@/components/AreaSelector";
import VideoRecorder from "./VideoRecorder";
import { usePlatformSettings, DEFAULT_PRODUCT_CONFIG } from "@/hooks/usePlatformSettings";
import { compositeVideo, type ImpactWord, type WatermarkStatus } from "@/utils/videoCompositor";
import { shiftVtt } from "@/utils/vttSync";
import { generateDefaultCover } from "@/utils/coverGenerator";
import {
  ResumoMaterial,
  SimuladoMaterial,
  TopQuestionsMaterial,
  ColinhaMaterial,
  type QuizQuestion,
  type TopQuestion,
  type MaterialPriceInfo,
} from "./LessonMaterials";

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

// Default fallbacks; overridden by admin product_config at runtime
const DEFAULT_TITLE_MAX = DEFAULT_PRODUCT_CONFIG.revisoes.title_max;
const DEFAULT_DESCRIPTION_MAX = DEFAULT_PRODUCT_CONFIG.revisoes.description_max;

interface ContentFormProps {
  table: "lessons";
  editData?: any;
  onSaved: () => void;
  onCancel: () => void;
}

const emptyQuiz = (): QuizQuestion[] =>
  Array.from({ length: 5 }, () => ({ question: "", options: ["", "", ""], correct_index: 0 }));
const emptyTop = (): TopQuestion[] => Array.from({ length: 5 }, () => ({ question: "", answer: "" }));
const emptyBullets = (): string[] => Array.from({ length: 10 }, () => "");

// Strip WebVTT formatting and return concatenated plain text of all cues.
const vttToPlainText = (vtt: string): string => {
  return vtt
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t === "WEBVTT") return false;
      if (/^\d+$/.test(t)) return false; // cue index
      if (/-->/i.test(t)) return false; // timestamp line
      if (/^NOTE\b/i.test(t)) return false;
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const ContentForm = ({ table, editData, onSaved, onCancel }: ContentFormProps) => {
  const { user } = useAuth();
  const { data: productConfig } = usePlatformSettings("product_config");
  const { data: branding } = usePlatformSettings("branding");
  const pc = {
    revisoes: { ...DEFAULT_PRODUCT_CONFIG.revisoes, ...(productConfig?.revisoes || {}) },
    resumos: { ...DEFAULT_PRODUCT_CONFIG.resumos, ...(productConfig?.resumos || {}) },
    simulados: { ...DEFAULT_PRODUCT_CONFIG.simulados, ...(productConfig?.simulados || {}) },
    top_questoes: { ...DEFAULT_PRODUCT_CONFIG.top_questoes, ...(productConfig?.top_questoes || {}) },
    colinhas: { ...DEFAULT_PRODUCT_CONFIG.colinhas, ...(productConfig?.colinhas || {}) },
  };
  const TITLE_MAX = pc.revisoes.title_max;
  const DESCRIPTION_MAX = pc.revisoes.description_max;

  // Core fields
  const [title, setTitle] = useState(editData?.title || "");
  const [description, setDescription] = useState(editData?.description || "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(editData?.areas || []);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [carouselFile, setCarouselFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoType, setVideoType] = useState<string>(editData?.video_type || "revisao");
  const [priceRevisoes, setPriceRevisoes] = useState<string>(
    editData?.price_revisoes?.toString() ?? editData?.price?.toString() ?? "",
  );

  // Materials state
  const [resumoOffered, setResumoOffered] = useState(true);
  const [resumoPrice, setResumoPrice] = useState("");
  const [resumoText, setResumoText] = useState("");
  const [resumoTouched, setResumoTouched] = useState(false);

  const [simuladoOffered, setSimuladoOffered] = useState(true);
  const [simuladoPrice, setSimuladoPrice] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(emptyQuiz());

  const [topOffered, setTopOffered] = useState(true);
  const [topPrice, setTopPrice] = useState("");
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>(emptyTop());

  const [colinhaOffered, setColinhaOffered] = useState(true);
  const [colinhaPrice, setColinhaPrice] = useState("");
  const [bullets, setBullets] = useState<string[]>(emptyBullets());

  const [saving, setSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [subtitlesVtt, setSubtitlesVtt] = useState<string>("");
  const [teacherName, setTeacherName] = useState("");
  const [processingUpload, setProcessingUpload] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [watermarkStatus, setWatermarkStatus] = useState<WatermarkStatus | null>(null);
  const [resourcePrices, setResourcePrices] = useState<ResourcePriceInfo[]>([]);
  const [aiGenerating, setAiGenerating] = useState<null | "simulado" | "top_questoes" | "colinha">(null);
  const [regeneratingDescription, setRegeneratingDescription] = useState(false);

  const canGenerateAi = title.trim().length > 0 && description.trim().length > 0;

  // Generate (or regenerate) the lesson description from the recorded transcript.
  const generateDescriptionFromTranscript = useCallback(
    async (vtt: string, opts: { silentIfEmpty?: boolean } = {}): Promise<boolean> => {
      const transcript = vttToPlainText(vtt);
      if (!transcript.trim()) {
        if (!opts.silentIfEmpty) {
          toast.error("Não há transcrição disponível para gerar o resumo.");
        }
        return false;
      }
      const toastId = toast.loading("Gerando resumo da aula com IA...");
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-lesson-material",
          {
            body: {
              kind: "description",
              title: title || "Aula",
              area: selectedAreas[0] || "",
              transcript,
              maxChars: DESCRIPTION_MAX,
            },
          },
        );
        if (error) throw error;
        const generated = (data?.description || "").trim().slice(0, DESCRIPTION_MAX);
        if (generated) {
          setDescription(generated);
          toast.success("Resumo gerado com IA!", { id: toastId });
          return true;
        }
        toast.error("A IA não retornou um resumo. Tente novamente.", { id: toastId });
        return false;
      } catch (err) {
        console.error("Failed to generate description from transcript", err);
        toast.error("Não foi possível gerar o resumo automaticamente.", { id: toastId });
        return false;
      }
    },
    [title, selectedAreas, DESCRIPTION_MAX],
  );

  const handleRegenerateDescription = async () => {
    if (!subtitlesVtt) return;
    setRegeneratingDescription(true);
    try {
      await generateDescriptionFromTranscript(subtitlesVtt);
    } finally {
      setRegeneratingDescription(false);
    }
  };

  const generateMaterialWithAi = async (kind: "simulado" | "top_questoes" | "colinha") => {
    if (!canGenerateAi) {
      toast.error("Preencha o nome e a descrição da aula antes de gerar com IA.");
      return;
    }
    setAiGenerating(kind);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-material", {
        body: { kind, title, description, area: selectedAreas[0] || "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (kind === "simulado" && Array.isArray(data?.questions)) {
        const cleaned: QuizQuestion[] = data.questions.slice(0, 5).map((q: any) => ({
          question: String(q.question || "").slice(0, 200),
          options: (Array.isArray(q.options) ? q.options : []).slice(0, 4).map((o: any) => String(o || "").slice(0, 200)),
          correct_index: Math.max(0, Math.min(3, Number(q.correct_index ?? 0))),
        }));
        if (cleaned.length === 5 && cleaned.every((q) => q.options.length >= 3)) {
          setQuizQuestions(cleaned);
          toast.success("Simulado gerado! Revise antes de publicar.");
        } else {
          throw new Error("Resposta da IA incompleta");
        }
      } else if (kind === "top_questoes" && Array.isArray(data?.questions)) {
        const cleaned: TopQuestion[] = data.questions.slice(0, 5).map((q: any) => ({
          question: String(q.question || "").slice(0, 300),
          answer: String(q.answer || "").slice(0, 300),
        }));
        if (cleaned.length === 5) {
          setTopQuestions(cleaned);
          toast.success("Top Questões geradas! Revise antes de publicar.");
        } else {
          throw new Error("Resposta da IA incompleta");
        }
      } else if (kind === "colinha" && Array.isArray(data?.bullets)) {
        const cleaned = data.bullets.slice(0, 10).map((b: any) => String(b || "").slice(0, 100));
        if (cleaned.length === 10) {
          setBullets(cleaned);
          toast.success("Colinha gerada! Revise antes de publicar.");
        } else {
          throw new Error("Resposta da IA incompleta");
        }
      } else {
        throw new Error("Resposta inesperada da IA");
      }
    } catch (err: any) {
      const msg = err?.message || "Falha ao gerar com IA";
      if (msg.toLowerCase().includes("rate") || msg.includes("429")) {
        toast.error("Limite de uso da IA atingido. Tente novamente em instantes.");
      } else if (msg.includes("402") || msg.toLowerCase().includes("crédito")) {
        toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
      } else {
        toast.error(msg);
      }
    } finally {
      setAiGenerating(null);
    }
  };

  const recordingEnabled = productConfig?.revisoes?.enable_recording ?? false;
  const maxRecordingMinutes = productConfig?.revisoes?.max_recording_minutes ?? 30;
  const enableSubtitles = productConfig?.revisoes?.enable_subtitles ?? false;
  const enableBlackboard = productConfig?.revisoes?.enable_blackboard ?? false;
  const enableAutoCover = productConfig?.revisoes?.enable_auto_cover ?? false;
  const enableWatermark = productConfig?.revisoes?.enable_watermark ?? false;
  const watermarkText = (branding?.platform_name || "").trim();
  const watermarkLogoUrl = (branding?.logo_url || "").trim();
  const needsProcessing =
    enableSubtitles || enableBlackboard || enableAutoCover || enableWatermark;

  const revisaoPricing = resourcePrices.find((r) => r.resource_type === "revisoes");
  const cfgFor = (t: string): MaterialPriceInfo | undefined => {
    const r = resourcePrices.find((x) => x.resource_type === t);
    return r ? { price: r.price, min_price: r.min_price, platform_percentage: r.platform_percentage } : undefined;
  };

  // Auto-fill resumo from description until user edits it manually
  useEffect(() => {
    if (!resumoTouched) {
      setResumoText(description.slice(0, 250));
    }
  }, [description, resumoTouched]);

  // Fetch teacher name
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

  // Fetch resource pricing config
  useEffect(() => {
    supabase
      .from("resource_prices")
      .select("resource_type, price, min_price, platform_percentage")
      .eq("active", true)
      .then(({ data }) => {
        if (data) {
          const list = data as unknown as ResourcePriceInfo[];
          setResourcePrices(list);
          if (!editData?.id) {
            const get = (t: string) => list.find((r) => r.resource_type === t)?.price?.toString() ?? "";
            setPriceRevisoes((p) => p || get("revisoes"));
            setResumoPrice((p) => p || get("resumos"));
            setSimuladoPrice((p) => p || get("simulados"));
            setTopPrice((p) => p || get("top_questoes"));
            setColinhaPrice((p) => p || get("colinhas"));
          }
        }
      });
  }, [editData?.id]);

  // Load existing materials when editing
  useEffect(() => {
    if (!editData?.id) return;
    (async () => {
      const lessonId = editData.id;
      const [meta, sum, qz, tq, ch] = await Promise.all([
        (supabase as any).from("lesson_material_meta").select("*").eq("lesson_id", lessonId),
        (supabase as any).from("lesson_summaries").select("*").eq("lesson_id", lessonId).maybeSingle(),
        (supabase as any).from("lesson_quiz_questions").select("*").eq("lesson_id", lessonId).order("position"),
        (supabase as any).from("lesson_top_questions").select("*").eq("lesson_id", lessonId).order("position"),
        (supabase as any).from("lesson_cheatsheet_items").select("*").eq("lesson_id", lessonId).order("position"),
      ]);
      const metaMap: Record<string, { offered: boolean; price: number }> = {};
      ((meta.data as any[]) || []).forEach((m) => {
        metaMap[m.material_type] = { offered: m.offered, price: Number(m.price) };
      });
      if (metaMap.resumo) {
        setResumoOffered(metaMap.resumo.offered);
        setResumoPrice(String(metaMap.resumo.price || ""));
      }
      if (metaMap.simulado) {
        setSimuladoOffered(metaMap.simulado.offered);
        setSimuladoPrice(String(metaMap.simulado.price || ""));
      }
      if (metaMap.top_questoes) {
        setTopOffered(metaMap.top_questoes.offered);
        setTopPrice(String(metaMap.top_questoes.price || ""));
      }
      if (metaMap.colinha) {
        setColinhaOffered(metaMap.colinha.offered);
        setColinhaPrice(String(metaMap.colinha.price || ""));
      }
      if (sum.data?.content) {
        setResumoText(sum.data.content);
        setResumoTouched(true);
      }
      const quizRows = (qz.data as any[]) || [];
      if (quizRows.length > 0) {
        const loaded = quizRows.map((r) => ({
          question: r.question,
          options: Array.isArray(r.options) ? r.options : [],
          correct_index: r.correct_index ?? 0,
        }));
        setQuizQuestions(loaded.length >= 5 ? loaded : [...loaded, ...emptyQuiz().slice(loaded.length)]);
      }
      const topRows = (tq.data as any[]) || [];
      if (topRows.length > 0) {
        const loaded = topRows.map((r) => ({ question: r.question, answer: r.answer }));
        setTopQuestions(loaded.length >= 5 ? loaded : [...loaded, ...emptyTop().slice(loaded.length)]);
      }
      const chRows = (ch.data as any[]) || [];
      if (chRows.length > 0) {
        const loaded = chRows.map((r) => r.text as string);
        setBullets(loaded.length >= 10 ? loaded : [...loaded, ...emptyBullets().slice(loaded.length)]);
      }
    })();
  }, [editData?.id]);

  // ============================================================
  // Validation + progress
  // ============================================================
  const validations = useMemo(() => {
    const items: { key: string; label: string; valid: boolean }[] = [];
    items.push({ key: "title", label: "Nome da aula", valid: title.trim().length > 0 && title.length <= TITLE_MAX });
    items.push({ key: "type", label: "Tipo de aula", valid: !!videoType });
    items.push({
      key: "areas",
      label: "Áreas do conteúdo",
      valid: selectedAreas.length > 0,
    });
    items.push({
      key: "description",
      label: "Descrição da aula",
      valid: description.trim().length > 0 && description.length <= DESCRIPTION_MAX,
    });
    items.push({
      key: "video",
      label: "Vídeo",
      valid: !!videoFile || !!editData?.video_url,
    });
    items.push({
      key: "video_price",
      label: "Preço da revisão",
      valid: parseFloat(priceRevisoes) > 0,
    });
    // Capa do vídeo / carrossel: optional (auto-generated). Always valid.
    items.push({ key: "thumb", label: "Capa do vídeo (auto se vazio)", valid: true });
    items.push({ key: "carousel", label: "Capa para carrossel (auto se vazio)", valid: true });

    // Materials
    if (resumoOffered) {
      items.push({
        key: "resumo",
        label: "Resumo (texto + preço)",
        valid: resumoText.trim().length > 0 && resumoText.length <= 250 && parseFloat(resumoPrice) > 0,
      });
    }
    if (simuladoOffered) {
      const allFilled =
        quizQuestions.length >= 5 &&
        quizQuestions.every(
          (q) =>
            q.question.trim().length > 0 &&
            q.options.length >= 3 &&
            q.options.every((o) => o.trim().length > 0) &&
            q.correct_index >= 0 &&
            q.correct_index < q.options.length,
        );
      items.push({
        key: "simulado",
        label: "Simulado (≥5 questões + preço)",
        valid: allFilled && parseFloat(simuladoPrice) > 0,
      });
    }
    if (topOffered) {
      const ok =
        topQuestions.length >= 5 &&
        topQuestions.every((q) => q.question.trim().length > 0 && q.answer.trim().length > 0);
      items.push({
        key: "top",
        label: "Top Questões (≥5 + preço)",
        valid: ok && parseFloat(topPrice) > 0,
      });
    }
    if (colinhaOffered) {
      const ok = bullets.length >= 10 && bullets.every((b) => b.trim().length > 0);
      items.push({
        key: "colinha",
        label: "Colinha (≥10 bullets + preço)",
        valid: ok && parseFloat(colinhaPrice) > 0,
      });
    }
    return items;
  }, [
    title,
    videoType,
    selectedAreas,
    description,
    videoFile,
    editData?.video_url,
    priceRevisoes,
    resumoOffered,
    resumoText,
    resumoPrice,
    simuladoOffered,
    quizQuestions,
    simuladoPrice,
    topOffered,
    topQuestions,
    topPrice,
    colinhaOffered,
    bullets,
    colinhaPrice,
  ]);

  const validCount = validations.filter((v) => v.valid).length;
  const progress = Math.round((validCount / validations.length) * 100);
  const allValid = validCount === validations.length;
  const missing = validations.filter((v) => !v.valid);

  // ============================================================
  // Video processing helpers (preserved from original)
  // ============================================================
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

  const processUploadedVideo = useCallback(
    async (file: File): Promise<{ processedFile: File; vtt: string }> => {
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
            { body: { audioBase64, title, mimeType: "audio/webm" } },
          );
          if (funcError) {
            console.error("Transcription function error:", funcError);
            toast.error("Erro na transcrição. O vídeo será salvo sem legendas/quadro negro.");
          } else if (funcData) {
            vtt = funcData.subtitlesVtt || "";
            impactWords = funcData.impactWords || [];
          }
        }
        const willComposite =
          (enableBlackboard && impactWords.length > 0) ||
          enableAutoCover ||
          (enableWatermark && (watermarkText || watermarkLogoUrl));
        if (willComposite) {
          setProcessingStep("Aplicando recursos visuais ao vídeo...");
          setWatermarkStatus(null);
          const videoBlob = new Blob([await file.arrayBuffer()], { type: file.type });
          const compositedBlob = await compositeVideo(videoBlob, {
            impactWords: enableBlackboard ? impactWords : [],
            introTitle: enableAutoCover ? title : undefined,
            introArea: enableAutoCover ? (selectedAreas[0] || "") : undefined,
            introTeacher: enableAutoCover ? teacherName : undefined,
            watermarkText: enableWatermark ? watermarkText || undefined : undefined,
            watermarkLogoUrl: enableWatermark ? watermarkLogoUrl || undefined : undefined,
            onProgress: () => {},
            onWatermarkStatus: (status) => {
              setWatermarkStatus(status);
              if (status.kind === "logo_failed") {
                if (status.fellBackToText) {
                  toast.warning(
                    "Não foi possível carregar a logo da plataforma. A marca d'água será aplicada apenas com o nome da plataforma.",
                    { duration: 8000 },
                  );
                } else {
                  toast.error(
                    "Falha ao carregar a logo da plataforma. O vídeo será publicado sem marca d'água.",
                    { duration: 8000 },
                  );
                }
              }
            },
          });
          const processedFile = new File([compositedBlob], `processado-${Date.now()}.webm`, { type: compositedBlob.type });
          // Shift VTT timestamps to account for the prepended intro cover
          // so the subtitle track stays aligned with the post-composition audio.
          if (enableAutoCover && vtt) {
            const INTRO_SEC = 4; // matches compositeVideo default introDurationSec
            const result = shiftVtt(vtt, INTRO_SEC);
            console.log("[ContentForm] VTT shifted for intro:", {
              cueCount: result.cueCount,
              offsetSec: result.offsetSec,
              samples: result.samples,
              valid: result.valid,
            });
            if (!result.valid) {
              console.warn("[ContentForm] VTT shift validation failed", result.samples);
            }
            vtt = result.vtt;
          }
          return { processedFile, vtt };
        }
        return { processedFile: file, vtt };
      } finally {
        setProcessingUpload(false);
        setProcessingStep("");
      }
    },
    [
      enableSubtitles,
      enableBlackboard,
      enableAutoCover,
      enableWatermark,
      watermarkText,
      watermarkLogoUrl,
      title,
      selectedAreas,
      teacherName,
      extractAudioBase64,
    ],
  );

  const uploadFile = async (file: File, bucket: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    if (bucket === "videos") return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  // ============================================================
  // Submit
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!allValid) {
      toast.error(`Faltam ${missing.length} campo(s): ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    // Validate prices vs minimums
    const priceFields: { type: string; value: string; offered: boolean }[] = [
      { type: "revisoes", value: priceRevisoes, offered: true },
      { type: "resumos", value: resumoPrice, offered: resumoOffered },
      { type: "simulados", value: simuladoPrice, offered: simuladoOffered },
      { type: "top_questoes", value: topPrice, offered: topOffered },
      { type: "colinhas", value: colinhaPrice, offered: colinhaOffered },
    ];
    for (const f of priceFields) {
      if (!f.offered) continue;
      const cfg = resourcePrices.find((r) => r.resource_type === f.type);
      const num = parseFloat(f.value);
      if (cfg && cfg.min_price > 0 && num < cfg.min_price) {
        toast.error(`Preço de "${RESOURCE_LABELS[f.type]}" deve ser ≥ R$ ${cfg.min_price.toFixed(2)}`);
        return;
      }
    }

    setSaving(true);
    try {
      let thumbnail_url = "";
      let carousel_cover_url = "";
      let video_url = "";

      // Auto-generate covers if not provided
      const today = new Date();
      const thumbToUpload =
        thumbnailFile ||
        (!editData?.thumbnail_url
          ? await generateDefaultCover({
              title,
              teacherName,
              date: today,
              width: 1280,
              height: 720,
              variant: "thumbnail",
            })
          : null);
      const carouselToUpload =
        carouselFile ||
        (!editData?.carousel_cover_url
          ? await generateDefaultCover({
              title,
              teacherName,
              date: today,
              width: 1600,
              height: 600,
              variant: "carousel",
            })
          : null);

      if (thumbToUpload) thumbnail_url = await uploadFile(thumbToUpload, "thumbnails");
      if (carouselToUpload) carousel_cover_url = await uploadFile(carouselToUpload, "carousel-covers");

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

      // Per-resource prices (legacy columns kept in sync for compatibility)
      const setPrice = (field: string, val: string, offered: boolean) => {
        if (!offered) return;
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) contentData[field] = n;
      };
      setPrice("price_revisoes", priceRevisoes, true);
      setPrice("price_resumos", resumoPrice, resumoOffered);
      setPrice("price_simulados", simuladoPrice, simuladoOffered);
      setPrice("price_top_questoes", topPrice, topOffered);
      setPrice("price_colinhas", colinhaPrice, colinhaOffered);

      let lessonId: string;
      if (editData?.id) {
        const { error } = await supabase.from(table).update(contentData).eq("id", editData.id);
        if (error) throw error;
        lessonId = editData.id;
      } else {
        contentData.teacher_id = user.id;
        if (revisaoPricing) contentData.platform_percentage = revisaoPricing.platform_percentage;
        const mainPrice = parseFloat(priceRevisoes);
        if (!isNaN(mainPrice) && mainPrice > 0) contentData.price = mainPrice;
        const { data: inserted, error } = await supabase.from(table).insert(contentData).select("id").single();
        if (error) throw error;
        lessonId = (inserted as any).id;
      }

      // Save structured materials (upsert pattern: clear children + reinsert)
      const sb = supabase as any;

      // Meta
      const metas = [
        { material_type: "resumo", offered: resumoOffered, price: parseFloat(resumoPrice) || 0 },
        { material_type: "simulado", offered: simuladoOffered, price: parseFloat(simuladoPrice) || 0 },
        { material_type: "top_questoes", offered: topOffered, price: parseFloat(topPrice) || 0 },
        { material_type: "colinha", offered: colinhaOffered, price: parseFloat(colinhaPrice) || 0 },
      ].map((m) => ({ ...m, lesson_id: lessonId }));
      await sb.from("lesson_material_meta").delete().eq("lesson_id", lessonId);
      await sb.from("lesson_material_meta").insert(metas);

      // Resumo
      await sb.from("lesson_summaries").delete().eq("lesson_id", lessonId);
      if (resumoOffered) {
        await sb.from("lesson_summaries").insert({ lesson_id: lessonId, content: resumoText });
      }

      // Simulado
      await sb.from("lesson_quiz_questions").delete().eq("lesson_id", lessonId);
      if (simuladoOffered) {
        const rows = quizQuestions.map((q, i) => ({
          lesson_id: lessonId,
          position: i,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
        }));
        await sb.from("lesson_quiz_questions").insert(rows);
      }

      // Top questions
      await sb.from("lesson_top_questions").delete().eq("lesson_id", lessonId);
      if (topOffered) {
        const rows = topQuestions.map((q, i) => ({
          lesson_id: lessonId,
          position: i,
          question: q.question,
          answer: q.answer,
        }));
        await sb.from("lesson_top_questions").insert(rows);
      }

      // Cheatsheet
      await sb.from("lesson_cheatsheet_items").delete().eq("lesson_id", lessonId);
      if (colinhaOffered) {
        const rows = bullets.map((b, i) => ({ lesson_id: lessonId, position: i, text: b }));
        await sb.from("lesson_cheatsheet_items").insert(rows);
      }

      // Notify admins on edits of approved content
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
        { duration: editData?.id ? 5000 : 12000 },
      );
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Progresso da aula: {validCount}/{validations.length} campos preenchidos
          </p>
          <span className={`text-xs font-bold ${allValid ? "text-success" : "text-primary"}`}>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        {!allValid && missing.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Faltam {missing.length} item(s) — clique para ver
            </summary>
            <ul className="mt-1.5 pl-4 space-y-0.5 text-muted-foreground">
              {missing.map((m) => (
                <li key={m.key}>• {m.label}</li>
              ))}
            </ul>
          </details>
        )}
        {allValid && (
          <p className="mt-1.5 text-xs text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Tudo pronto para enviar!
          </p>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Tipo de aula *</label>
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

      {/* Title */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Nome da aula *</label>
        <SpellCheckedInput
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-secondary"
          placeholder="Ex: Revisão de Direito Constitucional"
        />
        <p className="text-[11px] text-muted-foreground text-right mt-0.5">
          {title.length}/{TITLE_MAX}
        </p>
      </div>

      {/* Areas */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Áreas do conteúdo *</label>
        <AreaSelector selected={selectedAreas} onChange={setSelectedAreas} max={3} />
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-sm text-muted-foreground">Descrição da aula *</label>
          {subtitlesVtt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerateDescription}
              disabled={regeneratingDescription}
              className="h-7 text-[11px] gap-1"
            >
              {regeneratingDescription ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {regeneratingDescription ? "Gerando..." : "Regerar resumo com IA"}
            </Button>
          )}
        </div>
        <SpellCheckedTextarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-secondary"
          rows={3}
          placeholder="Resumo curto sobre o que será abordado"
        />
        <p className="text-[11px] text-muted-foreground text-right mt-0.5">
          {description.length}/{DESCRIPTION_MAX}
        </p>
      </div>

      {/* Thumbnail */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" /> Capa do vídeo
          <span className="text-[10px] text-muted-foreground">(opcional — geramos uma capa padrão se vazio)</span>
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

      {/* Carousel */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" /> Capa para carrossel
          <span className="text-[10px] text-muted-foreground">(opcional — geramos uma capa padrão se vazio)</span>
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

      {/* Video */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Video className="h-3.5 w-3.5" /> Vídeo *
        </label>
        {showRecorder ? (
          <VideoRecorder
            maxMinutes={maxRecordingMinutes}
            enableSubtitles={enableSubtitles}
            enableBlackboard={enableBlackboard}
            enableAutoCover={enableAutoCover}
            enableWatermark={enableWatermark}
            watermarkText={watermarkText}
            watermarkLogoUrl={watermarkLogoUrl}
            lessonTitle={title}
            lessonArea={selectedAreas[0] || ""}
            teacherName={teacherName}
            onRecorded={async (file, vtt) => {
              setVideoFile(file);
              if (vtt) setSubtitlesVtt(vtt);
              setShowRecorder(false);
              toast.success("Vídeo gravado e processado com sucesso!");

              // Auto-generate description from VTT transcript using AI
              if (vtt && (!description || description.trim().length === 0)) {
                await generateDescriptionFromTranscript(vtt, { silentIfEmpty: true });
              }

              // Inform teacher about next steps with AI assistance
              toast.info(
                "Agora preencha os recursos da aula (Resumo, Simulado, Top Questões e Colinha). Você pode usar a IA gratuita disponível em cada recurso para gerar o conteúdo automaticamente.",
                { duration: 9000 },
              );
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
              <Button type="button" size="sm" variant="outline" onClick={() => setShowRecorder(true)} className="gap-1">
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
        {/* Revisão price */}
        {(videoFile || editData?.video_url) && (() => {
          const cfg = resourcePrices.find((r) => r.resource_type === "revisoes");
          return (
            <div className="mt-2 flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min={cfg?.min_price || 0}
                placeholder={cfg ? `Sugerido R$ ${cfg.price.toFixed(2)} · mín. R$ ${cfg.min_price.toFixed(2)}` : "Preço (R$)"}
                value={priceRevisoes}
                onChange={(e) => setPriceRevisoes(e.target.value)}
                className="bg-secondary text-xs h-9 max-w-[220px]"
              />
              {cfg && (
                <span className="text-[11px] text-muted-foreground">
                  você recebe {100 - (cfg.platform_percentage || 0)}%
                </span>
              )}
            </div>
          );
        })()}
      </div>

      <p className="text-sm font-semibold pt-2 border-t border-border">Materiais complementares</p>

      <ResumoMaterial
        offered={resumoOffered}
        setOffered={setResumoOffered}
        price={resumoPrice}
        setPrice={setResumoPrice}
        text={resumoText}
        setText={(v) => {
          setResumoText(v);
          setResumoTouched(true);
        }}
        cfg={cfgFor("resumos")}
        textMax={pc.resumos.text_max}
      />

      <SimuladoMaterial
        offered={simuladoOffered}
        setOffered={setSimuladoOffered}
        price={simuladoPrice}
        setPrice={setSimuladoPrice}
        questions={quizQuestions}
        setQuestions={setQuizQuestions}
        cfg={cfgFor("simulados")}
        onGenerate={() => generateMaterialWithAi("simulado")}
        generating={aiGenerating === "simulado"}
        canGenerate={canGenerateAi}
        questionMax={pc.simulados.question_max}
        optionMax={pc.simulados.option_max}
        minQuestions={pc.simulados.min_questions}
        minOptions={pc.simulados.min_options}
      />

      <TopQuestionsMaterial
        offered={topOffered}
        setOffered={setTopOffered}
        price={topPrice}
        setPrice={setTopPrice}
        questions={topQuestions}
        setQuestions={setTopQuestions}
        cfg={cfgFor("top_questoes")}
        onGenerate={() => generateMaterialWithAi("top_questoes")}
        generating={aiGenerating === "top_questoes"}
        canGenerate={canGenerateAi}
        questionMax={pc.top_questoes.question_max}
        answerMax={pc.top_questoes.answer_max}
        minQuestions={pc.top_questoes.min_questions}
      />

      <ColinhaMaterial
        offered={colinhaOffered}
        setOffered={setColinhaOffered}
        price={colinhaPrice}
        setPrice={setColinhaPrice}
        bullets={bullets}
        setBullets={setBullets}
        cfg={cfgFor("colinhas")}
        onGenerate={() => generateMaterialWithAi("colinha")}
        generating={aiGenerating === "colinha"}
        canGenerate={canGenerateAi}
        bulletMax={pc.colinhas.bullet_max}
        minBullets={pc.colinhas.min_bullets}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || !allValid} className="font-display">
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
