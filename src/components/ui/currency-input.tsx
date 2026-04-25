import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Number of decimal places. Default 2. */
  decimals?: number;
}

/**
 * Brazilian-style currency input.
 * - Displays values with comma as decimal separator and 2 fixed decimal places when blurred.
 * - While focused, lets the user type freely (digits, comma or dot).
 * - Emits a JS number via onValueChange.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, decimals = 2, onBlur, onFocus, className, ...props }, ref) => {
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

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow only digits, comma and dot during typing.
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
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };