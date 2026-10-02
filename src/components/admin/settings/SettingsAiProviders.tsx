import { useEffect, useRef, useState } from "react";
import {
  usePlatformSettings,
  type AiModelsConfigSettings,
  type AiVoiceConfigSettings,
} from "@/hooks/usePlatformSettings";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Play, Save, Square } from "lucide-react";
import { toast } from "sonner";

const MODELS = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra", note: "Padrão · máxima qualidade", speed: "Médio", cost: "Alto" },
  { id: "openai/gpt-6-sol", label: "GPT-6 Sol", note: "Equilíbrio entre qualidade e rapidez", speed: "Rápido", cost: "Médio" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", note: "Leve e econômico", speed: "Muito rápido", cost: "Baixo" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", note: "Raciocínio profundo", speed: "Médio", cost: "Alto" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Rápido e didático", speed: "Rápido", cost: "Baixo" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", note: "O mais rápido e barato", speed: "Instantâneo", cost: "Muito baixo" },
];

const AREAS: { key: keyof AiModelsConfigSettings; label: string; desc: string }[] = [
  { key: "revisoes", label: "Revisões (Kits de Revisão)", desc: "Aulas, resumos, simulados, Top Questões e colinhas" },
  { key: "trabalhos", label: "Trabalhos Escolares", desc: "Word, Slides, dicas e perguntas da apresentação" },
  { key: "atendente", label: "Atendente Virtual", desc: "Respostas no WhatsApp e no site" },
  { key: "provas_reais", label: "Provas Reais", desc: "Resolução comentada e correção de redação" },
];

const FEMALE_VOICES = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily" },
];
const MALE_VOICES = [
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam" },
  { id: "cjVigY5qzO86Huf0OWal", label: "Eric" },
];

const DEFAULT_VOICE: Required<AiVoiceConfigSettings> = {
  provider: "openai",
  female_voice_id: FEMALE_VOICES[0].id,
  male_voice_id: MALE_VOICES[0].id,
  stability: 0.5,
  similarity: 0.75,
  style: 0.35,
  speed: 1,
};

const SAMPLE = "Oi! Eu sou a sua professora virtual da Revisão Fácil. Vamos revisar juntos o que mais cai na sua prova?";

/** Gestão de IA: escolha da IA de cada área e da voz do professor(a) virtual. */
const SettingsAiProviders = () => {
  const models = usePlatformSettings("ai_models_config");
  const voice = usePlatformSettings("ai_voice_config");
  const [voiceDraft, setVoiceDraft] = useState<Required<AiVoiceConfigSettings>>(DEFAULT_VOICE);
  const [savingArea, setSavingArea] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (voice.data) setVoiceDraft({ ...DEFAULT_VOICE, ...voice.data });
  }, [voice.data]);

  const current = (area: keyof AiModelsConfigSettings) => models.data?.[area] || MODELS[0].id;

  const pickModel = async (area: keyof AiModelsConfigSettings, id: string) => {
    if (current(area) === id) return;
    setSavingArea(`${area}:${id}`);
    await models.update({ ...(models.data || {}), [area]: id });
    setSavingArea(null);
  };

  const saveVoice = async () => {
    setSavingVoice(true);
    await voice.update(voiceDraft);
    setSavingVoice(false);
  };

  const preview = async (gender: "female" | "male") => {
    if (previewing) {
      audioRef.current?.pause();
      setPreviewing(null);
      return;
    }
    // A prévia usa a configuração salva: salve antes de ouvir.
    if (JSON.stringify({ ...DEFAULT_VOICE, ...(voice.data || {}) }) !== JSON.stringify(voiceDraft)) {
      toast.info("Salve a configuração de voz para ouvir a prévia com estes ajustes.");
      return;
    }
    setPreviewing(gender);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-tts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.session?.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: gender === "male" ? SAMPLE.replace("a sua professora", "o seu professor") : SAMPLE,
          avatar_gender: gender,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Falha na prévia");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(null);
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível tocar a prévia.");
      setPreviewing(null);
    }
  };

  const slider = (key: "stability" | "similarity" | "style" | "speed", label: string, help: string, min = 0, max = 1) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{voiceDraft[key].toFixed(2)}</span>
      </div>
      <Slider min={min} max={max} step={0.05} value={[voiceDraft[key]]} onValueChange={([v]) => setVoiceDraft((d) => ({ ...d, [key]: v }))} />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );

  const eleven = voiceDraft.provider === "elevenlabs";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <h3 className="font-display text-lg font-semibold">IA de cada área</h3>
            <p className="text-sm text-muted-foreground">
              Clique em uma opção para trocar na hora. Conteúdos já gerados continuam salvos; a nova IA vale para os próximos pedidos.
            </p>
          </div>
          {AREAS.map((area) => (
            <div key={area.key} className="space-y-2">
              <div>
                <p className="font-medium">{area.label}</p>
                <p className="text-xs text-muted-foreground">{area.desc}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MODELS.map((m) => {
                  const active = current(area.key) === m.id;
                  const saving = savingArea === `${area.key}:${m.id}`;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickModel(area.key, m.id)}
                      disabled={!!savingArea}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{m.label}</span>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Check className="h-4 w-4 text-primary" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">Velocidade: {m.speed}</Badge>
                        <Badge variant="outline" className="text-[10px]">Custo: {m.cost}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Voz do professor(a) virtual</h3>
            <p className="text-sm text-muted-foreground">
              Com a ElevenLabs, a voz fica humana e a boca do avatar acompanha cada sílaba, assim como a legenda. Se a ElevenLabs falhar, a voz padrão entra sozinha.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { id: "openai", label: "Voz padrão (OpenAI)", note: "Rápida e econômica, sem sincronia labial" },
              { id: "elevenlabs", label: "ElevenLabs + sincronia labial", note: "Voz humana, boca e legenda sincronizadas" },
            ] as const).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setVoiceDraft((d) => ({ ...d, provider: p.id }))}
                className={`rounded-lg border p-3 text-left ${voiceDraft.provider === p.id ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.label}</span>
                  {voiceDraft.provider === p.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
              </button>
            ))}
          </div>

          {eleven && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  { key: "female_voice_id", label: "Voz das professoras", list: FEMALE_VOICES, g: "female" },
                  { key: "male_voice_id", label: "Voz dos professores", list: MALE_VOICES, g: "male" },
                ] as const).map((v) => (
                  <div key={v.key} className="space-y-2">
                    <Label>{v.label}</Label>
                    <div className="flex gap-2">
                      <Select value={voiceDraft[v.key]} onValueChange={(id) => setVoiceDraft((d) => ({ ...d, [v.key]: id }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {v.list.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => preview(v.g)} aria-label="Ouvir prévia">
                        {previewing === v.g ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {slider("stability", "Estabilidade", "Menor = mais expressiva; maior = mais constante.")}
                {slider("similarity", "Clareza", "Quanto a voz se mantém fiel ao timbre original.")}
                {slider("style", "Estilo didático", "Mais alto deixa a entonação mais marcante.")}
                {slider("speed", "Velocidade da fala", "1,00 é o ritmo normal.", 0.7, 1.2)}
              </div>
            </div>
          )}

          <Button onClick={saveVoice} disabled={savingVoice}>
            {savingVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar configuração de voz
          </Button>
          <p className="text-xs text-muted-foreground">
            As aulas já narradas ganham a nova voz automaticamente na próxima vez que forem abertas (uma única vez por aula; depois ficam guardadas).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsAiProviders;
