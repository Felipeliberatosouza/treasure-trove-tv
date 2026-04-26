import { Textarea } from "@/components/ui/textarea";
import { SpellCheckedInput, SpellCheckedTextarea } from "@/components/ui/spellchecked-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, DollarSign, FileText, ClipboardList, Trophy, StickyNote, Info, Sparkles, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface QuizQuestion {
  question: string;
  options: string[]; // min 3
  correct_index: number;
}

export interface TopQuestion {
  question: string;
  answer: string;
}

export interface MaterialPriceInfo {
  price: number;
  min_price: number;
  platform_percentage: number;
}

interface PriceHeaderProps {
  label: string;
  offered: boolean;
  setOffered: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  cfg?: MaterialPriceInfo;
}

const PriceHeader = ({ label, offered, setOffered, price, setPrice, cfg }: PriceHeaderProps) => (
  <div className="rounded-md border border-border/60 bg-secondary/40 p-3 mb-3">
    <div className="flex items-center justify-between gap-3 mb-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <Label htmlFor={`offer-${label}`} className="text-xs text-muted-foreground">
          Oferecer este serviço
        </Label>
        <Switch id={`offer-${label}`} checked={offered} onCheckedChange={setOffered} />
      </div>
    </div>
    {offered && (
      <div className="flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          type="number"
          step="0.01"
          min={cfg?.min_price || 0}
          placeholder={cfg ? `Sugerido R$ ${cfg.price.toFixed(2)} · mín. R$ ${cfg.min_price.toFixed(2)}` : "Preço (R$)"}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="bg-background text-xs h-9 max-w-[200px]"
        />
        {cfg && (
          <span className="text-[11px] text-muted-foreground">
            sugerido R$ {cfg.price.toFixed(2)} · você recebe {100 - (cfg.platform_percentage || 0)}%
          </span>
        )}
      </div>
    )}
  </div>
);

interface AiGenerateButtonProps {
  onGenerate: () => Promise<void> | void;
  loading: boolean;
  disabled?: boolean;
  label?: string;
}

const AiGenerateButton = ({ onGenerate, loading, disabled, label = "Gerar com IA" }: AiGenerateButtonProps) => (
  <Button
    type="button"
    size="sm"
    variant="outline"
    onClick={() => onGenerate()}
    disabled={loading || disabled}
    className="gap-1.5 h-8 text-xs"
    title="Gera um rascunho com base no título e descrição da aula. Você pode editar depois."
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
    {loading ? "Gerando..." : label}
  </Button>
);

// ============================================================
// Resumo
// ============================================================
interface ResumoMaterialProps {
  offered: boolean;
  setOffered: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  text: string;
  setText: (v: string) => void;
  cfg?: MaterialPriceInfo;
  textMax?: number;
}

export const ResumoMaterial = ({ offered, setOffered, price, setPrice, text, setText, cfg, textMax = 250 }: ResumoMaterialProps) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <FileText className="h-4 w-4 text-primary" />
      <h4 className="text-sm font-semibold">Resumo</h4>
    </div>
    <PriceHeader label="Resumo" offered={offered} setOffered={setOffered} price={price} setPrice={setPrice} cfg={cfg} />
    {offered && (
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Texto do resumo (gerado automaticamente pela IA a partir da transcrição do vídeo gravado — pode editar livremente)
        </label>
        <SpellCheckedTextarea
          value={text}
          maxLength={textMax}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="bg-secondary text-black placeholder:text-black/50 text-sm"
          placeholder={`Resumo da aula em até ${textMax} caracteres`}
        />
        <p className="text-[11px] text-muted-foreground mt-1 text-right">{text.length}/{textMax}</p>
      </div>
    )}
  </div>
);

// ============================================================
// Simulado (multiple-choice)
// ============================================================
interface SimuladoMaterialProps {
  offered: boolean;
  setOffered: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  questions: QuizQuestion[];
  setQuestions: (q: QuizQuestion[]) => void;
  cfg?: MaterialPriceInfo;
  onGenerate?: () => Promise<void> | void;
  generating?: boolean;
  canGenerate?: boolean;
  questionMax?: number;
  optionMax?: number;
  minQuestions?: number;
  minOptions?: number;
}

export const SimuladoMaterial = ({ offered, setOffered, price, setPrice, questions, setQuestions, cfg, onGenerate, generating, canGenerate, questionMax = 200, optionMax = 200, minQuestions = 5, minOptions = 3 }: SimuladoMaterialProps) => {
  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q,
      ),
    );
  };
  const addOption = (qIdx: number) => {
    setQuestions(questions.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ""] } : q)));
  };
  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        if (q.options.length <= minOptions) return q;
        const newOptions = q.options.filter((_, j) => j !== oIdx);
        const newCorrect = q.correct_index >= newOptions.length ? 0 : q.correct_index >= oIdx ? Math.max(0, q.correct_index - (oIdx <= q.correct_index ? 1 : 0)) : q.correct_index;
        return { ...q, options: newOptions, correct_index: newCorrect };
      }),
    );
  };
  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: Array(minOptions).fill(""), correct_index: 0 }]);
  };
  const removeQuestion = (idx: number) => {
    if (questions.length <= minQuestions) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Simulado</h4>
        {onGenerate && (
          <div className="ml-auto">
            <AiGenerateButton onGenerate={onGenerate} loading={!!generating} disabled={!canGenerate} />
          </div>
        )}
      </div>
      <PriceHeader label="Simulado" offered={offered} setOffered={setOffered} price={price} setPrice={setPrice} cfg={cfg} />
      {offered && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Mínimo de {minQuestions} questões fechadas com pelo menos {minOptions} alternativas. Marque a alternativa correta (gabarito).
            {onGenerate && " Use \"Gerar com IA\" para criar um rascunho a partir do título e descrição."}
          </p>
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-md border border-border/60 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-primary shrink-0 mt-1">Q{qi + 1}</span>
                <div className="flex-1">
                  <SpellCheckedTextarea
                    value={q.question}
                    maxLength={questionMax}
                    onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                    rows={2}
                    className="bg-background text-sm"
                    placeholder="Pergunta"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{q.question.length}/{questionMax}</p>
                </div>
                {questions.length > minQuestions && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeQuestion(qi)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="space-y-1.5 pl-6">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_index === oi}
                      onChange={() => updateQuestion(qi, { correct_index: oi })}
                      className="accent-primary shrink-0"
                      title="Marcar como gabarito"
                    />
                    <SpellCheckedInput
                      value={opt}
                      maxLength={optionMax}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      className="bg-background text-xs h-8"
                      placeholder={`Alternativa ${String.fromCharCode(65 + oi)}`}
                    />
                    {q.options.length > minOptions && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeOption(qi, oi)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => addOption(qi)}>
                  <Plus className="h-3 w-3" /> Adicionar alternativa
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" /> Adicionar questão
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Top Questões (open)
// ============================================================
interface TopQuestionsMaterialProps {
  offered: boolean;
  setOffered: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  questions: TopQuestion[];
  setQuestions: (q: TopQuestion[]) => void;
  cfg?: MaterialPriceInfo;
  onGenerate?: () => Promise<void> | void;
  generating?: boolean;
  canGenerate?: boolean;
  questionMax?: number;
  answerMax?: number;
  minQuestions?: number;
}

export const TopQuestionsMaterial = ({ offered, setOffered, price, setPrice, questions, setQuestions, cfg, onGenerate, generating, canGenerate, questionMax = 300, answerMax = 300, minQuestions = 5 }: TopQuestionsMaterialProps) => {
  const update = (idx: number, patch: Partial<TopQuestion>) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const add = () => setQuestions([...questions, { question: "", answer: "" }]);
  const remove = (idx: number) => {
    if (questions.length <= minQuestions) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Top Questões de Prova</h4>
        {onGenerate && (
          <div className="ml-auto">
            <AiGenerateButton onGenerate={onGenerate} loading={!!generating} disabled={!canGenerate} />
          </div>
        )}
      </div>
      <PriceHeader label="Top Questões" offered={offered} setOffered={setOffered} price={price} setPrice={setPrice} cfg={cfg} />
      {offered && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Mínimo de {minQuestions} perguntas abertas com resposta textual. Pergunta: até {questionMax} caracteres · Resposta: até {answerMax} caracteres.
          </p>
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-md border border-border/60 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-primary shrink-0 mt-1">Q{qi + 1}</span>
                <div className="flex-1 space-y-1.5">
                  <div>
                    <SpellCheckedTextarea
                      value={q.question}
                      maxLength={questionMax}
                      onChange={(e) => update(qi, { question: e.target.value })}
                      rows={2}
                      className="bg-background text-sm"
                      placeholder="Pergunta aberta"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{q.question.length}/{questionMax}</p>
                  </div>
                  <div>
                    <SpellCheckedTextarea
                      value={q.answer}
                      maxLength={answerMax}
                      onChange={(e) => update(qi, { answer: e.target.value })}
                      rows={2}
                      className="bg-background text-sm"
                      placeholder="Resposta textual"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{q.answer.length}/{answerMax}</p>
                  </div>
                </div>
                {questions.length > minQuestions && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(qi)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Colinha (bullets)
// ============================================================
interface ColinhaMaterialProps {
  offered: boolean;
  setOffered: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  bullets: string[];
  setBullets: (b: string[]) => void;
  cfg?: MaterialPriceInfo;
  onGenerate?: () => Promise<void> | void;
  generating?: boolean;
  canGenerate?: boolean;
  bulletMax?: number;
  minBullets?: number;
}

export const ColinhaMaterial = ({ offered, setOffered, price, setPrice, bullets, setBullets, cfg, onGenerate, generating, canGenerate, bulletMax = 100, minBullets = 10 }: ColinhaMaterialProps) => {
  const update = (idx: number, value: string) => setBullets(bullets.map((b, i) => (i === idx ? value : b)));
  const add = () => setBullets([...bullets, ""]);
  const remove = (idx: number) => {
    if (bullets.length <= minBullets) return;
    setBullets(bullets.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Colinha</h4>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger type="button">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs">
              A colinha são bullets curtos que servem para o aluno relembrar rapidamente o conteúdo da aula.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {onGenerate && (
          <div className="ml-auto">
            <AiGenerateButton onGenerate={onGenerate} loading={!!generating} disabled={!canGenerate} />
          </div>
        )}
      </div>
      <PriceHeader label="Colinha" offered={offered} setOffered={setOffered} price={price} setPrice={setPrice} cfg={cfg} />
      {offered && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Mínimo de {minBullets} bullets, até {bulletMax} caracteres cada.</p>
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-6">{i + 1}.</span>
              <SpellCheckedInput
                value={b}
                maxLength={bulletMax}
                onChange={(e) => update(i, e.target.value)}
            className="bg-secondary text-black placeholder:text-black/50 text-xs h-9"
                placeholder={`Bullet ${i + 1}`}
              />
              {bullets.length > minBullets && (
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Adicionar bullet
          </Button>
        </div>
      )}
    </div>
  );
};
