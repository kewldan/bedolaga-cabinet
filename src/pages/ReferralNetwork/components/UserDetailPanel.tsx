import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { referralNetworkApi } from '@/api/referralNetwork';
import { CloseIcon } from '@/components/icons';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import { formatKopeksToRubles, getSubscriptionStatusColor } from '../utils';

interface UserDetailPanelProps {
  userId: number;
  className?: string;
}

export function UserDetailPanel({ userId, className }: UserDetailPanelProps) {
  const { t } = useTranslation();
  const setSelectedNode = useReferralNetworkStore((s) => s.setSelectedNode);

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['referral-network-user', userId],
    queryFn: () => referralNetworkApi.getUserDetail(userId),
    staleTime: 60_000,
  });

  function handleClose() {
    setSelectedNode(null);
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="border-dark-700/50 flex items-center justify-between border-b p-4">
        <h3 className="text-dark-100 text-sm font-semibold">{user?.display_name ?? '...'}</h3>
        <button
          onClick={handleClose}
          className="text-dark-500 hover:bg-dark-800 hover:text-dark-300 rounded-lg p-1 transition-colors"
          aria-label={t('common.close')}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom,0))]">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="border-dark-600 border-t-accent-400 h-6 w-6 animate-spin rounded-full border-2" />
          </div>
        )}

        {isError && (
          <div className="text-error-400 py-8 text-center text-sm">
            {t('admin.referralNetwork.error')}
          </div>
        )}

        {user && (
          <div className="space-y-5">
            {/* Identity */}
            <div className="space-y-2">
              {user.username && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-dark-500 shrink-0">@</span>
                  <span className="text-dark-200 min-w-0 truncate font-mono">{user.username}</span>
                </div>
              )}
              {user.tg_id && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-500">{t('admin.referralNetwork.user.tgId')}</span>
                  <span className="text-dark-200 font-mono">{user.tg_id}</span>
                </div>
              )}
              {user.email && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-500">{t('admin.referralNetwork.user.email')}</span>
                  <span className="text-dark-200 truncate pl-4 font-mono">{user.email}</span>
                </div>
              )}
              {user.is_partner && (
                <div className="flex justify-end">
                  <span className="bg-warning-500/20 text-warning-400 rounded px-2 py-0.5 text-xs font-medium">
                    {t('admin.referralNetwork.user.partner')}
                  </span>
                </div>
              )}
            </div>

            {/* Subscription */}
            <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
              <h4 className="text-dark-500 mb-2 text-xs font-medium tracking-wider uppercase">
                {t('admin.referralNetwork.user.subscription')}
              </h4>
              {user.subscription_name ? (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-dark-100 text-sm font-medium">{user.subscription_name}</p>
                    {user.subscription_status && (
                      <span className="bg-dark-700/50 flex items-center gap-1.5 rounded-full px-2 py-0.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: getSubscriptionStatusColor(user.subscription_status),
                          }}
                        />
                        <span className="text-dark-300 text-[10px] font-medium">
                          {t(
                            `admin.referralNetwork.user.subscriptionStatus.${user.subscription_status}`,
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                  {user.subscription_end && (
                    <p className="text-dark-400 mt-0.5 text-xs">
                      {t('admin.referralNetwork.user.validUntil', {
                        date: new Date(user.subscription_end).toLocaleDateString(),
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-dark-500 text-sm">
                  {t('admin.referralNetwork.user.noSubscription')}
                </p>
              )}
            </div>

            {/* Personal stats */}
            <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
              <h4 className="text-dark-500 mb-2 text-xs font-medium tracking-wider uppercase">
                {t('admin.referralNetwork.user.personalStats')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.totalSpent')}
                  </span>
                  <span className="text-dark-100 font-mono">
                    {formatKopeksToRubles(user.personal_spent_kopeks)} ₽
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.referralEarnings')}
                  </span>
                  <span className="text-accent-400 font-mono">
                    {formatKopeksToRubles(user.personal_revenue_kopeks)} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Referral branch */}
            <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
              <h4 className="text-dark-500 mb-2 text-xs font-medium tracking-wider uppercase">
                {t('admin.referralNetwork.user.referralBranch')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.directReferrals')}
                  </span>
                  <span className="text-dark-100 font-mono">{user.direct_referrals}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.branchSize')}
                  </span>
                  <span className="text-dark-100 font-mono">{user.total_branch_users}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.branchRevenue')}
                  </span>
                  <span className="text-dark-100 font-mono">
                    {formatKopeksToRubles(user.branch_revenue_kopeks)} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Source */}
            <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
              <h4 className="text-dark-500 mb-2 text-xs font-medium tracking-wider uppercase">
                {t('admin.referralNetwork.user.source')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.user.referredBy')}
                  </span>
                  <span className="text-dark-200">
                    {user.referrer_display_name ?? t('admin.referralNetwork.user.organic')}
                  </span>
                </div>
                {user.campaign_name && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-dark-400 shrink-0">
                      {t('admin.referralNetwork.user.fromCampaign')}
                    </span>
                    <span className="text-dark-200 min-w-0 truncate">{user.campaign_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
