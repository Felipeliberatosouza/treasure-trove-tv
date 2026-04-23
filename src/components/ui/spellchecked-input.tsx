import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectLanguage } from "@/utils/detectLanguage";

/**
 * Inputs com corretor ortográfico/gramatical nativo do navegador.
 * - `spellCheck` ativado → o navegador sublinha em vermelho palavras incorretas.
 * - `lang` é detectado automaticamente a partir do texto digitado (PT-BR, EN, ES),
 *   permitindo que o navegador escolha o dicionário correto.
 * - O usuário pode forçar um idioma com a prop `lang`.
 *
 * Observação: a correção visual depende do dicionário do navegador/SO do usuário.
 */

function useDetectedLang(value: unknown, override?: string) {
  const text = typeof value === "string" ? value : "";
  return React.useMemo(() => override || detectLanguage(text), [text, override]);
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
