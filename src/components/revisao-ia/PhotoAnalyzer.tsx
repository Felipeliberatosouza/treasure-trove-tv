import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Camera, Loader2, X, CheckCircle2, Presentation, BookOpen, FileQuestion, ListChecks, StickyNote, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export interface PhotoResult {
  tipo: "questao" | "tema" | "ilegivel";
  tema: string;
  disciplina: string;
  enunciado: string;
  resposta_final: string;
  solucao: string;
}

/** Reduz a foto para no máximo 1600px em JPEG antes de enviar. */
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function usePhotoAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (file: File, nota: string): Promise<PhotoResult | null> => {
    setError(null);
    setResult(null);
    if (!file.type.startsWith("image/")) {
      setError("Envie uma foto (JPG, PNG ou WEBP).");
      return null;
    }
    setAnalyzing(true);
    try {
      const image = await toDataUrl(file);
      setPreview(image);
      const { data, error: err } = await supabase.functions.invoke("photo-analyze", { body: { image, nota } });
      if (err || !data?.ok) {
        setError(data?.error || "Não foi possível analisar a foto agora.");
        return null;
      }
      setResult(data.result);
      return data.result as PhotoResult;
    } catch {
      setError("Não foi possível ler esta foto. Tente outra.");
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const clear = () => { setResult(null); setError(null); setPreview(null); };
  return { analyzing, preview, result, error, analyze, clear };
}

export function PhotoButton({ disabled, onFile }: { disabled?: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => ref.current?.click()} aria-label="Enviar foto de questão ou tema" title="Enviar foto de questão ou tema">
        <Camera className="h-4 w-4" />
        Foto
      </Button>
    </>
  );
}

export type PhotoFormat = "revisao" | "resumo" | "simulado" | "top_questoes" | "colinha" | "trabalho";

const FORMATS: { key: PhotoFormat; label: string; icon: typeof Presentation }[] = [
  { key: "revisao", label: "Aula com slides", icon: Presentation },
  { key: "simulado", label: "Simulado", icon: FileQuestion },
  { key: "resumo", label: "Resumo", icon: BookOpen },
  { key: "colinha", label: "Colinha", icon: StickyNote },
  { key: "top_questoes", label: "Top Questões", icon: ListChecks },
  { key: "trabalho", label: "Trabalho (Word e Slides)", icon: FileType2 },
];

function MakeChooser({ tema, products, defaultProduct, onMake }: {
  tema: string; products: { key: string; name: string }[]; defaultProduct?: string;
  onMake: (tema: string, fmt: PhotoFormat, product?: string) => void;
}) {
  const [prod, setProd] = useState<string>(defaultProduct || "");
  useEffect(() => { setProd(defaultProduct || ""); }, [defaultProduct]);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">O que você quer gerar sobre <span className="text-primary">{tema}</span>?</p>
      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Para:</span>
          {products.map((p) => (
            <Button key={p.key} type="button" size="sm" variant={prod === p.key ? "default" : "outline"} onClick={() => setProd(p.key)}>
              {p.name}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => (
          <Button key={f.key} type="button" variant="secondary" className="h-auto justify-start py-2.5 text-left"
            onClick={() => onMake(tema, f.key, f.key === "trabalho" ? "trabalhos" : prod || undefined)}>
            <f.icon className="h-4 w-4 shrink-0" /> <span className="whitespace-normal">{f.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function PhotoResultPanel({
  analyzing, preview, result, error, onClose, onMake, products = [], defaultProduct,
}: {
  analyzing: boolean; preview: string | null; result: PhotoResult | null; error: string | null;
  onClose: () => void; onMake: (tema: string, fmt: PhotoFormat, product?: string) => void;
  products?: { key: string; name: string }[]; defaultProduct?: string;
}) {
  if (!analyzing && !result && !error) return null;
  return (
    <div id="photo-result-panel" className="mx-auto mt-6 max-w-3xl scroll-mt-24 text-left">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {preview && <img src={preview} alt="Foto enviada" className="h-16 w-16 rounded-md border border-border object-cover" />}
              <div>
                <p className="font-semibold">
                  {analyzing ? "Analisando a sua foto…" : result?.tipo === "questao" ? "Resolução comentada" : result?.tipo === "tema" ? "Tema identificado" : "Análise da foto"}
                </p>
                {result?.disciplina && <p className="text-xs text-muted-foreground">{result.disciplina}</p>}
              </div>
            </div>
            {!analyzing && (
              <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></Button>
            )}
          </div>

          {analyzing && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo a imagem e preparando a resposta…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {result?.tipo === "questao" && (
            <div className="space-y-4">
              {result.enunciado && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Questão</p>
                  <p className="whitespace-pre-wrap">{result.enunciado}</p>
                </div>
              )}
              {result.resposta_final && (
                <p className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm font-semibold text-primary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Resposta: {result.resposta_final}
                </p>
              )}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.solucao}</ReactMarkdown>
              </div>
              {result.tema && <MakeChooser tema={result.tema} products={products} defaultProduct={defaultProduct} onMake={onMake} />}
              <p className="text-xs text-muted-foreground">Conteúdo gerado com apoio de IA. Confira com seu material.</p>
            </div>
          )}

          {result?.tipo === "tema" && (
            <MakeChooser tema={result.tema} products={products} defaultProduct={defaultProduct} onMake={onMake} />
          )}

          {result?.tipo === "ilegivel" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{result.solucao}</p>
              <p className="text-sm font-medium">Toque em <strong>Foto</strong> para enviar outra imagem.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
