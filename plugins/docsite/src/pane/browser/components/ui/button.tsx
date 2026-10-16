import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "docsite:inline-flex docsite:shrink-0 docsite:items-center docsite:justify-center docsite:gap-2 docsite:rounded-md docsite:text-sm docsite:font-medium docsite:whitespace-nowrap docsite:transition-all docsite:outline-none docsite:focus-visible:border-ring docsite:focus-visible:ring-[3px] docsite:focus-visible:ring-ring/50 docsite:disabled:pointer-events-none docsite:disabled:opacity-50 docsite:aria-invalid:border-destructive docsite:aria-invalid:ring-destructive/20 docsite:dark:aria-invalid:ring-destructive/40 docsite:[&_svg]:pointer-events-none docsite:[&_svg]:shrink-0 docsite:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "docsite:bg-primary docsite:text-primary-foreground docsite:hover:bg-primary/90",
        destructive:
          "docsite:bg-destructive docsite:text-white docsite:hover:bg-destructive/90 docsite:focus-visible:ring-destructive/20 docsite:dark:bg-destructive/60 docsite:dark:focus-visible:ring-destructive/40",
        outline:
          "docsite:border docsite:bg-background docsite:shadow-xs docsite:hover:bg-accent docsite:hover:text-accent-foreground docsite:dark:border-input docsite:dark:bg-input/30 docsite:dark:hover:bg-input/50",
        secondary:
          "docsite:bg-secondary docsite:text-secondary-foreground docsite:hover:bg-secondary/80",
        ghost:
          "docsite:hover:bg-accent docsite:hover:text-accent-foreground docsite:dark:hover:bg-accent/50",
        link: "docsite:text-primary docsite:underline-offset-4 docsite:hover:underline",
      },
      size: {
        default: "docsite:h-9 docsite:px-4 docsite:py-2 docsite:has-[>svg]:px-3",
        xs: "docsite:h-6 docsite:gap-1 docsite:rounded-md docsite:px-2 docsite:text-xs docsite:has-[>svg]:px-1.5 docsite:[&_svg:not([class*='size-'])]:size-3",
        sm: "docsite:h-8 docsite:gap-1.5 docsite:rounded-md docsite:px-3 docsite:has-[>svg]:px-2.5",
        lg: "docsite:h-10 docsite:rounded-md docsite:px-6 docsite:has-[>svg]:px-4",
        icon: "docsite:size-9",
        "icon-xs": "docsite:size-6 docsite:rounded-md docsite:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "docsite:size-8",
        "icon-lg": "docsite:size-10",
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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
