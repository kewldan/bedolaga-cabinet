import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { GripIcon, TrashIcon } from '../icons/LandingIcons';
import { LocalizedInput } from './LocalizedInput';
import type { AdminLandingFeature, LocaleDict, SupportedLocale } from '../../api/landings';

export type FeatureWithId = AdminLandingFeature & { _id: string };

interface SortableFeatureProps {
  feature: FeatureWithId;
  index: number;
  locale: SupportedLocale;
  onUpdateIcon: (index: number, value: string) => void;
  onUpdateLocalized: (index: number, field: 'title' | 'description', value: LocaleDict) => void;
  onRemove: (index: number) => void;
}

export function SortableFeatureItem({
  feature,
  index,
  locale,
  onUpdateIcon,
  onUpdateLocalized,
  onRemove,
}: SortableFeatureProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature._id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3',
        isDragging ? 'border-accent-500/50 bg-dark-700' : 'border-dark-700 bg-dark-800/50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-dark-500 hover:text-dark-300 mt-2 shrink-0 cursor-grab touch-none active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={feature.icon}
            onChange={(e) => onUpdateIcon(index, e.target.value)}
            placeholder={t('admin.landings.featureIcon')}
            className="border-dark-700 bg-dark-800 text-dark-100 focus:border-accent-500 w-16 rounded-lg border px-2 py-1.5 text-center text-sm outline-none"
          />
          <LocalizedInput
            value={feature.title}
            onChange={(v) => onUpdateLocalized(index, 'title', v)}
            locale={locale}
            placeholder={t('admin.landings.featureTitle')}
            className="border-dark-700 bg-dark-800 text-dark-100 focus:border-accent-500 min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
          />
        </div>
        <LocalizedInput
          value={feature.description}
          onChange={(v) => onUpdateLocalized(index, 'description', v)}
          locale={locale}
          placeholder={t('admin.landings.featureDesc')}
          className="border-dark-700 bg-dark-800 text-dark-100 focus:border-accent-500 w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
        />
      </div>
      <button
        onClick={() => onRemove(index)}
        className="text-dark-500 hover:text-error-400 mt-2 shrink-0"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
