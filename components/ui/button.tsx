import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-headline font-bold uppercase tracking-widest will-change-transform transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#A4D62F] active:translate-x-0 active:translate-y-0 active:shadow-none",
        primary:
          "bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#A4D62F] active:translate-x-0 active:translate-y-0 active:shadow-none",
        outline:
          "border border-dark-lighter bg-transparent text-light hover:bg-dark-light hover:border-primary hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        ghost:
          "text-muted hover:text-light hover:bg-white/5 hover:scale-[1.01] active:scale-100",
        destructive:
          "bg-red-400/10 text-red-300 border border-red-400/40 hover:bg-red-400 hover:text-dark hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        lime:
          "bg-primary text-dark hover:bg-primary-light hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0 active:scale-100",
        machined:
          "bg-machined text-dark machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-x-0 active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "text-[11px] px-3 py-2 rounded-lg",
        default: "text-[13px] px-5 py-3 rounded-xl",
        lg: "text-sm px-6 py-4 rounded-xl",
        ctaLg: "text-sm px-8 py-4 rounded-xl",
        icon: "w-9 h-9 rounded-lg text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
