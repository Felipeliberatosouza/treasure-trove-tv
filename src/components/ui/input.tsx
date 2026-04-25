import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, defaultValue, ...props }, ref) => {
    // For number inputs, render a leading 0 as empty so users don't see
    // a stuck "0" prefix when typing (e.g. typing "5" producing "05").
    // The numeric semantics in onChange handlers remain unchanged because
    // an empty string still parses via parseFloat/parseInt to NaN -> falls
    // back to the existing `|| 0` patterns used across the codebase.
    const sanitizedValue = React.useMemo(() => {
      if (type !== "number") return value;
      if (value === 0 || value === "0") return "";
      return value;
    }, [type, value]);

    const sanitizedDefaultValue = React.useMemo(() => {
      if (type !== "number") return defaultValue;
      if (defaultValue === 0 || defaultValue === "0") return "";
      return defaultValue;
    }, [type, defaultValue]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={sanitizedValue as React.ComponentProps<"input">["value"]}
        defaultValue={sanitizedDefaultValue as React.ComponentProps<"input">["defaultValue"]}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
