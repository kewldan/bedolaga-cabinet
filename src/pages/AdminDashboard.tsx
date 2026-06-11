import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { statsApi, type NodeStatus } from '../api/admin';
import { formatUptime } from '../utils/format';

const CABINET_VERSION = __APP_VERSION__;
import { useCurrency } from '../hooks/useCurrency';
import { usePlatform } from '../platform/hooks/usePlatform';

import { StatCard } from '@/components/stats';
import {
  BackIcon,
  BanknotesIcon,
  CalendarBlankIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationIcon,
  MegaphoneIcon,
  PowerIcon,
  RefreshIcon,
  RestartIcon,
  ServerIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
  UsersOnlineIcon,
  WalletIcon,
  XCircleIcon,
} from '@/components/icons';

interface NodeCardProps {
  node: NodeStatus;
  onRestart: (uuid: string) => void;
  onToggle: (uuid: string) => void;
  isLoading: boolean;
}

function NodeCard({ node, onRestart, onToggle, isLoading }: NodeCardProps) {
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (node.is_disabled) return 'bg-dark-600 text-dark-400';
    if (node.is_connected) return 'bg-success-500/20 text-success-400';
    return 'bg-error-500/20 text-error-400';
  };

  const getStatusText = () => {
    if (node.is_disabled) return t('adminDashboard.nodes.disabled');
    if (node.is_connected) return t('adminDashboard.nodes.online');
    return t('adminDashboard.nodes.offline');
  };

  const formatTraffic = (bytes?: number) => {
    if (!bytes) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  const hasError = node.last_status_message && !node.is_connected;

  return (
    <div
      className={`bg-dark-800/50 rounded-xl border ${node.is_disabled ? 'border-dark-700' : node.is_connected ? 'border-success-500/30' : 'border-error-500/30'} hover:border-dark-600 p-4 transition-colors`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${node.is_disabled ? 'bg-dark-500' : node.is_connected ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`}
          />
          <div>
            <div className="text-dark-100 font-medium">{node.name}</div>
            <div className="text-dark-500 text-xs">{node.address}</div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Xray Version & Uptime */}
      {(node.versions?.xray || node.xray_uptime > 0) && (
        <div className="mb-3 flex items-center gap-3 text-xs">
          {node.versions?.xray && (
            <span className="bg-dark-700/50 text-dark-300 rounded px-2 py-1">
              Xray {node.versions.xray}
            </span>
          )}
          {node.xray_uptime > 0 && (
            <span className="text-dark-500">Uptime: {formatUptime(node.xray_uptime)}</span>
          )}
        </div>
      )}

      {/* Error Message */}
      {hasError && (
        <div className="border-error-500/20 bg-error-500/10 mb-3 rounded-lg border p-2">
          <div className="flex items-start gap-2">
            <ExclamationIcon className="h-4 w-4" />
            <span className="text-error-400 text-xs break-all">{node.last_status_message}</span>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="bg-dark-900/50 rounded-lg p-2.5">
          <div className="text-dark-500 mb-0.5 text-xs">
            {t('adminDashboard.nodes.usersOnline')}
          </div>
          <div className="text-dark-100 text-lg font-semibold">{node.users_online}</div>
        </div>
        <div className="bg-dark-900/50 rounded-lg p-2.5">
          <div className="text-dark-500 mb-0.5 text-xs">{t('adminDashboard.nodes.traffic')}</div>
          <div className="text-dark-100 text-lg font-semibold">
            {formatTraffic(node.traffic_used_bytes)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToggle(node.uuid)}
          disabled={isLoading}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            node.is_disabled
              ? 'bg-success-500/20 text-success-400 hover:bg-success-500/30'
              : 'bg-warning-500/20 text-warning-400 hover:bg-warning-500/30'
          } disabled:opacity-50`}
        >
          <PowerIcon className="h-4 w-4" />
          {node.is_disabled ? t('adminDashboard.nodes.enable') : t('adminDashboard.nodes.disable')}
        </button>
        <button
          onClick={() => onRestart(node.uuid)}
          disabled={isLoading || node.is_disabled}
          className="bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RestartIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: { date: string; amount_rubles: number }[] }) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();

  if (!data || data.length === 0) {
    return (
      <div className="text-dark-500 flex h-48 items-center justify-center">
        {t('common.noData')}
      </div>
    );
  }

  const last7Days = data.slice(-7);
  const maxValue = Math.max(...last7Days.map((d) => d.amount_rubles), 1);

  return (
    <div className="space-y-3">
      {last7Days.map((item) => {
        const percentage = (item.amount_rubles / maxValue) * 100;
        const date = new Date(item.date);
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        const dayNum = date.getDate();

        return (
          <div key={item.date} className="group">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-dark-300 text-sm font-medium capitalize">
                {dayName}, {dayNum}
              </span>
              <span className="text-dark-100 text-sm font-semibold">
                {formatAmount(item.amount_rubles)} {currencySymbol}
              </span>
            </div>
            <div className="bg-dark-700/50 h-3 overflow-hidden rounded-full">
              <div
                className="from-accent-600 to-accent-400 group-hover:from-accent-500 group-hover:to-accent-300 h-full rounded-full bg-linear-to-r transition-all duration-500 ease-out"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatAmount, currencySymbol } = useCurrency();
  const { capabilities } = usePlatform();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [referrersTab, setReferrersTab] = useState<'earnings' | 'invited'>('earnings');

  // Data fetching via React Query: caching, dedupe, and auto-refetch every 30s
  // (replaces the manual setInterval + useState + console.error pattern).
  const statsQuery = useQuery({
    queryKey: ['admin-dashboard-stats'] as const,
    queryFn: () => statsApi.getDashboardStats(),
    refetchInterval: 30_000,
  });
  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isLoading;
  const error = statsQuery.isError ? t('adminDashboard.loadError') : null;

  const extendedQuery = useQuery({
    queryKey: ['admin-dashboard-extended'] as const,
    queryFn: async () => {
      const [topReferrers, topCampaigns, recentPayments, sysInfo] = await Promise.all([
        statsApi.getTopReferrers(10),
        statsApi.getTopCampaigns(10),
        statsApi.getRecentPayments(20),
        statsApi.getSystemInfo(),
      ]);
      return { topReferrers, topCampaigns, recentPayments, sysInfo };
    },
    refetchInterval: 30_000,
  });
  const referrers = extendedQuery.data?.topReferrers ?? null;
  const campaigns = extendedQuery.data?.topCampaigns ?? null;
  const payments = extendedQuery.data?.recentPayments ?? null;
  const systemInfo = extendedQuery.data?.sysInfo ?? null;

  const handleRestartNode = async (uuid: string) => {
    try {
      setActionLoading(uuid);
      await statsApi.restartNode(uuid);
      // Refresh stats after action
      setTimeout(() => statsQuery.refetch(), 2000);
    } catch (err) {
      console.error('Failed to restart node:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleNode = async (uuid: string) => {
    try {
      setActionLoading(uuid);
      await statsApi.toggleNode(uuid);
      await statsQuery.refetch();
    } catch (err) {
      console.error('Failed to toggle node:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-accent-500 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-error-400">{error}</div>
        <button onClick={() => statsQuery.refetch()} className="btn-primary">
          {t('common.loading')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="border-dark-700 bg-dark-800 hover:border-dark-600 flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-dark-100 text-2xl font-bold">{t('adminDashboard.title')}</h1>
            <p className="text-dark-400">{t('adminDashboard.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => statsQuery.refetch()}
          disabled={loading}
          className="bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-dark-100 flex items-center gap-2 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
        >
          <RefreshIcon className="h-5 w-5" />
          {t('adminDashboard.refresh')}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t('adminDashboard.stats.usersOnline')}
          value={stats?.nodes.total_users_online || 0}
          icon={<UsersOnlineIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t('adminDashboard.stats.activeSubscriptions')}
          value={stats?.subscriptions.active || 0}
          subValue={`${t('adminDashboard.stats.total')}: ${stats?.subscriptions.total || 0}`}
          icon={<SparklesIcon className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label={t('adminDashboard.stats.incomeToday')}
          value={`${formatAmount(stats?.financial.income_today_rubles || 0)} ${currencySymbol}`}
          icon={<WalletIcon className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label={t('adminDashboard.stats.incomeMonth')}
          value={`${formatAmount(stats?.financial.income_month_rubles || 0)} ${currencySymbol}`}
          icon={<ChartBarIcon className="h-5 w-5" />}
          tone="accent"
        />
      </div>

      {/* Nodes Section */}
      <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent-500/20 text-accent-400 rounded-lg p-2.5">
              <ServerIcon />
            </div>
            <div>
              <h2 className="text-dark-100 text-lg font-semibold">
                {t('adminDashboard.nodes.title')}
              </h2>
              <p className="text-dark-400 text-sm">
                {stats?.nodes.online || 0} {t('adminDashboard.nodes.online').toLowerCase()} /{' '}
                {stats?.nodes.total || 0} {t('adminDashboard.stats.total').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-dark-400 flex items-center gap-1.5 text-xs">
              <span className="bg-success-500 h-2 w-2 rounded-full"></span>
              {stats?.nodes.online || 0}
            </span>
            <span className="text-dark-400 flex items-center gap-1.5 text-xs">
              <span className="bg-error-500 h-2 w-2 rounded-full"></span>
              {stats?.nodes.offline || 0}
            </span>
            <span className="text-dark-400 flex items-center gap-1.5 text-xs">
              <span className="bg-dark-500 h-2 w-2 rounded-full"></span>
              {stats?.nodes.disabled || 0}
            </span>
          </div>
        </div>

        {stats?.nodes.nodes && stats.nodes.nodes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(showAllNodes ? stats.nodes.nodes : stats.nodes.nodes.slice(0, 3)).map((node) => (
                <NodeCard
                  key={node.uuid}
                  node={node}
                  onRestart={handleRestartNode}
                  onToggle={handleToggleNode}
                  isLoading={actionLoading === node.uuid}
                />
              ))}
            </div>
            {stats.nodes.nodes.length > 3 && (
              <button
                onClick={() => setShowAllNodes(!showAllNodes)}
                className="bg-dark-700/50 text-dark-300 hover:bg-dark-700 hover:text-dark-100 mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 transition-colors"
              >
                <span
                  className={`transform transition-transform ${showAllNodes ? 'rotate-180' : ''}`}
                >
                  <ChevronDownIcon />
                </span>
                {showAllNodes
                  ? t('adminDashboard.nodes.hide', { count: stats.nodes.nodes.length - 3 })
                  : t('adminDashboard.nodes.showMore', { count: stats.nodes.nodes.length - 3 })}
              </button>
            )}
          </>
        ) : (
          <div className="text-dark-500 py-8 text-center">{t('adminDashboard.nodes.noNodes')}</div>
        )}
      </div>

      {/* Revenue and Subscriptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-warning-500/20 text-warning-400 rounded-lg p-2.5">
              <ChartBarIcon />
            </div>
            <div>
              <h2 className="text-dark-100 text-lg font-semibold">
                {t('adminDashboard.revenue.title')}
              </h2>
              <p className="text-dark-400 text-sm">{t('adminDashboard.revenue.last7Days')}</p>
            </div>
          </div>
          <RevenueChart data={stats?.revenue_chart || []} />
          <div className="border-dark-700 mt-4 grid grid-cols-2 gap-4 border-t pt-4">
            <StatCard
              label={t('adminDashboard.stats.incomeTotal')}
              value={`${formatAmount(stats?.financial.income_total_rubles || 0)} ${currencySymbol}`}
              icon={<BanknotesIcon className="h-5 w-5" />}
              tone="neutral"
            />
            <StatCard
              label={t('adminDashboard.stats.subscriptionIncome')}
              value={`${formatAmount(stats?.financial.subscription_income_rubles || 0)} ${currencySymbol}`}
              icon={<SparklesIcon className="h-5 w-5" />}
              tone="accent"
            />
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-accent-500/20 text-accent-400 rounded-lg p-2.5">
              <SparklesIcon />
            </div>
            <div>
              <h2 className="text-dark-100 text-lg font-semibold">
                {t('adminDashboard.subscriptions.title')}
              </h2>
              <p className="text-dark-400 text-sm">{t('adminDashboard.subscriptions.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label={t('adminDashboard.subscriptions.active')}
                value={stats?.subscriptions.active || 0}
                icon={<CheckCircleIcon className="h-5 w-5" />}
                tone="success"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.trial')}
                value={stats?.subscriptions.trial || 0}
                icon={<StarIcon className="h-5 w-5" />}
                tone="warning"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.paid')}
                value={stats?.subscriptions.paid || 0}
                icon={<CreditCardIcon className="h-5 w-5" />}
                tone="accent"
              />
              <StatCard
                label={t('adminDashboard.subscriptions.expired')}
                value={stats?.subscriptions.expired || 0}
                icon={<XCircleIcon className="h-5 w-5" />}
                tone="error"
              />
            </div>

            <div className="border-dark-700 border-t pt-4">
              <div className="text-dark-300 mb-3 text-sm font-medium">
                {t('adminDashboard.subscriptions.newSubscriptions')}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label={t('adminDashboard.subscriptions.today')}
                  value={stats?.subscriptions.purchased_today || 0}
                  icon={<ClockIcon className="h-5 w-5" />}
                  tone="neutral"
                />
                <StatCard
                  label={t('adminDashboard.subscriptions.week')}
                  value={stats?.subscriptions.purchased_week || 0}
                  icon={<CalendarBlankIcon className="h-5 w-5" />}
                  tone="neutral"
                />
                <StatCard
                  label={t('adminDashboard.subscriptions.month')}
                  value={stats?.subscriptions.purchased_month || 0}
                  icon={<CalendarIcon className="h-5 w-5" />}
                  tone="neutral"
                />
              </div>
            </div>

            {stats?.subscriptions.trial_to_paid_conversion !== undefined && (
              <div className="border-accent-500/20 bg-accent-500/10 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-dark-300 text-sm">
                    {t('adminDashboard.subscriptions.conversion')}
                  </span>
                  <span className="text-accent-400 text-lg font-bold">
                    {stats.subscriptions.trial_to_paid_conversion.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tariff Stats */}
      {stats?.tariff_stats && stats.tariff_stats.tariffs.length > 0 && (
        <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-success-500/20 text-success-400 rounded-lg p-2.5">
              <TagIcon />
            </div>
            <div>
              <h2 className="text-dark-100 text-lg font-semibold">
                {t('adminDashboard.tariffs.title')}
              </h2>
              <p className="text-dark-400 text-sm">{t('adminDashboard.tariffs.subtitle')}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-dark-700 border-b">
                  <th className="text-dark-500 px-2 py-3 text-left text-xs font-medium">
                    {t('adminDashboard.tariffs.tariffName')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-center text-xs font-medium">
                    {t('adminDashboard.tariffs.activeSubscriptions')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-center text-xs font-medium">
                    {t('adminDashboard.tariffs.trialSubscriptions')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-center text-xs font-medium">
                    {t('adminDashboard.tariffs.purchasedToday')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-center text-xs font-medium">
                    {t('adminDashboard.tariffs.purchasedWeek')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-center text-xs font-medium">
                    {t('adminDashboard.tariffs.purchasedMonth')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.tariff_stats.tariffs.map((tariff) => (
                  <tr
                    key={tariff.tariff_id}
                    className="border-dark-700/50 hover:bg-dark-800/50 border-b transition-colors"
                  >
                    <td className="px-2 py-3">
                      <span className="text-dark-100 font-medium">{tariff.tariff_name}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-success-400 font-semibold">
                        {tariff.active_subscriptions}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-warning-400 font-semibold">
                        {tariff.trial_subscriptions}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-dark-200">{tariff.purchased_today}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-dark-200">{tariff.purchased_week}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-dark-200">{tariff.purchased_month}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Extended Stats Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Referrers */}
        {referrers && (referrers.by_earnings.length > 0 || referrers.by_invited.length > 0) && (
          <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-accent-500/20 text-accent-400 rounded-lg p-2 sm:p-2.5">
                  <UsersIcon />
                </div>
                <div>
                  <h2 className="text-dark-100 text-base font-semibold sm:text-lg">
                    {t('adminDashboard.topReferrers.title')}
                  </h2>
                  <p className="text-dark-400 text-xs sm:text-sm">
                    {referrers.total_referrers}{' '}
                    {t('adminDashboard.topReferrers.stats', { count: referrers.total_referrals })}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setReferrersTab('earnings')}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  referrersTab === 'earnings'
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'bg-dark-700/50 text-dark-400 hover:text-dark-200'
                }`}
              >
                {t('adminDashboard.topReferrers.byEarnings')}
              </button>
              <button
                onClick={() => setReferrersTab('invited')}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  referrersTab === 'invited'
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'bg-dark-700/50 text-dark-400 hover:text-dark-200'
                }`}
              >
                {t('adminDashboard.topReferrers.byInvited')}
              </button>
            </div>

            <div className="space-y-2">
              {(referrersTab === 'earnings' ? referrers.by_earnings : referrers.by_invited)
                .slice(0, 5)
                .map((ref, idx) => (
                  <div
                    key={ref.user_id}
                    className="bg-dark-900/50 hover:bg-dark-800/50 flex items-center justify-between gap-2 rounded-lg p-2 transition-colors sm:p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                      <span className="bg-dark-700 text-dark-300 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-dark-100 truncate text-xs font-medium sm:text-sm">
                          {ref.display_name}
                        </div>
                        {ref.username && (
                          <div className="text-dark-500 truncate text-[10px] sm:text-xs">
                            @{ref.username}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {referrersTab === 'earnings' ? (
                        <>
                          <div className="text-success-400 text-xs font-semibold sm:text-sm">
                            {formatAmount(ref.earnings_total_kopeks / 100)} {currencySymbol}
                          </div>
                          <div className="text-dark-500 text-[10px] sm:text-xs">
                            {ref.invited_count} {t('adminDashboard.topReferrers.invites')}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-accent-400 text-xs font-semibold sm:text-sm">
                            {ref.invited_count} {t('adminDashboard.topReferrers.people')}
                          </div>
                          <div className="text-dark-500 text-[10px] sm:text-xs">
                            {formatAmount(ref.earnings_total_kopeks / 100)} {currencySymbol}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Period Stats */}
            <div className="border-dark-700 mt-4 grid grid-cols-3 gap-2 border-t pt-4 sm:gap-3">
              <StatCard
                label={t('adminDashboard.period.today')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_today_kopeks, 0) / 100,
                )} ${currencySymbol}`}
                icon={<ClockIcon className="h-5 w-5" />}
                tone="neutral"
              />
              <StatCard
                label={t('adminDashboard.period.week')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_week_kopeks, 0) / 100,
                )} ${currencySymbol}`}
                icon={<CalendarBlankIcon className="h-5 w-5" />}
                tone="neutral"
              />
              <StatCard
                label={t('adminDashboard.period.month')}
                value={`${formatAmount(
                  (referrersTab === 'earnings'
                    ? referrers.by_earnings
                    : referrers.by_invited
                  ).reduce((sum, r) => sum + r.earnings_month_kopeks, 0) / 100,
                )} ${currencySymbol}`}
                icon={<CalendarIcon className="h-5 w-5" />}
                tone="neutral"
              />
            </div>
          </div>
        )}

        {/* Top Campaigns */}
        {campaigns && campaigns.campaigns.length > 0 && (
          <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 sm:gap-3">
              <div className="bg-warning-500/20 text-warning-400 rounded-lg p-2 sm:p-2.5">
                <MegaphoneIcon />
              </div>
              <div>
                <h2 className="text-dark-100 text-base font-semibold sm:text-lg">
                  {t('adminDashboard.topCampaigns.title')}
                </h2>
                <p className="text-dark-400 text-xs sm:text-sm">
                  {campaigns.total_campaigns}{' '}
                  {t('adminDashboard.topCampaigns.stats', { count: campaigns.total_registrations })}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {campaigns.campaigns.slice(0, 5).map((campaign, idx) => (
                <div
                  key={campaign.id}
                  className="bg-dark-900/50 hover:bg-dark-800/50 flex items-center justify-between gap-2 rounded-lg p-2 transition-colors sm:p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <span className="bg-dark-700 text-dark-300 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-dark-100 truncate text-xs font-medium sm:text-sm">
                        {campaign.name}
                      </div>
                      <div className="text-dark-500 truncate text-[10px] sm:text-xs">
                        ?start={campaign.start_parameter}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-warning-400 text-xs font-semibold sm:text-sm">
                      {formatAmount(campaign.total_revenue_kopeks / 100)} {currencySymbol}
                    </div>
                    <div className="text-dark-500 text-[10px] sm:text-xs">
                      {campaign.registrations} · {campaign.conversion_rate.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-dark-700 mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-dark-400 text-xs sm:text-sm">
                  {t('adminDashboard.topCampaigns.total')}
                </span>
                <span className="text-warning-400 text-sm font-bold sm:text-base">
                  {formatAmount(campaigns.total_revenue_kopeks / 100)} {currencySymbol}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      {payments && payments.payments.length > 0 && (
        <div className="border-dark-700 bg-dark-800/30 rounded-xl border p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-success-500/20 text-success-400 rounded-lg p-2 sm:p-2.5">
                <BanknotesIcon />
              </div>
              <div>
                <h2 className="text-dark-100 text-base font-semibold sm:text-lg">
                  {t('adminDashboard.recentPayments.title')}
                </h2>
                <p className="text-dark-400 text-xs sm:text-sm">
                  {t('adminDashboard.recentPayments.today', {
                    amount: `${formatAmount(payments.total_today_kopeks / 100)} ${currencySymbol}`,
                  })}
                  <span className="hidden sm:inline">
                    {' '}
                    ·{' '}
                    {t('adminDashboard.recentPayments.week', {
                      amount: `${formatAmount(payments.total_week_kopeks / 100)} ${currencySymbol}`,
                    })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-dark-700 border-b">
                  <th className="text-dark-500 px-2 py-3 text-left text-xs font-medium">
                    {t('adminDashboard.table.user')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-left text-xs font-medium">
                    {t('adminDashboard.table.type')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-right text-xs font-medium">
                    {t('adminDashboard.table.amount')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-left text-xs font-medium">
                    {t('adminDashboard.table.method')}
                  </th>
                  <th className="text-dark-500 px-2 py-3 text-right text-xs font-medium">
                    {t('adminDashboard.table.date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.payments.slice(0, 10).map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-dark-700/50 hover:bg-dark-800/50 border-b transition-colors"
                  >
                    <td className="px-2 py-3">
                      <button
                        onClick={() => navigate(`/admin/users/${payment.user_id}`)}
                        className="text-left transition-colors hover:opacity-80"
                      >
                        <div className="text-dark-100 decoration-dark-600 hover:decoration-dark-400 text-sm font-medium underline underline-offset-2">
                          {payment.display_name}
                        </div>
                        {payment.username && (
                          <div className="text-dark-500 text-xs">@{payment.username}</div>
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          payment.type === 'deposit'
                            ? 'bg-success-500/20 text-success-400'
                            : 'bg-accent-500/20 text-accent-400'
                        }`}
                      >
                        {payment.type_display}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-dark-100 font-semibold">
                        {formatAmount(payment.amount_rubles)} {currencySymbol}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-dark-400 text-xs">{payment.payment_method || '-'}</span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-dark-400 text-xs">
                        {new Date(payment.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {payments.payments.slice(0, 10).map((payment) => (
              <div key={payment.id} className="bg-dark-900/50 rounded-lg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap ${
                        payment.type === 'deposit'
                          ? 'bg-success-500/20 text-success-400'
                          : 'bg-accent-500/20 text-accent-400'
                      }`}
                    >
                      {payment.type_display}
                    </span>
                    <button
                      onClick={() => navigate(`/admin/users/${payment.user_id}`)}
                      className="text-dark-100 decoration-dark-600 hover:decoration-dark-400 truncate text-sm font-medium underline underline-offset-2 transition-colors"
                    >
                      {payment.display_name}
                    </button>
                  </div>
                  <span className="text-dark-100 ml-2 text-sm font-semibold whitespace-nowrap">
                    {formatAmount(payment.amount_rubles)} {currencySymbol}
                  </span>
                </div>
                <div className="text-dark-500 flex items-center justify-between text-xs">
                  <span>{payment.payment_method || '-'}</span>
                  <span>
                    {new Date(payment.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Info */}
      {systemInfo && (
        <div className="border-dark-700 bg-dark-800 rounded-xl border p-4">
          <h3 className="text-dark-300 mb-3 text-sm font-semibold">
            {t('adminDashboard.systemInfo.title')}
          </h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.cabinet')}: </span>
              <span className="text-dark-200 font-medium">v{CABINET_VERSION}</span>
            </div>
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.bot')}: </span>
              <span className="text-dark-200 font-medium">v{systemInfo.bot_version}</span>
            </div>
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.python')}: </span>
              <span className="text-dark-200 font-medium">{systemInfo.python_version}</span>
            </div>
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.uptime')}: </span>
              <span className="text-dark-200 font-medium">
                {(() => {
                  const s = systemInfo.uptime_seconds;
                  const d = Math.floor(s / 86400);
                  const h = Math.floor((s % 86400) / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return [d > 0 && `${d}d`, h > 0 && `${h}h`, `${m}m`].filter(Boolean).join(' ');
                })()}
              </span>
            </div>
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.users')}: </span>
              <span className="text-dark-200 font-medium">{systemInfo.users_total}</span>
            </div>
            <div>
              <span className="text-dark-500">{t('adminDashboard.systemInfo.activeSubs')}: </span>
              <span className="text-dark-200 font-medium">{systemInfo.subscriptions_active}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
