import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CloseIcon } from '@/components/icons';
import { referralNetworkApi } from '@/api/referralNetwork';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import { formatKopeksToRubles } from '../utils';

interface CampaignDetailPanelProps {
  campaignId: number;
  className?: string;
}

export function CampaignDetailPanel({ campaignId, className }: CampaignDetailPanelProps) {
  const { t } = useTranslation();
  const setSelectedNode = useReferralNetworkStore((s) => s.setSelectedNode);

  const {
    data: campaign,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['referral-network-campaign', campaignId],
    queryFn: () => referralNetworkApi.getCampaignDetail(campaignId),
    staleTime: 60_000,
  });

  function handleClose() {
    setSelectedNode(null);
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="border-dark-700/50 flex items-center justify-between border-b p-4">
        <h3 className="text-dark-100 text-sm font-semibold">{campaign?.name ?? '...'}</h3>
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

        {campaign && (
          <div className="space-y-5">
            {/* Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-dark-500 shrink-0">
                  {t('admin.referralNetwork.campaign.startParam')}
                </span>
                <span className="text-dark-200 min-w-0 truncate font-mono">
                  {campaign.start_parameter}
                </span>
              </div>
              <div className="flex justify-end">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    campaign.is_active
                      ? 'bg-success-500/20 text-success-400'
                      : 'bg-dark-700/50 text-dark-400'
                  }`}
                >
                  {campaign.is_active
                    ? t('admin.referralNetwork.campaign.active')
                    : t('admin.referralNetwork.campaign.inactive')}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.campaign.directUsers')}
                  </span>
                  <span className="text-dark-100 font-mono">{campaign.direct_users}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.campaign.totalNetwork')}
                  </span>
                  <span className="text-dark-100 font-mono">{campaign.total_network_users}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.campaign.totalRevenue')}
                  </span>
                  <span className="text-accent-400 font-mono">
                    {formatKopeksToRubles(campaign.total_revenue_kopeks)} ₽
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.campaign.conversionRate')}
                  </span>
                  <span className="text-dark-100 font-mono">
                    {campaign.conversion_rate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-400">
                    {t('admin.referralNetwork.campaign.avgCheck')}
                  </span>
                  <span className="text-dark-100 font-mono">
                    {formatKopeksToRubles(campaign.avg_check_kopeks)} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Top referrers */}
            {campaign.top_referrers.length > 0 && (
              <div className="border-dark-700/50 bg-dark-800/40 rounded-lg border p-3">
                <h4 className="text-dark-500 mb-2 text-xs font-medium tracking-wider uppercase">
                  {t('admin.referralNetwork.campaign.topReferrers')}
                </h4>
                <div className="space-y-1.5">
                  {campaign.top_referrers.map((referrer, index) => (
                    <div
                      key={referrer.user_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="bg-dark-700 text-dark-300 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                          {index + 1}
                        </span>
                        <span className="text-dark-200 truncate">
                          {referrer.username ? `@${referrer.username}` : `#${referrer.user_id}`}
                        </span>
                      </div>
                      <span className="text-dark-300 shrink-0 font-mono">
                        {referrer.referral_count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
