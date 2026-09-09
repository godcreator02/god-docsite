import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "livedoc:inline-flex livedoc:shrink-0 livedoc:items-center livedoc:justify-center livedoc:gap-2 livedoc:rounded-md livedoc:text-sm livedoc:font-medium livedoc:whitespace-nowrap livedoc:transition-all livedoc:outline-none livedoc:focus-visible:border-ring livedoc:focus-visible:ring-[3px] livedoc:focus-visible:ring-ring/50 livedoc:disabled:pointer-events-none livedoc:disabled:opacity-50 livedoc:aria-invalid:border-destructive livedoc:aria-invalid:ring-destructive/20 livedoc:dark:aria-invalid:ring-destructive/40 livedoc:[&_svg]:pointer-events-none livedoc:[&_svg]:shrink-0 livedoc:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "livedoc:bg-primary livedoc:text-primary-foreground livedoc:hover:bg-primary/90",
        destructive:
          "livedoc:bg-destructive livedoc:text-white livedoc:hover:bg-destructive/90 livedoc:focus-visible:ring-destructive/20 livedoc:dark:bg-destructive/60 livedoc:dark:focus-visible:ring-destructive/40",
        outline:
          "livedoc:border livedoc:bg-background livedoc:shadow-xs livedoc:hover:bg-accent livedoc:hover:text-accent-foreground livedoc:dark:border-input livedoc:dark:bg-input/30 livedoc:dark:hover:bg-input/50",
        secondary:
          "livedoc:bg-secondary livedoc:text-secondary-foreground livedoc:hover:bg-secondary/80",
        ghost:
          "livedoc:hover:bg-accent livedoc:hover:text-accent-foreground livedoc:dark:hover:bg-accent/50",
        link: "livedoc:text-primary livedoc:underline-offset-4 livedoc:hover:underline",
      },
      size: {
        default: "livedoc:h-9 livedoc:px-4 livedoc:py-2 livedoc:has-[>svg]:px-3",
        xs: "livedoc:h-6 livedoc:gap-1 livedoc:rounded-md livedoc:px-2 livedoc:text-xs livedoc:has-[>svg]:px-1.5 livedoc:[&_svg:not([class*=size-])]:size-3",
        sm: "livedoc:h-8 livedoc:gap-1.5 livedoc:rounded-md livedoc:px-3 livedoc:has-[>svg]:px-2.5",
        lg: "livedoc:h-10 livedoc:rounded-md livedoc:px-6 livedoc:has-[>svg]:px-4",
        icon: "livedoc:size-9",
        "icon-xs": "livedoc:size-6 livedoc:rounded-md livedoc:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "livedoc:size-8",
        "icon-lg": "livedoc:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
