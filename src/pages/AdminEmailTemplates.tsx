import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminEmailTemplatesApi,
  EmailTemplateType,
  EmailTemplateDetail,
  EmailTemplateLanguageData,
} from '../api/adminEmailTemplates';
import { AdminBackButton, BackIcon } from '../components/admin';
import { useNativeDialog } from '../platform/hooks/useNativeDialog';
import { useNotify } from '@/platform';
import { getApiErrorMessage } from '@/utils/api-error';
import { MailIcon, SaveIcon, EyeIcon, SendIcon, ResetIcon, EditIcon } from '@/components/icons';

const LANG_LABELS: Record<string, string> = {
  ru: 'RU',
  en: 'EN',
  zh: 'ZH',
  ua: 'UA',
  fa: 'FA',
};

const LANG_FULL_LABELS: Record<string, string> = {
  ru: 'Русский',
  en: 'English',
  zh: '中文',
  ua: 'Українська',
  fa: 'فارسی',
};

// ============ Template List View ============

function TemplateCard({
  template,
  currentLang,
  onClick,
}: {
  template: EmailTemplateType;
  currentLang: string;
  onClick: () => void;
}) {
  const label = template.label[currentLang] || template.label['en'] || template.type;
  const description = template.description[currentLang] || template.description['en'] || '';
  const customCount = Object.values(template.languages).filter((l) => l.has_custom).length;

  return (
    <button
      onClick={onClick}
      className="group border-dark-700 bg-dark-800 hover:border-accent-500/50 w-full rounded-xl border p-3 text-left transition-all duration-200 sm:p-4"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-dark-100 group-hover:text-accent-400 truncate text-sm font-medium transition-colors">
            {label}
          </h3>
          <p className="text-dark-400 mt-1 line-clamp-2 text-xs">{description}</p>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1 sm:gap-1.5">
          {Object.entries(template.languages).map(([lang, status]) => (
            <span
              key={lang}
              className={`text-2xs inline-flex h-5 w-6 items-center justify-center rounded font-medium sm:w-7 ${
                status.has_custom
                  ? 'bg-accent-500/20 text-accent-400 ring-accent-500/30 ring-1'
                  : 'bg-dark-700 text-dark-400'
              }`}
              title={`${LANG_FULL_LABELS[lang] || lang}: ${status.has_custom ? 'Custom' : 'Default'}`}
            >
              {LANG_LABELS[lang] || lang}
            </span>
          ))}
        </div>
      </div>
      {customCount > 0 && (
        <div className="mt-2">
          <span className="bg-accent-500/10 text-2xs text-accent-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5">
            <span className="bg-accent-400 h-1.5 w-1.5 rounded-full" />
            {customCount} custom
          </span>
        </div>
      )}
    </button>
  );
}

// ============ Template Editor ============

// Extract body content from full HTML (strip base template wrapper)
function extractBodyContent(html: string): string {
  const contentMatch = html.match(
    /<div class="content">\s*([\s\S]*?)\s*<\/div>\s*<div class="footer">/,
  );
  if (contentMatch) {
    return contentMatch[1].trim();
  }
  return html;
}

function TemplateEditor({
  detail,
  onClose,
  currentLang: interfaceLang,
}: {
  detail: EmailTemplateDetail;
  onClose: () => void;
  currentLang: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { confirm: confirmDialog } = useNativeDialog();

  const [activeLang, setActiveLang] = useState('ru');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const langData: EmailTemplateLanguageData | undefined = detail.languages[activeLang];

  // Load data for current language (defaults arrive with {placeholders} intact)
  useEffect(() => {
    if (langData) {
      setEditSubject(langData.subject);
      setEditBody(
        langData.is_default ? extractBodyContent(langData.body_html) : langData.body_html,
      );
      setIsDirty(false);
      setActiveTab('editor');
    }
  }, [activeLang, langData]);

  const notifyError = useCallback(
    (error: unknown) => {
      notify.error(getApiErrorMessage(error, t('common.error')));
    },
    [notify, t],
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.updateTemplate(detail.notification_type, activeLang, {
        subject: editSubject,
        body_html: editBody,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'email-template', detail.notification_type],
      });
      setIsDirty(false);
      notify.success(t('admin.emailTemplates.saved'));
    },
    onError: notifyError,
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => adminEmailTemplatesApi.deleteTemplate(detail.notification_type, activeLang),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'email-template', detail.notification_type],
      });
      setIsDirty(false);
      notify.success(t('admin.emailTemplates.resetted'));
    },
    onError: notifyError,
  });

  // Send test mutation — sends the CURRENT editor content (even unsaved)
  const testMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.sendTestEmail(detail.notification_type, {
        language: activeLang,
        email: testEmail.trim(),
        subject: editSubject,
        body_html: editBody,
      }),
    onSuccess: (data) => {
      notify.success(`${t('admin.emailTemplates.testSent')} → ${data.sent_to}`);
    },
    onError: notifyError,
  });

  // Preview mutation — renders current content with sample values
  const previewMutation = useMutation({
    mutationFn: () =>
      adminEmailTemplatesApi.previewTemplate(detail.notification_type, {
        language: activeLang,
        subject: editSubject,
        body_html: editBody,
      }),
    onSuccess: (data) => {
      setPreviewHtml(data.body_html);
      setPreviewSubject(data.subject);
    },
    onError: notifyError,
  });

  const openPreview = () => {
    setActiveTab('preview');
    previewMutation.mutate();
  };

  const insertVariable = (variable: string) => {
    const token = `{${variable}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditBody(editBody + token);
      setIsDirty(true);
      return;
    }
    const start = textarea.selectionStart ?? editBody.length;
    const end = textarea.selectionEnd ?? editBody.length;
    const next = editBody.slice(0, start) + token + editBody.slice(end);
    setEditBody(next);
    setIsDirty(true);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const insertDefaultTemplate = async () => {
    if (!langData) return;
    if (!(await confirmDialog(t('admin.emailTemplates.insertDefaultConfirm')))) return;
    setEditSubject(langData.default_subject);
    setEditBody(extractBodyContent(langData.default_body_html));
    setIsDirty(true);
    setActiveTab('editor');
  };

  const label = detail.label[interfaceLang] || detail.label['en'] || detail.notification_type;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 sm:items-center">
        <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
          <button
            onClick={onClose}
            className="hover:bg-dark-700 mt-0.5 shrink-0 rounded-lg p-1 transition-colors sm:mt-0"
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <h2 className="text-dark-100 truncate text-base font-semibold sm:text-lg">{label}</h2>
            <p className="text-dark-400 line-clamp-2 text-xs">
              {detail.description[interfaceLang] || detail.description['en'] || ''}
            </p>
          </div>
        </div>
        {langData && !langData.is_default && (
          <span className="bg-accent-500/15 text-2xs text-accent-400 ring-accent-500/25 shrink-0 rounded-full px-2 py-1 font-medium ring-1 sm:px-2.5 sm:text-xs">
            Custom
          </span>
        )}
      </div>

      {/* Language tabs */}
      <div className="bg-dark-900 flex items-center gap-1 overflow-x-auto rounded-lg p-1">
        {Object.keys(detail.languages).map((lang) => {
          const isActive = lang === activeLang;
          const langInfo = detail.languages[lang];
          return (
            <button
              key={lang}
              onClick={async () => {
                if (isDirty && !(await confirmDialog(t('admin.emailTemplates.unsavedWarning'))))
                  return;
                setActiveLang(lang);
              }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap transition-all duration-150 sm:gap-1.5 sm:px-3 sm:text-sm ${
                isActive
                  ? 'bg-dark-700 text-dark-100 shadow-sm'
                  : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'
              }`}
            >
              <span className="sm:hidden">{LANG_LABELS[lang] || lang}</span>
              <span className="hidden sm:inline">{LANG_FULL_LABELS[lang] || lang}</span>
              {!langInfo.is_default && (
                <span className="bg-accent-400 h-1.5 w-1.5 shrink-0 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor / Preview tabs */}
      <div className="bg-dark-900 flex items-center gap-1 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 sm:text-sm ${
            activeTab === 'editor'
              ? 'bg-dark-700 text-dark-100 shadow-sm'
              : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'
          }`}
        >
          <EditIcon className="h-4 w-4" />
          {t('admin.emailTemplates.editorTab')}
        </button>
        <button
          onClick={openPreview}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 sm:text-sm ${
            activeTab === 'preview'
              ? 'bg-dark-700 text-dark-100 shadow-sm'
              : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'
          }`}
        >
          <EyeIcon className="h-4 w-4" />
          {t('admin.emailTemplates.preview')}
        </button>
      </div>

      {activeTab === 'preview' ? (
        <div className="space-y-2">
          {previewSubject && (
            <div className="border-dark-700 bg-dark-900/60 rounded-lg border px-3 py-2">
              <span className="text-dark-400 text-xs">{t('admin.emailTemplates.subject')}: </span>
              <span className="text-dark-100 text-sm">{previewSubject}</span>
            </div>
          )}
          <div className="border-dark-700 overflow-hidden rounded-xl border bg-white">
            {previewMutation.isPending ? (
              <div className="bg-dark-800 flex h-[420px] items-center justify-center">
                <div className="border-accent-500 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                sandbox=""
                className="h-[420px] w-full sm:h-[560px]"
                title="Email Preview"
              />
            )}
          </div>
          <p className="text-2xs text-dark-500">{t('admin.emailTemplates.previewHint')}</p>
        </div>
      ) : (
        <>
          {/* Subject */}
          <div>
            <label className="text-dark-300 mb-2 block text-sm font-medium">
              {t('admin.emailTemplates.subject')}
            </label>
            <input
              type="text"
              value={editSubject}
              onChange={(e) => {
                setEditSubject(e.target.value);
                setIsDirty(true);
              }}
              className="input"
              placeholder={t('admin.emailTemplates.subjectPlaceholder')}
            />
          </div>

          {/* Context variables hint: type-specific + common (available in all templates) */}
          {(detail.context_vars.length > 0 || (detail.common_context_vars?.length ?? 0) > 0) && (
            <div className="border-dark-700 bg-dark-900/60 space-y-2.5 rounded-lg border p-2.5 sm:p-3">
              {detail.context_vars.length > 0 && (
                <div>
                  <p className="text-dark-300 mb-1.5 text-xs font-medium">
                    {t('admin.emailTemplates.variables')}
                  </p>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {detail.context_vars.map((v) => (
                      <code
                        key={v}
                        className="bg-dark-700 text-accent-400 hover:bg-dark-600 cursor-pointer rounded px-2 py-0.5 font-mono text-xs transition-colors"
                        title={t('admin.emailTemplates.clickToInsert')}
                        onClick={() => insertVariable(v)}
                      >
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {(detail.common_context_vars?.length ?? 0) > 0 && (
                <div>
                  <p className="text-dark-400 mb-1.5 text-xs font-medium">
                    {t('admin.emailTemplates.variablesCommon')}
                  </p>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {detail.common_context_vars!.map((v) => (
                      <code
                        key={v}
                        className="bg-dark-800 text-dark-300 ring-dark-600 hover:bg-dark-700 hover:text-accent-400 cursor-pointer rounded px-2 py-0.5 font-mono text-xs ring-1 transition-colors"
                        title={t('admin.emailTemplates.clickToInsert')}
                        onClick={() => insertVariable(v)}
                      >
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Body HTML editor */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-dark-300 block text-sm font-medium">
                {t('admin.emailTemplates.body')}
              </label>
              <button
                onClick={insertDefaultTemplate}
                className="text-dark-400 hover:text-accent-400 text-xs underline-offset-2 transition-colors hover:underline"
              >
                {t('admin.emailTemplates.insertDefault')}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={editBody}
              onChange={(e) => {
                setEditBody(e.target.value);
                setIsDirty(true);
              }}
              rows={12}
              className="input min-h-[200px] resize-y font-mono text-xs leading-relaxed sm:min-h-[300px] sm:text-sm"
              placeholder="<h2>Title</h2><p>Content...</p>"
              spellCheck={false}
            />
            <p className="text-2xs text-dark-500 mt-1">{t('admin.emailTemplates.bodyHint')}</p>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="bg-accent-500 text-on-accent hover:bg-accent-600 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-2"
          >
            <SaveIcon className="h-4 w-4" />
            {saveMutation.isPending ? t('common.loading') : t('common.save')}
          </button>

          {langData && !langData.is_default && (
            <button
              onClick={async () => {
                if (await confirmDialog(t('admin.emailTemplates.resetConfirm'))) {
                  resetMutation.mutate();
                }
              }}
              disabled={resetMutation.isPending}
              className="bg-dark-700 text-warning-400 hover:bg-dark-600 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 sm:px-4 sm:py-2"
            >
              <ResetIcon className="h-4 w-4" />
              <span className="truncate">{t('admin.emailTemplates.resetDefault')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Test email */}
      <div className="border-dark-700 bg-dark-900/60 rounded-lg border p-2.5 sm:p-3">
        <p className="text-dark-300 mb-2 text-xs font-medium">
          {t('admin.emailTemplates.sendTest')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="input flex-1"
            placeholder={t('admin.emailTemplates.testRecipientPlaceholder')}
          />
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="bg-dark-700 text-dark-200 hover:bg-dark-600 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 sm:px-4 sm:py-2"
          >
            <SendIcon className="h-4 w-4" />
            {testMutation.isPending ? t('common.loading') : t('admin.emailTemplates.sendTest')}
          </button>
        </div>
        <p className="text-2xs text-dark-500 mt-1.5">{t('admin.emailTemplates.testHint')}</p>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function AdminEmailTemplates() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'ru';
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Fetch template types list
  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: adminEmailTemplatesApi.getTemplateTypes,
  });

  // Fetch detail for selected type
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'email-template', selectedType],
    queryFn: () => adminEmailTemplatesApi.getTemplate(selectedType!),
    enabled: !!selectedType,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
      {/* Page Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <AdminBackButton className="border-dark-700 bg-dark-800 hover:bg-dark-700 shrink-0 rounded-xl border p-1.5 transition-colors sm:p-2" />
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="from-accent-500/20 to-accent-600/10 text-accent-400 shrink-0 rounded-xl bg-linear-to-br p-1.5 sm:p-2">
            <MailIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-dark-100 truncate text-lg font-bold sm:text-xl">
              {t('admin.emailTemplates.title')}
            </h1>
            <p className="text-dark-400 truncate text-xs">
              {t('admin.emailTemplates.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedType && detailData ? (
        <TemplateEditor
          detail={detailData}
          onClose={() => setSelectedType(null)}
          currentLang={currentLang}
        />
      ) : (
        <>
          {/* Template List */}
          {typesLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-dark-800 h-20 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {typesData?.items.map((template) => (
                <TemplateCard
                  key={template.type}
                  template={template}
                  currentLang={currentLang}
                  onClick={() => setSelectedType(template.type)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail loading overlay */}
      {selectedType && detailLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="border-accent-500 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
