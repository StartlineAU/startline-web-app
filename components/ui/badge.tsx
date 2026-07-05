import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-1",
  {
    variants: {
      variant: {
        default:  "bg-white/5 text-muted",
        live:     "bg-primary/10 text-primary",
        pending:  "bg-blue-400/10 text-blue-300",
        draft:    "bg-amber-400/10 text-amber-300",
        rejected: "bg-red-400/10 text-red-300",
        archived: "bg-white/5 text-muted",
        primary:  "bg-primary text-dark",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
