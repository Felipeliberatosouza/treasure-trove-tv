import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";

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
    return (
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          value={formatPhone(value)}
          onChange={(e) => onChange(getDigits(e.target.value))}
          className={`pl-10 bg-secondary border-border ${className}`}
          maxLength={16}
          required={required}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
