import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { cn } from '../../lib/utils';
import { formatSettingKey } from './utils';

interface QuickTogglesProps {
  settings: SettingDefinition[];
  onUpdate: (key: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickToggles({ settings, onUpdate, disabled, className }: QuickTogglesProps) {
  const { t } = useTranslation();

  const booleanSettings = settings.filter(
    (s) => s.type === 'bool' && !s.read_only && !s.env_locked,
  );

  if (booleanSettings.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('border-dark-700/40 bg-dark-800/30 rounded-xl border px-3 py-2.5', className)}
    >
      <span className="text-dark-500 mb-2 block text-[10px] font-semibold tracking-wider uppercase">
        {t('admin.settings.quickToggles')}
      </span>
      <div className="flex flex-wrap gap-2">
        {booleanSettings.map((setting) => {
          const isOn = setting.current === true || setting.current === 'true';
          const formattedKey = formatSettingKey(setting.name || setting.key);
          const label = t(`admin.settings.settingNames.${formattedKey}`, formattedKey);

          return (
            <button
              key={setting.key}
              type="button"
              onClick={() => onUpdate(setting.key, isOn ? 'false' : 'true')}
              disabled={disabled}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2.5 text-xs font-medium transition-all',
                isOn
                  ? 'border-success-500/20 bg-success-500/8 text-dark-100'
                  : 'border-dark-600/50 bg-dark-700/20 text-dark-400',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80',
              )}
            >
              {/* Mini toggle indicator */}
              <div
                className={cn(
                  'relative h-3.5 w-6 shrink-0 rounded-full transition-colors',
                  isOn ? 'bg-success-500' : 'bg-dark-600',
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform duration-200',
                    isOn ? 'translate-x-2.5' : 'translate-x-0',
                  )}
                />
              </div>
              <span className="max-w-[120px] truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
