import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border border-[#FF2B3C]/30 bg-[#FF2B3C]/15 text-[#FF6B7A] shadow-[0_0_12px_rgba(255,43,60,0.2)]',
        secondary:
          'border border-white/10 bg-white/5 text-slate-300 backdrop-blur-md',
        outline:
          'border border-slate-700 text-slate-400',
        neon:
          'border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.2)]',
        purple:
          'border border-[#9D4EDD]/30 bg-[#9D4EDD]/15 text-[#C77DFF] shadow-[0_0_12px_rgba(157,78,221,0.2)]',
        success:
          'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
