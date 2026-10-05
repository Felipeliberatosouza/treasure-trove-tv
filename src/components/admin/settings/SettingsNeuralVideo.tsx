import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Film, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

type SlideStatus = { slide: number; status: string; error?: string | null };
const STATUS_PT: Record<string, string> = { processing: "Renderizando", ready: "Pronto", failed: "Falhou" };

const extractId = (value: string) => value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? "";

/**
 * Vídeos especiais: renderiza um professor real falando com a boca perfeitamente
 * sincronizada, quadro a quadro, a partir de um retrato e da narração da aula.
 * As demais aulas continuam com o professor ilustrado.
 */
const SettingsNeuralVideo = () => {
  const [lesson, setLesson] = useState("");
  const [portrait, setPortrait] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slides, setSlides] = useState<SlideStatus[]>([]);
  const [conn, setConn] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("neural-avatar-render", { body: { action: "test" } });
      if (error) throw error;
      if (data?.ok) {
        const credits = data.remaining != null ? ` Créditos restantes no D-ID: ${data.remaining}.` : "";
        setConn({ ok: true, msg: `Conexão com o D-ID funcionando.${credits}` });
      } else setConn({ ok: false, msg: data?.error ?? "Não foi possível validar a chave." });
    } catch {
      setConn({ ok: false, msg: "Não foi possível validar a conexão agora." });
    } finally {
      setTesting(false);
    }
  };


  const call = async (action: "start" | "poll") => {
    const canonical_id = extractId(lesson);
    if (!canonical_id) return toast.error("Cole o link ou o código da aula.");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("neural-avatar-render", {
        body: { action, canonical_id, portrait_url: portrait || undefined },
      });
      if (error) throw error;
      if (data?.error) return toast.error(data.error);
      if (action === "start") {
        if (data.errors?.length) toast.error(data.errors[0]);
        if (data.started) toast.success(`${data.started} slide(s) enviados para renderização. Leva alguns minutos.`);
        await call("poll");
      } else {
        setSlides(data.slides ?? []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na renderização.");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    const path = `neural-portraits/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("platform-assets").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) return toast.error("Não foi possível enviar o retrato.");
    setPortrait(supabase.storage.from("platform-assets").getPublicUrl(path).data.publicUrl);
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold"><Film className="h-4 w-4" /> Vídeos especiais com professor real</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Renderização neural quadro a quadro: a boca do professor real acompanha exatamente a narração. Use apenas em aulas especiais —
            cada minuto tem custo no provedor de vídeo e leva alguns minutos para ficar pronto. As outras aulas continuam com o professor ilustrado.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>Conexão com o D-ID</Label>
          <p className="text-xs text-muted-foreground">
            A chave fica guardada com segurança no servidor e nunca aparece nesta tela. Valide a conexão antes de renderizar.
          </p>
          <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Validar conexão
          </Button>
          {conn && (
            <p className={`text-xs ${conn.ok ? "text-primary" : "text-destructive"}`}>{conn.msg}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Link ou código da aula</Label>
          <Input value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="https://revisaofacil.com.br/conteudo-ia/..." />
        </div>
        <div className="space-y-1.5">
          <Label>Retrato do professor (rosto de frente, boca fechada, boa luz)</Label>
          <div className="flex gap-2">
            <Input value={portrait} onChange={(e) => setPortrait(e.target.value)} placeholder="https://..." />
            <Button variant="outline" asChild disabled={uploading}>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </Button>
          </div>
          {portrait && <img src={portrait} alt="Retrato escolhido" className="mt-2 h-24 w-24 rounded-lg object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => call("start")} disabled={busy || !portrait || !conn?.ok}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />} Renderizar aula
          </Button>
          <Button variant="outline" onClick={() => call("poll")} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" /> Ver andamento
          </Button>
        </div>
        {slides.length > 0 && (
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {slides.sort((a, b) => a.slide - b.slide).map((s) => (
              <li key={s.slide} className="rounded bg-secondary px-2 py-1">
                Slide {s.slide + 1}: <strong>{STATUS_PT[s.status] ?? s.status}</strong>{s.error ? ` — ${s.error}` : ""}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsNeuralVideo;
