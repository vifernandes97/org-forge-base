import { Plus, type LucideIcon } from 'lucide-react';

/** Main create action on phones, floating above the tab bar (desktop keeps the header button). */
export function MobileFab({ label, onClick, icon: Icon = Plus }: { label: string; onClick: () => void; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
