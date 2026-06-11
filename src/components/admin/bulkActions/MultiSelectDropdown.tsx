import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@/components/icons';
import { ChevronDownIcon } from './DropdownSelect';

// ──────────────────────────────────────────────────────────────────
// MultiSelectDropdown
//
// Pop-over multi-select used by AdminBulkActions filters (tariffs,
// statuses, nodes, etc.). Closes on outside click; provides
// select-all / deselect-all helpers. Pure controlled component.
// ──────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: number;
  label: string;
}

export interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: MultiSelectDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const buttonLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= 2) {
      return selected
        .map((id) => options.find((o) => o.value === id)?.label)
        .filter(Boolean)
        .join(', ');
    }
    return t('admin.bulkActions.filters.tariffsSelected', { count: selected.length });
  }, [selected, options, placeholder, t]);

  const handleToggle = (value: number) => {
    if (selected.includes(value)) {
      onChange(selected.filter((id) => id !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'bg-dark-800 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors outline-none',
          open
            ? 'border-accent-500/40 shadow-[0_0_0_3px_rgba(var(--rt-accent-500),0.08)]'
            : 'border-dark-700',
          selected.length > 0 ? 'text-dark-100' : 'text-dark-500',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{buttonLabel}</span>
        <div
          className={cn('text-dark-500 ml-2 shrink-0 transition-transform', open && 'rotate-180')}
        >
          <ChevronDownIcon />
        </div>
      </button>

      {open && (
        <div className="border-dark-700 bg-dark-800 absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border py-1 shadow-2xl">
          <div className="border-dark-700/50 flex items-center gap-1 border-b px-3 py-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-accent-400 hover:text-accent-300 text-xs font-medium transition-colors"
            >
              {t('admin.bulkActions.filters.selectAll')}
            </button>
            <span className="text-dark-600">/</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-dark-400 hover:text-dark-300 text-xs font-medium transition-colors"
            >
              {t('admin.bulkActions.filters.deselectAll')}
            </button>
          </div>

          {options.map((option) => {
            const isChecked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggle(option.value)}
                className="hover:bg-dark-700/50 flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                role="option"
                aria-selected={isChecked}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150',
                    isChecked
                      ? 'border-accent-500 bg-accent-500'
                      : 'border-dark-500 bg-dark-700/60',
                  )}
                >
                  {isChecked && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={cn('text-sm', isChecked ? 'text-dark-100' : 'text-dark-300')}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
