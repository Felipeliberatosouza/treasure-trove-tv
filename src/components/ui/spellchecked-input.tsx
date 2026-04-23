import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectLanguage, type SpellLang } from "@/utils/detectLanguage";

/**
 * Inputs com corretor ortográfico/gramatical nativo do navegador.
 * - `spellCheck` ativado → o navegador sublinha em vermelho palavras incorretas.
 * - `lang` é detectado automaticamente a partir do texto digitado (PT-BR, EN, ES),
 *   permitindo que o navegador escolha o dicionário correto.
 * - O usuário pode forçar um idioma com a prop `lang`.
 * - A detecção é debounced (padrão 600ms) para evitar troca de dicionário a cada
 *   tecla — o `lang` só é reavaliado após uma pausa na digitação.
 *
 * Observação: a correção visual depende do dicionário do navegador/SO do usuário.
 */

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_LANG: SpellLang = "pt-BR";

function useDetectedLang(value: unknown, override?: string, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const text = typeof value === "string" ? value : "";

  // If the caller forces a lang, skip detection entirely (no debounce needed).
  const [debouncedLang, setDebouncedLang] = React.useState<string>(() =>
    override || (text ? detectLanguage(text) : DEFAULT_LANG),
  );

  React.useEffect(() => {
    if (override) {
      setDebouncedLang(override);
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedLang(detectLanguage(text));
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [text, override, debounceMs]);

  return debouncedLang;
}

export const SpellCheckedInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ lang, spellCheck, value, ...props }, ref) => {
  const detected = useDetectedLang(value, lang);
  return (
    <Input
      ref={ref}
      value={value}
      lang={detected}
      spellCheck={spellCheck ?? true}
      autoCorrect="on"
      {...props}
    />
  );
});
SpellCheckedInput.displayName = "SpellCheckedInput";

export const SpellCheckedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>(({ lang, spellCheck, value, ...props }, ref) => {
  const detected = useDetectedLang(value, lang);
  return (
    <Textarea
      ref={ref}
      value={value}
      lang={detected}
      spellCheck={spellCheck ?? true}
      autoCorrect="on"
      {...props}
    />
  );
});
SpellCheckedTextarea.displayName = "SpellCheckedTextarea";
