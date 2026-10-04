import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { starsApi, type AdminStarsOrder, type StarsOrderStatus } from '../api/stars';
import { usePlatform } from '../platform/hooks/usePlatform';
import { usePermissionStore } from '@/store/permissions';
import { formatPrice } from '../utils/format';
import { getApiErrorMessage } from '../utils/api-error';
import { cn } from '../lib/utils';
import { StatCard } from '../components/stats';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { BackIcon, SearchIcon, StarIcon, WalletIcon } from '@/components/icons';
import { ChartBarIcon, CheckCircleIcon, SettingsIcon } from '@/components/icons/extended-icons';

const PAGE_SIZE = 30;
const PERIODS = [7, 30, 0] as const;
const STATUS_FILTERS: (StarsOrderStatus | '')[] = [
  '',
  'needs_review',
  'paid',
  'processing',
  'completed',
  'refunded',
  'failed',
];
const STATUS_TONE: Record<StarsOrderStatus, string> = {
  paid: 'bg-dark-700 text-dark-300',
  processing: 'bg-accent-500/15 text-accent-400',
  broadcasting: 'bg-accent-500/15 text-accent-400',
  completed: 'bg-success-500/15 text-success-400',
  failed: 'bg-error-500/15 text-error-400',
  refunded: 'bg-warning-500/15 text-warning-400',
  needs_review: 'bg-error-500/20 text-error-300',
};

function nanotonToTon(value: number | null): string {
  if (!value) return '—';
  return `${(value / 1e9).toFixed(4)} TON`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString(i18n.language) : '—';
}

type Action = 'retry' | 'refund' | 'complete';

function OrderCard({ order, canManage }: { order: AdminStarsOrder; canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(order.status === 'needs_review');
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [txHash, setTxHash] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: (kind: Action) => {
      if (kind === 'retry') return starsApi.retryOrder(order.id);
      if (kind === 'refund') return starsApi.refundOrder(order.id);
      return starsApi.completeOrder(order.id, txHash.trim());
    },
    onSuccess: () => {
      setConfirming(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-stars-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stars-stats'] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, t('admin.stars.actions.failed'))),
  });

  const available: Action[] = [];
  if (order.status === 'failed' || order.status === 'needs_review') available.push('retry');
  if (order.status === 'needs_review') available.push('complete');
  if (['paid', 'failed', 'needs_review'].includes(order.status)) available.push('refund');

  return (
    <div
      className={cn(
        'rounded-xl border bg-dark-800 p-4',
        order.status === 'needs_review' ? 'border-error-500/40' : 'border-dark-700',
      )}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-dark-100">
              <span className="text-dark-500">#{order.id}</span>
              <span className="truncate">
                {order.quantity} ⭐ → @{order.recipient_username}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-dark-400">
              {formatPrice(order.amount_kopeks, i18n.language)} · {order.user_display ?? '—'} ·{' '}
              {formatDate(order.created_at)}
            </div>
          </div>
          <span className={cn('rounded-lg px-2 py-1 text-xs', STATUS_TONE[order.status])}>
            {t(`stars.status.${order.status}`)}
          </span>
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-dark-700 pt-3 text-sm">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {(
              [
                ['source', t(`admin.stars.source.${order.source}`, order.source)],
                ['attempts', String(order.attempts)],
                ['cost', nanotonToTon(order.cost_nanoton)],
                ['recipientName', order.recipient_name ?? '—'],
                ['fragmentReq', order.fragment_req_id ?? '—'],
                ['txHash', order.ton_tx_hash ?? '—'],
                ['nextAttempt', formatDate(order.next_attempt_at)],
                ['updated', formatDate(order.updated_at)],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex min-w-0 justify-between gap-3">
                <dt className="shrink-0 text-dark-500">{t(`admin.stars.fields.${key}`)}</dt>
                <dd className="truncate text-right text-dark-200" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {order.last_error && (
            <div className="break-words rounded-lg bg-error-500/10 p-2.5 text-xs text-error-300">
              {order.last_error}
            </div>
          )}

          {order.status === 'needs_review' && (
            <p className="rounded-lg bg-warning-500/10 p-2.5 text-xs text-warning-300">
              {t('admin.stars.reviewHint')}
            </p>
          )}

          {canManage && available.length > 0 && (
            <div className="space-y-2">
              {confirming ? (
                <div className="space-y-2 rounded-lg border border-dark-700 p-3">
                  <p className="text-dark-200">{t(`admin.stars.confirm.${confirming}`)}</p>
                  {confirming === 'complete' && (
                    <input
                      value={txHash}
                      onChange={(event) => setTxHash(event.target.value)}
                      placeholder={t('admin.stars.fields.txHash')}
                      className="input w-full"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => action.mutate(confirming)}
                      disabled={action.isPending}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50',
                        confirming === 'refund' ? 'bg-warning-600' : 'bg-accent-500',
                      )}
                    >
                      {t('admin.stars.confirm.yes')}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="rounded-lg border border-dark-600 px-3 py-1.5 text-sm text-dark-300"
                    >
                      {t('admin.stars.confirm.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {available.map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setConfirming(kind)}
                      className="rounded-lg border border-dark-600 px-3 py-1.5 text-sm text-dark-200 hover:border-dark-500"
                    >
                      {t(`admin.stars.actions.${kind}`)}
                    </button>
                  ))}
                </div>
              )}
              {actionError && <p className="text-xs text-error-400">{actionError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletCard() {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const { data, error, isFetching } = useQuery({
    queryKey: ['admin-stars-wallet'],
    queryFn: starsApi.getWallet,
    enabled: requested,
    retry: false,
  });
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-dark-100">
          <WalletIcon className="h-5 w-5 text-accent-400" />
          {t('admin.stars.wallet.title')}
        </div>
        <button
          onClick={() => setRequested(true)}
          disabled={isFetching}
          className="rounded-lg border border-dark-600 px-3 py-1 text-xs text-dark-300 hover:border-dark-500 disabled:opacity-50"
        >
          {isFetching ? t('admin.stars.wallet.loading') : t('admin.stars.wallet.check')}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-error-400">
          {getApiErrorMessage(error, t('admin.stars.wallet.error'))}
        </p>
      ) : data ? (
        <div className="space-y-1 text-sm">
          <div className="text-lg font-semibold text-dark-100">
            {data.balance_ton.toFixed(4)} TON
          </div>
          <div className="break-all text-xs text-dark-500">{data.address}</div>
          {data.fragment_price_ton_per_100 && (
            <div className="text-dark-400">
              {t('admin.stars.wallet.price', { price: data.fragment_price_ton_per_100 })}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-dark-500">{t('admin.stars.wallet.hint')}</p>
      )}
    </div>
  );
}

export default function AdminStars() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();
  const canManage = usePermissionStore((state) => state.hasPermission('stars_shop:manage'));
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [status, setStatus] = useState<StarsOrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const { data: shopStatus } = useQuery({
    queryKey: ['admin-stars-status'],
    queryFn: starsApi.getAdminStatus,
  });
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stars-stats', period],
    queryFn: () => starsApi.getAdminStats(period || undefined),
  });
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-stars-orders', status, search, offset],
    queryFn: () =>
      starsApi.getAdminOrders({
        status: status || undefined,
        search: search.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    refetchInterval: 15000,
  });
  const orders = ordersData?.items ?? [];
  const total = ordersData?.total ?? 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-dark-100">{t('admin.stars.title')}</h1>
            <p className="text-sm text-dark-400">{t('admin.stars.subtitle')}</p>
          </div>
        </div>
        <Link
          to="/admin/settings?section=users_stars_shop"
          className="flex items-center justify-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-dark-200 hover:border-dark-600"
        >
          <SettingsIcon className="h-4 w-4" />
          {t('admin.stars.settings')}
        </Link>
      </div>

      {shopStatus &&
        (!shopStatus.enabled || shopStatus.dry_run || !shopStatus.fragment_configured) && (
          <div className="mb-4 space-y-1 rounded-xl border border-warning-500/30 bg-warning-500/10 p-3 text-sm text-warning-300">
            {!shopStatus.enabled && <p>{t('admin.stars.banner.disabled')}</p>}
            {shopStatus.dry_run && <p>{t('admin.stars.banner.dryRun')}</p>}
            {!shopStatus.fragment_configured && !shopStatus.dry_run && (
              <p>{t('admin.stars.banner.noFragment')}</p>
            )}
          </div>
        )}

      <div className="mb-3 flex gap-2">
        {PERIODS.map((value) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm',
              period === value ? 'bg-accent-500 text-on-accent' : 'bg-dark-800 text-dark-300',
            )}
          >
            {value ? t('admin.stars.period.days', { count: value }) : t('admin.stars.period.all')}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('admin.stars.stats.revenue')}
          value={stats ? formatPrice(stats.revenue_kopeks, i18n.language) : undefined}
          subValue={
            stats?.margin_kopeks != null
              ? t('admin.stars.stats.margin', {
                  value: formatPrice(stats.margin_kopeks, i18n.language),
                })
              : undefined
          }
          icon={<ChartBarIcon className="h-5 w-5" />}
          tone="success"
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.sold')}
          value={stats?.stars_sold}
          subValue={
            stats ? t('admin.stars.stats.orders', { count: stats.orders_completed }) : undefined
          }
          icon={<StarIcon className="h-5 w-5" />}
          tone="accent"
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.refunded')}
          value={stats ? formatPrice(stats.refunded_kopeks, i18n.language) : undefined}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          tone="warning"
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.review')}
          value={stats?.needs_review}
          icon={<SearchIcon className="h-5 w-5" />}
          tone={stats?.needs_review ? 'error' : 'neutral'}
          loading={statsLoading}
        />
      </div>

      <div className="mb-6">
        <WalletCard />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || 'all'}
              onClick={() => {
                setStatus(value);
                setOffset(0);
              }}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs',
                status === value ? 'bg-accent-500 text-on-accent' : 'bg-dark-800 text-dark-300',
              )}
            >
              {value ? t(`stars.status.${value}`) : t('admin.stars.filters.all')}
              {value === 'needs_review' && stats?.needs_review ? ` · ${stats.needs_review}` : ''}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          placeholder={t('admin.stars.filters.search')}
          className="input sm:ml-auto sm:w-64"
        />
      </div>

      {ordersLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center text-dark-400">{t('admin.stars.empty')}</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} canManage={canManage} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-dark-400">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-dark-700 px-3 py-1.5 disabled:opacity-40"
          >
            ←
          </button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-lg border border-dark-700 px-3 py-1.5 disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
