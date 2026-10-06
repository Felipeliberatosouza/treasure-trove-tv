import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Number of decimal places. Default 2. */
  decimals?: number;
  /** Optional fixed prefix shown inside the field, e.g. "R$". */
  prefix?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, decimals = 2, prefix, onBlur, onFocus, className, ...props }, ref) => {
    const formatBR = React.useCallback(
      (n: number) =>
        n.toLocaleString("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      [decimals],
    );

    const numericValue = typeof value === "number" && !isNaN(value) ? value : 0;
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>(
      numericValue === 0 ? "" : formatBR(numericValue),
    );

    // Sync external value changes when not focused.
    React.useEffect(() => {
      if (!focused) {
        setDraft(numericValue === 0 ? "" : formatBR(numericValue));
      }
    }, [numericValue, focused, formatBR]);

    const parseBR = (s: string): number => {
      if (!s) return 0;
      // Remove anything that is not digit, comma or dot, then normalize comma to dot.
      const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const input = (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(prefix && "pl-9", className)}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const sanitized = raw.replace(/[^\d.,]/g, "");
          setDraft(sanitized);
          onValueChange(parseBR(sanitized));
        }}
        onBlur={(e) => {
          setFocused(false);
          const n = parseBR(draft);
          onValueChange(n);
          setDraft(n === 0 ? "" : formatBR(n));
          onBlur?.(e);
        }}
      />
    );
    if (!prefix) return input;
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        {input}
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };