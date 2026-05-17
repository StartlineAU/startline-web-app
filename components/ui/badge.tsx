import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-1",
  {
    variants: {
      variant: {
        default:  "bg-gray-100 text-gray-500",
        live:     "bg-lime-50 text-lime-700",
        pending:  "bg-blue-50 text-blue-600",
        draft:    "bg-gray-100 text-gray-500",
        rejected: "bg-red-50 text-red-600",
        archived: "bg-gray-100 text-gray-400",
        primary:  "bg-lime-500 text-white",
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
