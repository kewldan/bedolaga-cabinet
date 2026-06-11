import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingDefinition } from '../../api/adminSettings';
import { CheckIcon, CloseIcon, EditIcon } from './icons';

interface SettingInputProps {
  setting: SettingDefinition;
  onUpdate: (value: string) => void;
  disabled?: boolean;
}

// Check if value is likely JSON or multi-line
function isLongValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const str = String(value);
  return str.length > 50 || str.includes('\n') || str.startsWith('[') || str.startsWith('{');
}

// Check if key suggests it's a list or JSON config
function isListOrJsonKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('_items') ||
    lowerKey.includes('_config') ||
    lowerKey.includes('_keywords') ||
    lowerKey.includes('_list') ||
    lowerKey.includes('_json') ||
    lowerKey.includes('_template') ||
    lowerKey.includes('_periods') ||
    lowerKey.includes('_discounts') ||
    lowerKey.includes('_packages')
  );
}

export function SettingInput({ setting, onUpdate, disabled }: SettingInputProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = String(setting.current ?? '');
  // Secrets are always edited via the single-line (password) input — never a textarea — and
  // never pre-filled with the masked value, so leaving the field empty means "keep current".
  const needsTextarea =
    !setting.is_secret && (isLongValue(currentValue) || isListOrJsonKey(setting.key));

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 300) + 'px';
    }
  }, [value, isEditing]);

  const handleStart = () => {
    // For secrets, start from an empty field (the displayed value is just the mask) so the
    // admin types a brand-new value; leaving it empty is treated as "no change".
    setValue(setting.is_secret ? '' : currentValue);
    setIsEditing(true);
  };

  const handleSave = () => {
    // Empty secret field = the admin opened edit but didn't change anything → keep the stored
    // secret instead of overwriting it with an empty value.
    if (setting.is_secret && value === '') {
      handleCancel();
      return;
    }
    onUpdate(value);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setValue('');
  };

  // Dropdown for choices
  if (setting.choices && setting.choices.length > 0) {
    return (
      <select
        value={currentValue}
        onChange={(e) => onUpdate(e.target.value)}
        disabled={disabled}
        className="border-dark-600 bg-dark-700 text-dark-100 focus:border-accent-500 focus:ring-accent-500/30 min-w-[140px] cursor-pointer rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-50"
      >
        {setting.choices.map((choice, idx) => (
          <option key={idx} value={String(choice.value)}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  // Editing mode - Textarea for long values
  if (isEditing && needsTextarea) {
    return (
      <div className="w-full space-y-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            // Ctrl+Enter to save
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
          }}
          autoFocus
          placeholder={t('admin.settings.inputPlaceholder')}
          className="border-accent-500 bg-dark-700 text-dark-100 focus:ring-accent-500/30 min-h-[100px] w-full resize-none rounded-xl border px-4 py-3 font-mono text-sm focus:ring-2 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-dark-500 text-xs">{t('admin.settings.ctrlEnterHint')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="bg-dark-600 text-dark-300 hover:bg-dark-500 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              {t('admin.settings.cancelButton')}
            </button>
            <button
              onClick={handleSave}
              className="bg-accent-500 text-on-accent hover:bg-accent-600 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              <CheckIcon />
              {t('admin.settings.saveButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Editing mode - Regular input
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type={
            setting.is_secret
              ? 'password'
              : setting.type === 'int' || setting.type === 'float'
                ? 'number'
                : 'text'
          }
          autoComplete={setting.is_secret ? 'new-password' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          placeholder={t('admin.settings.inputPlaceholder')}
          className="border-accent-500 bg-dark-700 text-dark-100 focus:ring-accent-500/30 w-48 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none sm:w-56"
        />
        <button
          onClick={handleSave}
          className="bg-accent-500 text-on-accent hover:bg-accent-600 rounded-lg p-2 transition-colors"
          title={t('admin.settings.saveHint')}
        >
          <CheckIcon />
        </button>
        <button
          onClick={handleCancel}
          className="bg-dark-600 text-dark-300 hover:bg-dark-500 rounded-lg p-2 transition-colors"
          title={t('admin.settings.cancelHint')}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  // Display mode - Long value preview
  if (needsTextarea) {
    const displayValue = currentValue || '-';
    const previewValue =
      displayValue.length > 60 ? displayValue.slice(0, 60) + '...' : displayValue;

    return (
      <button
        onClick={handleStart}
        disabled={disabled}
        className="group border-dark-600 bg-dark-700/50 text-dark-200 hover:border-dark-500 hover:bg-dark-700 w-full rounded-xl border px-4 py-3 text-left font-mono text-sm transition-colors disabled:opacity-50"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 flex-1 break-all">{previewValue}</span>
          <span className="text-dark-500 group-hover:text-accent-400 shrink-0 transition-colors">
            <EditIcon />
          </span>
        </div>
      </button>
    );
  }

  // Display mode - Short value
  return (
    <button
      onClick={handleStart}
      disabled={disabled}
      className="group border-dark-600 bg-dark-700 text-dark-200 hover:border-dark-500 hover:bg-dark-600 flex max-w-[200px] min-w-[100px] items-center gap-2 truncate rounded-lg border px-3 py-2.5 text-left font-mono text-sm transition-colors disabled:opacity-50"
    >
      <span className="flex-1 truncate">{currentValue || '-'}</span>
      <span className="text-dark-500 group-focus-within:text-accent-400 group-hover:text-accent-400 opacity-0 transition-colors group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <EditIcon />
      </span>
    </button>
  );
}
