import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — canonical shadcn/ui primitive, restyled to match the project's dark
 * theme (no border by default; the parent surface provides the framing, e.g.
 * the HeroSearch composite). Apply a `border` class via `className` if you
 * want a standalone bordered input.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full bg-transparent text-sm text-light placeholder:text-muted file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
