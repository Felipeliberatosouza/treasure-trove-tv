import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Phone, CheckCircle2, XCircle } from "lucide-react";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function getDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = getDigits(phone);
  return digits.length === 11 && digits[2] === "9";
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className = "", placeholder = "Celular *", required }, ref) => {
    const [touched, setTouched] = useState(false);
    const digits = getDigits(value);
    const isComplete = digits.length === 11;
    const isValid = isValidBrazilianPhone(value);
    const showStatus = digits.length > 0 && isComplete;

    return (
      <div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={ref}
            type="tel"
            inputMode="numeric"
            placeholder={placeholder}
            value={formatPhone(value)}
            onChange={(e) => onChange(getDigits(e.target.value))}
            onBlur={() => setTouched(true)}
            className={`pl-10 pr-10 bg-secondary border-border ${
              isComplete
                ? isValid
                  ? "border-green-500 focus-visible:ring-green-500/30"
                  : "border-destructive focus-visible:ring-destructive/30"
                : ""
            } ${className}`}
            maxLength={16}
            required={required}
          />
          {showStatus && (
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
          <p className="text-xs text-destructive mt-1">
            Número inválido. O celular deve começar com 9 após o DDD.
          </p>
        )}
        {!touched && digits.length > 0 && !isComplete && (
          <p className="text-xs text-muted-foreground mt-1">
            {11 - digits.length} dígito{11 - digits.length !== 1 ? "s" : ""} restante{11 - digits.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;