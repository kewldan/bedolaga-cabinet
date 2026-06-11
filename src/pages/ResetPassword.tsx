import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { CheckIcon } from '@/components/icons';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [error, setError] = useState('');
  // Track the post-success redirect timer so unmount cancels it instead of
  // firing navigate() on a torn-down component.
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('resetPassword.invalidToken', 'Invalid or missing reset token'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setStatus('loading');

    try {
      await authApi.resetPassword(token, password);
      setStatus('success');
      redirectTimerRef.current = setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      setStatus('error');
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || t('common.error'));
    }
  };

  if (!token) {
    return (
      <div className="min-h-viewport flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="from-dark-950 via-dark-900 to-dark-950 fixed inset-0 bg-linear-to-br" />
        <div className="fixed top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="text-error-400 mb-4 text-5xl">!</div>
            <h2 className="text-dark-50 mb-2 text-xl font-semibold">
              {t('resetPassword.invalidToken', 'Invalid reset link')}
            </h2>
            <p className="text-dark-400 mb-6">
              {t(
                'resetPassword.tokenExpiredOrInvalid',
                'This password reset link is invalid or has expired.',
              )}
            </p>
            <Link to="/login" className="btn-primary inline-block w-full">
              {t('auth.backToLogin', 'Back to login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-viewport flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="from-dark-950 via-dark-900 to-dark-950 fixed inset-0 bg-linear-to-br" />
      <div className="from-accent-500/10 fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] via-transparent to-transparent" />
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-md">
        <div className="card">
          {status === 'success' ? (
            <div className="text-center">
              <div className="bg-success-500/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                <CheckIcon className="text-success-400 h-8 w-8" />
              </div>
              <h2 className="text-dark-50 mb-2 text-xl font-bold">
                {t('resetPassword.success', 'Password changed!')}
              </h2>
              <p className="text-dark-400 mb-4">
                {t('resetPassword.redirectingToLogin', 'Redirecting to login...')}
              </p>
              <div className="border-accent-500 mx-auto h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : (
            <>
              <h2 className="text-dark-50 mb-2 text-center text-xl font-bold">
                {t('resetPassword.title', 'Set new password')}
              </h2>
              <p className="text-dark-400 mb-6 text-center">
                {t('resetPassword.enterNewPassword', 'Enter your new password below.')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">
                    {t('auth.password', 'Password')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input"
                    autoComplete="new-password"
                    disabled={status === 'loading'}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="label">
                    {t('auth.confirmPassword', 'Confirm Password')}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input"
                    autoComplete="new-password"
                    disabled={status === 'loading'}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="border-error-500/30 bg-error-500/10 text-error-400 rounded-xl border px-4 py-3 text-sm"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn-primary w-full"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('common.loading')}
                    </span>
                  ) : (
                    t('resetPassword.setPassword', 'Set new password')
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="text-dark-400 hover:text-dark-200 text-sm transition-colors"
                >
                  {t('auth.backToLogin', 'Back to login')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
