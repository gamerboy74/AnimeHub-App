import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-[#FF2B3C] text-white shadow-lg shadow-[#FF2B3C]/25 hover:bg-[#FF4252] hover:shadow-[#FF2B3C]/40',
        glow:
          'bg-gradient-to-r from-[#FF2B3C] to-[#E02434] text-white shadow-[0_0_25px_rgba(255,43,60,0.5)] hover:shadow-[0_0_35px_rgba(255,43,60,0.7)] hover:scale-[1.02]',
        secondary:
          'bg-white/10 text-white hover:bg-white/15 border border-white/10 backdrop-blur-md',
        outline:
          'border border-white/15 bg-transparent hover:bg-white/5 hover:border-white/30 text-white',
        ghost:
          'hover:bg-white/10 text-slate-300 hover:text-white',
        cyber:
          'bg-gradient-to-r from-[#FF2B3C] via-[#9D4EDD] to-[#00F0FF] text-white p-[1px] rounded-xl hover:shadow-[0_0_30px_rgba(255,43,60,0.4)]',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3.5 text-xs',
        lg: 'h-14 rounded-2xl px-8 text-base tracking-wide',
        icon: 'size-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
