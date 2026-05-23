import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface SelectionChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Whether this chip is currently selected/active. */
  selected?: boolean;
  /** Render as a child element (e.g. `<label>`) instead of `<button>`. */
  asChild?: boolean;
}

/**
 * Reusable selection chip that automatically consumes the CSS branding
 * variables injected by `DynamicBranding`:
 *   --selection-btn-bg
 *   --selection-btn-text
 *   --selection-btn-active-bg
 *   --selection-btn-active-text
 *
 * Usage:
 *   <SelectionChip selected={isSelected} onClick={handleToggle}>
 *     Label
 *   </SelectionChip>
 *
 * With asChild (e.g. inside a <label>):
 *   <SelectionChip asChild selected={checked}>
 *     <label className="...">
 *       <Checkbox checked={checked} />
 *       Text
 *     </label>
 *   </SelectionChip>
 */
const SelectionChip = React.forwardRef<HTMLButtonElement, SelectionChipProps>(
  ({ selected, asChild, className, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        disabled={disabled}
        aria-pressed={asChild ? undefined : selected}
        data-selected={selected ? "true" : undefined}
        className={cn(
          "selection-chip",
          selected && "is-selected",
          disabled && "opacity-40 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

SelectionChip.displayName = "SelectionChip";

export { SelectionChip };
export type { SelectionChipProps };
