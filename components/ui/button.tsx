import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-headline font-bold uppercase tracking-widest will-change-transform transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-gray-900 text-white hover:bg-gray-800 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        primary:
          "bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-[rgb(31,31,31)] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        outline:
          "border border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:text-gray-900 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        ghost:
          "text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:scale-[1.01] active:scale-100",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        lime:
          "border border-lime-400 bg-lime-50 text-lime-700 hover:bg-lime-100 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none",
        link: "text-lime-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "text-[11px] px-3 py-2 rounded-lg",
        default: "text-[13px] px-5 py-3 rounded-xl",
        lg: "text-sm px-6 py-4 rounded-xl",
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
