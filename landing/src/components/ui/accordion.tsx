import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionContextValue {
  openItem: string | null
  toggleItem: (id: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export function Accordion({
  children,
  className,
  defaultOpen = null,
}: {
  children: React.ReactNode
  className?: string
  defaultOpen?: string | null
}) {
  const [openItem, setOpenItem] = React.useState<string | null>(defaultOpen)

  const toggleItem = React.useCallback((id: string) => {
    setOpenItem((prev) => (prev === id ? null : id))
  }, [])

  return (
    <AccordionContext.Provider value={{ openItem, toggleItem }}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-accordion-item={id}
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-[#0E1117]/70 backdrop-blur-md transition-all duration-300 hover:border-white/20',
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // @ts-expect-error pass id to children
          return React.cloneElement(child, { id })
        }
        return child
      })}
    </div>
  )
}

export function AccordionTrigger({
  id,
  children,
  className,
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(AccordionContext)
  const isOpen = id ? context?.openItem === id : false

  return (
    <button
      type="button"
      onClick={() => id && context?.toggleItem(id)}
      className={cn(
        'flex w-full items-center justify-between p-5 text-left font-semibold text-white transition-all hover:text-[#FF4252]',
        className
      )}
    >
      <span>{children}</span>
      <ChevronDown
        className={cn(
          'size-5 text-slate-400 transition-transform duration-300',
          isOpen && 'rotate-180 text-[#FF2B3C]'
        )}
      />
    </button>
  )
}

export function AccordionContent({
  id,
  children,
  className,
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(AccordionContext)
  const isOpen = id ? context?.openItem === id : false

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'px-5 pb-5 pt-0 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4 animate-in fade-in-50 duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}
