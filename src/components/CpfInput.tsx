import { Input } from "@/components/ui/input";
import { formatCPF, isValidCPF } from "@/lib/cpfValidator";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CpfInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  checkDuplicate?: boolean;
  onDuplicateChange?: (isDuplicate: boolean) => void;
  clearable?: boolean;
  onClear?: () => void;
}

const CpfInput = ({ value, onChange, placeholder = "CPF *", className, checkDuplicate = false, onDuplicateChange, clearable, onClear }: CpfInputProps) => {
  const [touched, setTouched] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [checking, setChecking] = useState(false);
  const cleaned = value.replace(/\D/g, "");
  const isComplete = cleaned.length === 11;
  const isFormatValid = isComplete && isValidCPF(cleaned);
  const isValid = isFormatValid && !isDuplicate;
  const showStatus = cleaned.length > 0;

  useEffect(() => {
    if (!checkDuplicate || !isFormatValid) {
      setIsDuplicate(false);
      onDuplicateChange?.(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_cpf_taken", { _cpf: cleaned });
      if (cancelled) return;
      setChecking(false);
      if (!error && data === true) {
        setIsDuplicate(true);
        onDuplicateChange?.(true);
      } else {
        setIsDuplicate(false);
        onDuplicateChange?.(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [cleaned, isFormatValid, checkDuplicate, onDuplicateChange]);

  return (
    <div>
      <div className="relative">
        <Input
          value={formatCPF(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${className} ${clearable ? "pr-16" : "pr-10"} ${
            isComplete
              ? isValid
                ? "border-green-500 focus-visible:ring-green-500/30"
                : "border-destructive focus-visible:ring-destructive/30"
              : ""
          }`}
          maxLength={14}
        />
        {showStatus && isComplete && !checking && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
        {clearable && cleaned.length > 0 && (
          <button
            type="button"
            aria-label="Limpar CPF"
            onClick={() => onClear?.()}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isComplete && !isFormatValid && (
        <p className="text-xs text-destructive mt-1">CPF inválido</p>
      )}
      {isFormatValid && isDuplicate && (
        <p className="text-xs text-destructive mt-1">CPF já cadastrado na plataforma.</p>
      )}
      {!touched && cleaned.length > 0 && !isComplete && (
        <p className="text-xs text-muted-foreground mt-1">
          {11 - cleaned.length} dígito{11 - cleaned.length !== 1 ? "s" : ""} restante{11 - cleaned.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

export default CpfInput;
