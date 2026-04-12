import { Input } from "@/components/ui/input";
import { formatCPF, isValidCPF } from "@/lib/cpfValidator";
import { useState } from "react";

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

  return (
    <div>
      <Input
        value={formatCPF(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className={className}
        maxLength={14}
      />
      {touched && isComplete && !isValid && (
        <p className="text-xs text-destructive mt-1">CPF inválido</p>
      )}
    </div>
  );
};

export default CpfInput;
