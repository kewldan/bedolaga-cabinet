import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────────
// DropdownSelect — small native-<select> wrapper used both by the
// AdminBulkActions filter row and the ActionModal's tariff/promo
// picker. Shared primitive so both consumers stay on the same
// chrome (border, focus ring, chevron).
// ──────────────────────────────────────────────────────────────────

// Re-exported so the sibling FloatingActionBar / MultiSelectDropdown keep
// importing the chevron from this module while the glyph itself now comes
// from the central Phosphor barrel instead of a hand-written SVG.
export { ChevronDownIcon };

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownSelectProps {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  className?: string;
}

export function DropdownSelect({ value, options, onChange, className }: DropdownSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-dark-700 bg-dark-800 text-dark-100 focus:border-accent-500/40 w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm transition-colors outline-none focus:shadow-[0_0_0_3px_rgba(var(--rt-accent-500),0.08)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="text-dark-500 pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
        <ChevronDownIcon className="h-4 w-4" />
      </div>
    </div>
  );
}
