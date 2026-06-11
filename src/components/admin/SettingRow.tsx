import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { StarIcon, LockIcon, RefreshIcon } from './icons';
import { SettingInput } from './SettingInput';
import { Toggle } from './Toggle';
import { formatSettingKey, stripHtml } from './utils';

interface SettingRowProps {
  setting: SettingDefinition;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onUpdate: (value: string) => void;
  onReset: () => void;
  isUpdating?: boolean;
  isResetting?: boolean;
}

export function SettingRow({
  setting,
  isFavorite,
  onToggleFavorite,
  onUpdate,
  onReset,
  isUpdating,
  isResetting,
}: SettingRowProps) {
  const { t } = useTranslation();

  const formattedKey = formatSettingKey(setting.name || setting.key);
  const displayName = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);
  const description = setting.hint?.description ? stripHtml(setting.hint.description) : null;

  // env-locked keys behave like read-only here: the .env value shadows the DB,
  // so editing would be silently discarded by the bot. Show the value, no input.
  const locked = setting.read_only || setting.env_locked;

  // Check if this is a long/complex value
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
      key.includes('_packages')
    );
  })();

  return (
    <div className="group border-dark-700/40 bg-dark-800/40 hover:border-dark-600/60 hover:bg-dark-800/60 rounded-2xl border p-4 transition-all sm:p-5">
      {/* Header row - name, badges, favorite */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-dark-100 text-base font-semibold">{displayName}</h3>
            {setting.has_override && (
              <span className="bg-warning-500/20 text-warning-400 rounded-full px-2 py-0.5 text-xs font-medium">
                {t('admin.settings.modified')}
              </span>
            )}
            {setting.read_only && (
              <span className="bg-dark-600/50 text-dark-400 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                <LockIcon />
                {t('admin.settings.readOnly')}
              </span>
            )}
            {setting.env_locked && !setting.read_only && (
              <span
                className="bg-dark-600/50 text-dark-400 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                title={t('admin.settings.envLockedHint')}
              >
                <LockIcon />
                {t('admin.settings.envLocked')}
              </span>
            )}
          </div>
          {description && (
            <p className="text-dark-400 mt-1.5 text-sm leading-relaxed">{description}</p>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={onToggleFavorite}
          className={`shrink-0 rounded-xl p-2 transition-all ${
            isFavorite
              ? 'bg-warning-500/15 text-warning-400 hover:bg-warning-500/25'
              : 'text-dark-500 hover:bg-dark-700/50 hover:text-warning-400 opacity-0 group-hover:opacity-100'
          }`}
          title={
            isFavorite
              ? t('admin.settings.removeFromFavorites')
              : t('admin.settings.addToFavorites')
          }
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>

      {/* Setting key (muted) */}
      <div className="mb-3">
        <code className="bg-dark-900/50 text-dark-500 rounded px-2 py-1 font-mono text-xs">
          {setting.key}
        </code>
      </div>

      {/* Control section */}
      <div
        className={`${isLongValue ? '' : 'flex items-center justify-between gap-3'} border-dark-700/30 border-t pt-3`}
      >
        {locked ? (
          // Read-only / env-locked display
          <div className="flex flex-col gap-1.5">
            <div className="bg-dark-700/30 text-dark-300 flex items-center gap-2 rounded-lg px-4 py-2.5">
              <span className="font-mono text-sm break-all">{String(setting.current ?? '-')}</span>
            </div>
            {setting.env_locked && !setting.read_only && (
              <p className="text-dark-500 text-xs leading-relaxed">
                {t('admin.settings.envLockedHint')}
              </p>
            )}
          </div>
        ) : setting.type === 'bool' ? (
          // Boolean toggle
          <div className="flex items-center justify-between gap-3">
            <span className="text-dark-400 text-sm">
              {setting.current === true || setting.current === 'true'
                ? t('admin.settings.enabled')
                : t('admin.settings.disabled')}
            </span>
            <div className="flex items-center gap-2">
              <Toggle
                checked={setting.current === true || setting.current === 'true'}
                onChange={() =>
                  onUpdate(
                    setting.current === true || setting.current === 'true' ? 'false' : 'true',
                  )
                }
                disabled={isUpdating}
              />
              {/* Reset button for boolean */}
              {setting.has_override && (
                <button
                  onClick={onReset}
                  disabled={isResetting}
                  className="text-dark-400 hover:bg-dark-700 hover:text-dark-200 rounded-lg p-2 transition-colors disabled:opacity-50"
                  title={t('admin.settings.reset')}
                >
                  <RefreshIcon />
                </button>
              )}
            </div>
          </div>
        ) : (
          // Input field
          <div
            className={`${isLongValue ? 'w-full' : 'flex flex-1 items-center justify-end gap-2'}`}
          >
            <SettingInput setting={setting} onUpdate={onUpdate} disabled={isUpdating} />
            {/* Reset button for non-long values */}
            {!isLongValue && setting.has_override && (
              <button
                onClick={onReset}
                disabled={isResetting}
                className="text-dark-400 hover:bg-dark-700 hover:text-dark-200 shrink-0 rounded-lg p-2 transition-colors disabled:opacity-50"
                title={t('admin.settings.reset')}
              >
                <RefreshIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reset button for long values - shown below */}
      {isLongValue && setting.has_override && !locked && setting.type !== 'bool' && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onReset}
            disabled={isResetting}
            className="text-dark-400 hover:bg-dark-700 hover:text-dark-200 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            title={t('admin.settings.reset')}
          >
            <RefreshIcon />
            <span>{t('admin.settings.reset')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
