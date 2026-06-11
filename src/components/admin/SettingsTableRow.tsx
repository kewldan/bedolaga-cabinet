import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { cn } from '../../lib/utils';
import { StarIcon, LockIcon, RefreshIcon } from './icons';
import { SettingInput } from './SettingInput';
import { Toggle } from './Toggle';
import { formatSettingKey, stripHtml } from './utils';

interface SettingsTableRowProps {
  setting: SettingDefinition;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onUpdate: (value: string) => void;
  onReset: () => void;
  isUpdating?: boolean;
  isResetting?: boolean;
  isLast?: boolean;
  className?: string;
}

export function SettingsTableRow({
  setting,
  isFavorite,
  onToggleFavorite,
  onUpdate,
  onReset,
  isUpdating,
  isResetting,
  isLast,
  className,
}: SettingsTableRowProps) {
  const { t } = useTranslation();

  const formattedKey = formatSettingKey(setting.name || setting.key);
  const displayName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  const description = setting.hint?.description ? stripHtml(setting.hint.description) : null;
  const isModified = setting.has_override;
  const isBool = setting.type === 'bool';
  const boolChecked = setting.current === true || setting.current === 'true';
  // env-locked keys are pinned in .env and shadow the DB — show value, no input.
  const locked = setting.read_only || setting.env_locked;

  const isLongValue = (() => {
    const val = String(setting.current ?? '');
    const key = setting.key.toLowerCase();
    return (
      val.length > 50 ||
      val.includes('\n') ||
      val.startsWith('[') ||
      val.startsWith('{') ||
      key.includes('_items') ||
      key.includes('_config') ||
      key.includes('_keywords') ||
      key.includes('_template') ||
      key.includes('_packages') ||
      key.includes('_list') ||
      key.includes('_json') ||
      key.includes('_periods') ||
      key.includes('_discounts')
    );
  })();

  return (
    <div
      className={cn(
        'group hover:bg-dark-800/40 px-4 py-3 transition-colors',
        isModified && 'bg-warning-500/2',
        !isLast && 'border-dark-700/30 border-b',
        className,
      )}
    >
      <div
        className={cn(
          isLongValue ? 'space-y-3' : 'flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4',
        )}
      >
        {/* Left side: name, badges, key */}
        <div className={cn('min-w-0', !isLongValue && 'lg:flex-1')}>
          {/* Name + badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-dark-100 text-[13px] font-medium">{displayName}</span>

            {isModified && (
              <span className="bg-warning-500/20 text-warning-400 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium">
                {t('admin.settings.modified')}
              </span>
            )}

            {setting.has_override && !locked && (
              <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] leading-none font-medium text-sky-400">
                {t('admin.settings.badgeDb')}
              </span>
            )}

            {setting.env_locked && (
              <span
                className="bg-warning-500/15 text-warning-400 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium"
                title={t('admin.settings.envLockedHint')}
              >
                {t('admin.settings.badgeEnv')}
                <LockIcon className="h-3 w-3" />
              </span>
            )}
          </div>

          {/* Setting key */}
          <div className="mt-0.5">
            <code className="text-dark-500 font-mono text-[11px]">{setting.key}</code>
          </div>

          {/* Description for long values */}
          {isLongValue && description && (
            <p className="text-dark-400 mt-1 text-xs leading-relaxed">{description}</p>
          )}
        </div>

        {/* Right side: control + action buttons */}
        <div
          className={cn(
            'flex items-center gap-2',
            isLongValue ? 'w-full' : 'max-lg:self-end lg:shrink-0',
          )}
        >
          {locked ? (
            <span className="bg-dark-700/30 text-dark-400 max-w-[240px] truncate rounded px-3 py-1.5 font-mono text-xs">
              {isBool
                ? boolChecked
                  ? t('admin.settings.enabled')
                  : t('admin.settings.disabled')
                : String(setting.current ?? '-')}
            </span>
          ) : isBool ? (
            <Toggle
              checked={boolChecked}
              onChange={() => onUpdate(boolChecked ? 'false' : 'true')}
              disabled={isUpdating}
              aria-label={displayName}
            />
          ) : (
            <div className={cn(isLongValue && 'w-full')}>
              <SettingInput setting={setting} onUpdate={onUpdate} disabled={isUpdating} />
            </div>
          )}

          {/* Reset button -- hover-reveal when has_override */}
          {isModified && !locked && (
            <button
              onClick={onReset}
              disabled={isResetting}
              className="text-dark-500 hover:bg-dark-700 hover:text-dark-200 shrink-0 rounded-lg p-1.5 opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-50 max-lg:opacity-100 [@media(hover:none)]:opacity-100"
              title={t('admin.settings.reset')}
              aria-label={t('admin.settings.reset')}
            >
              <RefreshIcon />
            </button>
          )}

          {/* Favorite button -- visible if favorited, hover-reveal otherwise */}
          <button
            onClick={onToggleFavorite}
            className={cn(
              'shrink-0 rounded-lg p-1.5 transition-all',
              isFavorite
                ? 'text-warning-400 hover:bg-warning-500/15'
                : 'text-dark-500 hover:bg-dark-700/50 hover:text-warning-400 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100 [@media(hover:none)]:opacity-100',
            )}
            title={
              isFavorite
                ? t('admin.settings.removeFromFavorites')
                : t('admin.settings.addToFavorites')
            }
            aria-label={
              isFavorite
                ? t('admin.settings.removeFromFavorites')
                : t('admin.settings.addToFavorites')
            }
          >
            <StarIcon filled={isFavorite} />
          </button>
        </div>
      </div>
    </div>
  );
}
