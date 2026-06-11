import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { brandingApi } from '../api/branding';
import { copyToClipboard } from '../utils/clipboard';
import { openAppScheme } from '../utils/openAppScheme';
import {
  CheckIcon,
  CopyIcon,
  ExclamationIcon,
  ExternalLinkIcon,
  LinkIcon,
} from '@/components/icons';

type Status = 'countdown' | 'fallback' | 'error';

// App schemes configuration - same as miniapp
const appSchemes = [
  { scheme: 'happ://', icon: 'H', name: 'Happ' },
  { scheme: 'incy://', icon: 'I', name: 'INCY' },
  { scheme: 'flclash://', icon: 'F', name: 'FlClash' },
  { scheme: 'clash://', icon: 'C', name: 'Clash Meta' },
  { scheme: 'sing-box://', icon: 'S', name: 'sing-box' },
  { scheme: 'v2rayng://', icon: 'V', name: 'v2rayNG' },
  { scheme: 'sub://', icon: 'R', name: 'Shadowrocket' },
  { scheme: 'shadowrocket://', icon: 'R', name: 'Shadowrocket' },
  { scheme: 'hiddify://', icon: 'H', name: 'Hiddify' },
  { scheme: 'streisand://', icon: 'S', name: 'Streisand' },
  { scheme: 'quantumult://', icon: 'Q', name: 'Quantumult X' },
  { scheme: 'surge://', icon: 'S', name: 'Surge' },
  { scheme: 'loon://', icon: 'L', name: 'Loon' },
  { scheme: 'nekobox://', icon: 'N', name: 'NekoBox' },
  { scheme: 'v2box://', icon: 'V', name: 'V2Box' },
];

const COUNTDOWN_SECONDS = 5;

// Validate deep link to prevent javascript: and other dangerous schemes
const isValidDeepLink = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase().trim();
  // Block dangerous schemes
  // eslint-disable-next-line no-script-url -- listing dangerous schemes to block them
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousSchemes.some((scheme) => lowerUrl.startsWith(scheme))) {
    return false;
  }
  // Only allow known app schemes
  return appSchemes.some((app) => lowerUrl.startsWith(app.scheme));
};

export default function DeepLinkRedirect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [copied, setCopied] = useState(false);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get branding
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.getBranding,
    staleTime: 60000,
  });

  const projectName = branding ? branding.name : import.meta.env.VITE_APP_NAME || 'VPN';
  const logoLetter = branding?.logo_letter || import.meta.env.VITE_APP_LOGO || 'V';
  const logoUrl = branding ? brandingApi.getLogoUrl(branding) : null;

  // Parse raw query string to preserve '+' chars in base64 crypto links.
  // URLSearchParams decodes '+' as space, breaking ss://, vless:// etc.
  // decodeURIComponent does NOT treat '+' as space, so parsing raw pairs is correct.
  const getRawParam = (key: string): string => {
    const search = window.location.search.substring(1);
    for (const pair of search.split('&')) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      if (decodeURIComponent(pair.substring(0, idx)) === key) {
        return decodeURIComponent(pair.substring(idx + 1));
      }
    }
    return '';
  };

  // Get parameters
  const deepLink = getRawParam('url') || getRawParam('deeplink') || '';
  const subscriptionUrl = getRawParam('sub') || '';
  const appParam = searchParams.get('app') || '';

  // Detect app from deep link
  const appInfo = deepLink
    ? appSchemes.find((a) => deepLink.toLowerCase().startsWith(a.scheme))
    : null;
  const appName = appInfo?.name || appParam || 'VPN';
  const appIcon = appInfo?.icon || appName[0]?.toUpperCase() || 'V';

  // Open deep link via a contained iframe attempt so a custom scheme the in-app
  // WebView can't resolve doesn't replace this page with net::ERR_UNKNOWN_URL_SCHEME
  // (Android) / silently fail (iOS) and wipe the fallback UI. See openAppScheme.
  const openDeepLink = useCallback(() => {
    if (!deepLink || !isValidDeepLink(deepLink)) return;
    openAppScheme(deepLink);
  }, [deepLink]);

  // Countdown timer effect
  useEffect(() => {
    if (!deepLink || !isValidDeepLink(deepLink)) {
      setStatus('error');
      return;
    }

    if (status !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          openDeepLink();
          // Show fallback after a delay - store ref for cleanup
          fallbackTimeoutRef.current = setTimeout(() => setStatus('fallback'), 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      // Cleanup fallback timeout on unmount
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    };
  }, [deepLink, status, openDeepLink]);

  const handleCopyLink = async () => {
    const linkToCopy = subscriptionUrl || deepLink;
    // Clear previous timeout to prevent stacking
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    await copyToClipboard(linkToCopy);
    setCopied(true);
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  // Cleanup copied timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  // Progress percentage
  const progress = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

  return (
    <div className="min-h-viewport flex items-center justify-center p-4">
      {/* Background */}
      <div className="from-dark-950 via-dark-900 to-dark-950 fixed inset-0 bg-linear-to-br" />
      <div className="from-accent-500/10 fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] via-transparent to-transparent" />

      <div className="relative w-full max-w-sm text-center">
        {/* Logo with pulse animation */}
        <div className="from-accent-400 to-accent-600 shadow-accent-500/30 mx-auto mb-6 flex h-20 w-20 animate-pulse items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br shadow-lg">
          {branding?.has_custom_logo && logoUrl ? (
            <img src={logoUrl} alt={projectName || 'Logo'} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white">{logoLetter}</span>
          )}
        </div>

        <h1 className="text-dark-50 mb-1 text-2xl font-bold">{projectName || 'VPN'}</h1>

        {status !== 'error' && (
          <p className="text-dark-400 mb-6">
            {t('deepLink.connecting')} {appName}...
          </p>
        )}

        {/* Countdown State */}
        {status === 'countdown' && (
          <div className="card bg-dark-800/80! p-6 backdrop-blur-sm">
            {/* App icon */}
            <div className="bg-accent-500/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
              <span className="text-accent-400 text-2xl font-bold">{appIcon}</span>
            </div>

            {/* Spinner */}
            <div className="border-dark-700 border-t-accent-500 mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-3" />

            {/* Timer */}
            <div className="mb-4">
              <p className="text-dark-500 mb-2 text-sm">{t('deepLink.redirecting')}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-accent-400 text-4xl font-bold">{countdown}</span>
                <span className="text-dark-400">{t('deepLink.seconds')}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-dark-700 mb-4 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="from-accent-400 to-accent-600 h-full rounded-full bg-linear-to-r transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-dark-500 mb-4 text-sm">{t('deepLink.manual')}</p>

            {/* Open now button */}
            <button
              onClick={openDeepLink}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <ExternalLinkIcon className="h-5 w-5" />
              {t('deepLink.openApp')}
            </button>
          </div>
        )}

        {/* Fallback State - App didn't open */}
        {status === 'fallback' && (
          <div className="card bg-dark-800/80! p-6 backdrop-blur-sm">
            {/* App icon */}
            <div className="bg-accent-500/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
              <span className="text-accent-400 text-2xl font-bold">{appIcon}</span>
            </div>

            <div className="space-y-3">
              {/* Copy subscription link */}
              <button
                onClick={handleCopyLink}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    {t('deepLink.copied')}
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-5 w-5" />
                    {t('deepLink.copyLink')}
                  </>
                )}
              </button>

              {/* Try again button */}
              <button
                onClick={openDeepLink}
                className="btn-secondary flex w-full items-center justify-center gap-2"
              >
                <ExternalLinkIcon className="h-5 w-5" />
                {t('deepLink.tryAgain')}
              </button>

              {/* Back to cabinet */}
              <button
                onClick={() => navigate('/subscriptions')}
                className="text-dark-500 hover:text-dark-300 w-full py-2 text-sm transition-colors"
              >
                {t('deepLink.backToCabinet')}
              </button>
            </div>

            {/* Instructions */}
            <div className="border-dark-700 bg-dark-900/50 mt-6 rounded-xl border p-4 text-left">
              <h3 className="text-dark-200 mb-2 text-sm font-medium">{t('deepLink.howToAdd')}</h3>
              <ol className="text-dark-400 list-inside list-decimal space-y-1.5 text-xs">
                <li>{t('deepLink.step1')}</li>
                <li>
                  {t('deepLink.step2')} {appName}
                </li>
                <li>{t('deepLink.step3')}</li>
                <li>{t('deepLink.step4')}</li>
              </ol>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="card bg-dark-800/80! p-6 backdrop-blur-sm">
            <div className="bg-error-500/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <ExclamationIcon className="text-error-400 h-8 w-8" />
            </div>
            <p className="text-dark-200 mb-2 font-medium">{t('deepLink.errorTitle')}</p>
            <p className="text-dark-400 mb-6 text-sm">{t('deepLink.errorDesc')}</p>
            <button onClick={() => navigate('/subscriptions')} className="btn-primary w-full">
              {t('deepLink.goToSubscription')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-dark-600 mt-8 flex items-center justify-center gap-2">
          <LinkIcon className="h-4 w-4" />
          <span className="text-xs">VPN Config Redirect</span>
        </div>
      </div>
    </div>
  );
}
