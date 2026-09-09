import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "livedoc:inline-flex livedoc:w-fit livedoc:shrink-0 livedoc:items-center livedoc:justify-center livedoc:gap-1 livedoc:overflow-hidden livedoc:rounded-full livedoc:border livedoc:border-transparent livedoc:px-2 livedoc:py-0.5 livedoc:text-xs livedoc:font-medium livedoc:whitespace-nowrap livedoc:transition-[color,box-shadow] livedoc:focus-visible:border-ring livedoc:focus-visible:ring-[3px] livedoc:focus-visible:ring-ring/50 livedoc:aria-invalid:border-destructive livedoc:aria-invalid:ring-destructive/20 livedoc:dark:aria-invalid:ring-destructive/40 livedoc:[&>svg]:pointer-events-none livedoc:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "livedoc:bg-primary livedoc:text-primary-foreground livedoc:[a&]:hover:bg-primary/90",
        secondary:
          "livedoc:bg-secondary livedoc:text-secondary-foreground livedoc:[a&]:hover:bg-secondary/90",
        destructive:
          "livedoc:bg-destructive livedoc:text-white livedoc:focus-visible:ring-destructive/20 livedoc:dark:bg-destructive/60 livedoc:dark:focus-visible:ring-destructive/40 livedoc:[a&]:hover:bg-destructive/90",
        outline:
          "livedoc:border-border livedoc:text-foreground livedoc:[a&]:hover:bg-accent livedoc:[a&]:hover:text-accent-foreground",
        ghost: "livedoc:[a&]:hover:bg-accent livedoc:[a&]:hover:text-accent-foreground",
        link: "livedoc:text-primary livedoc:underline-offset-4 livedoc:[a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
