import { Input } from "@/components/ui/input";
import { formatCPF, isValidCPF } from "@/lib/cpfValidator";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface CpfInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const CpfInput = ({ value, onChange, placeholder = "CPF *", className }: CpfInputProps) => {
  const [touched, setTouched] = useState(false);
  const cleaned = value.replace(/\D/g, "");
  const isComplete = cleaned.length === 11;
  const isValid = isComplete && isValidCPF(cleaned);
  const showStatus = cleaned.length > 0;

  return (
    <div>
      <div className="relative">
        <Input
          value={formatCPF(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${className} pr-10 ${
            isComplete
              ? isValid
                ? "border-green-500 focus-visible:ring-green-500/30"
                : "border-destructive focus-visible:ring-destructive/30"
              : ""
          }`}
          maxLength={14}
        />
        {showStatus && isComplete && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {touched && isComplete && !isValid && (
        <p className="text-xs text-destructive mt-1">CPF inválido</p>
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
