import { forwardRef, useRef, useEffect, useState } from "react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  max?: string;
  placeholder?: string;
}

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className = "", max, placeholder }, forwardedRef) => {
    const localRef = useRef<HTMLInputElement>(null);
    const inputRef = (forwardedRef as React.MutableRefObject<HTMLInputElement | null>) || localRef;
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      // Se já tem valor ou o usuário já interagiu, mantém como date
      if (value || hasInteracted) {
        el.type = "date";
      } else {
        el.type = "text";
      }
    }, [value, hasInteracted, inputRef]);

    return (
      <input
        ref={inputRef}
        type={value || hasInteracted ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setHasInteracted(true);
          e.target.type = "date";
        }}
        onBlur={(e) => {
          if (!e.target.value) {
            e.target.type = "text";
            setHasInteracted(false);
          }
        }}
        placeholder={placeholder}
        className={className}
        max={max}
      />
    );
  }
);

DateInput.displayName = "DateInput";

export default DateInput;
