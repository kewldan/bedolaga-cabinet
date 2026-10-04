import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  starsApi,
  type AdminStarsOrder,
  type AdminStarsStatus,
  type StarsOrderStatus,
} from '../api/stars';
import { usePlatform } from '../platform/hooks/usePlatform';
import { usePermissionStore } from '@/store/permissions';
import { formatPrice } from '../utils/format';
import { getApiErrorMessage } from '../utils/api-error';
import { copyToClipboard } from '../utils/clipboard';
import { cn } from '../lib/utils';
import { StatCard } from '../components/stats';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import {
  BackIcon,
  CheckIcon,
  CopyIcon,
  SearchIcon,
  StarIcon,
  WalletIcon,
} from '@/components/icons';
import {
  ChartBarIcon,
  ExternalLinkIcon,
  SettingsIcon,
  TrendUpIcon,
} from '@/components/icons/extended-icons';

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

export const tonscanTxUrl = (hash: string) => `https://tonscan.org/tx/${hash}`;
export const tonviewerTxUrl = (hash: string) => `https://tonviewer.com/transaction/${hash}`;
export const tonscanAddressUrl = (address: string) => `https://tonscan.org/address/${address}`;

/** Хеш настоящего перевода; у тестового режима — заглушка «dry-run-…», открывать нечего. */
export function isRealTx(hash: string | null | undefined): hash is string {
  return !!hash && !hash.startsWith('dry-run');
}

function formatTon(nanoton: number | null | undefined, digits = 4): string {
  if (!nanoton) return '—';
  return `${(nanoton / 1e9).toFixed(digits)} TON`;
}

function formatPercent(value: number, lang: string): string {
  return `${value.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString(i18n.language) : '—';
}

function shorten(value: string, head = 8, tail = 6): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function secondsBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

/** Себестоимость заказа в копейках: по курсу на момент выдачи, иначе — оценка по текущему. */
export function orderCost(
  order: AdminStarsOrder,
  currentRateKopeks: number | null | undefined,
): { kopeks: number; estimated: boolean } | null {
  if (order.cost_kopeks != null) return { kopeks: order.cost_kopeks, estimated: false };
  if (order.cost_nanoton && currentRateKopeks) {
    return { kopeks: Math.round((order.cost_nanoton * currentRateKopeks) / 1e9), estimated: true };
  }
  return null;
}

function useOpenExternal() {
  const { openLink } = usePlatform();
  return (url: string) => openLink(url, { tryInstantView: false });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() =>
        copyToClipboard(value).then(
          () => setCopied(true),
          () => undefined,
        )
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-dark-600 px-2.5 py-1 text-xs text-dark-200 hover:border-dark-500"
      aria-label={label}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-success-400" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {copied ? i18n.t('common.copied') : label}
    </button>
  );
}

function ExternalButton({ url, label }: { url: string; label: string }) {
  const open = useOpenExternal();
  return (
    <button
      type="button"
      onClick={() => open(url)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dark-600 px-2.5 py-1 text-xs text-dark-200 hover:border-dark-500"
    >
      <ExternalLinkIcon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-dark-900/40 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-dark-500">{title}</div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="shrink-0 text-dark-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-dark-200" title={title}>
        {children}
      </dd>
    </div>
  );
}

type Action = 'retry' | 'refund' | 'complete';

function OrderCard({
  order,
  canManage,
  currentRateKopeks,
  defaultOpen,
}: {
  order: AdminStarsOrder;
  canManage: boolean;
  currentRateKopeks: number | null | undefined;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openTelegramLink } = usePlatform();
  const [expanded, setExpanded] = useState(defaultOpen || order.status === 'needs_review');
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

  const lang = i18n.language;
  const cost = orderCost(order, currentRateKopeks);
  const margin = cost && order.status === 'completed' ? order.amount_kopeks - cost.kopeks : null;
  const marginPercent =
    margin != null && order.amount_kopeks ? (margin / order.amount_kopeks) * 100 : null;
  const pricePerStar = order.quantity ? Math.round(order.amount_kopeks / order.quantity) : 0;
  const deliverySeconds = secondsBetween(order.created_at, order.completed_at);
  const realTx = isRealTx(order.ton_tx_hash) ? order.ton_tx_hash : null;

  return (
    <div
      className={cn(
        'rounded-xl border bg-dark-800 p-4',
        order.status === 'needs_review' ? 'border-error-500/40' : 'border-dark-700',
      )}
    >
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-dark-100">
              <span className="text-dark-500">#{order.id}</span>
              <span className="truncate">
                {order.quantity} ⭐ → @{order.recipient_username}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-dark-400">
              {formatPrice(order.amount_kopeks, lang)} · {order.user_display ?? '—'} ·{' '}
              {formatDate(order.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {margin != null && (
              <span
                className={cn(
                  'rounded-lg px-2 py-1 text-xs',
                  margin >= 0
                    ? 'bg-success-500/10 text-success-400'
                    : 'bg-error-500/10 text-error-400',
                )}
              >
                {margin >= 0 ? '+' : ''}
                {formatPrice(margin, lang)}
              </span>
            )}
            <span className={cn('rounded-lg px-2 py-1 text-xs', STATUS_TONE[order.status])}>
              {t(`stars.status.${order.status}`)}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-dark-700 pt-3 text-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Section title={t('admin.stars.sections.money')}>
              <Row label={t('admin.stars.fields.paid')}>
                {formatPrice(order.amount_kopeks, lang)}
              </Row>
              <Row label={t('admin.stars.fields.pricePerStar')}>
                {formatPrice(pricePerStar, lang)}
              </Row>
              <Row label={t('admin.stars.fields.cost')}>
                {formatTon(order.cost_nanoton)}
                {cost && (
                  <span className="text-dark-400">
                    {' '}
                    ≈ {formatPrice(cost.kopeks, lang)}
                    {cost.estimated ? '*' : ''}
                  </span>
                )}
              </Row>
              {margin != null && (
                <Row label={t('admin.stars.fields.margin')}>
                  <span className={margin >= 0 ? 'text-success-400' : 'text-error-400'}>
                    {margin >= 0 ? '+' : ''}
                    {formatPrice(margin, lang)}
                    {marginPercent != null && ` · ${formatPercent(marginPercent, lang)}`}
                  </span>
                </Row>
              )}
              {order.ton_rate_kopeks ? (
                <Row label={t('admin.stars.fields.tonRate')}>
                  {formatPrice(order.ton_rate_kopeks, lang)}
                </Row>
              ) : null}
              {cost?.estimated && (
                <p className="text-xs text-dark-500">{t('admin.stars.estimatedCost')}</p>
              )}
            </Section>

            <Section title={t('admin.stars.sections.people')}>
              <Row label={t('admin.stars.fields.buyer')}>
                {order.user_id != null ? (
                  <Link
                    to={`/admin/users/${order.user_id}`}
                    className="text-accent-400 hover:underline"
                  >
                    {order.user_display ?? `#${order.user_id}`}
                  </Link>
                ) : (
                  '—'
                )}
              </Row>
              {order.user_telegram_id ? (
                <Row label="Telegram ID">
                  <span className="font-mono">{order.user_telegram_id}</span>
                </Row>
              ) : null}
              <Row label={t('admin.stars.fields.recipient')}>
                <button
                  type="button"
                  onClick={() => openTelegramLink(`https://t.me/${order.recipient_username}`)}
                  className="text-accent-400 hover:underline"
                >
                  @{order.recipient_username}
                </button>
              </Row>
              <Row label={t('admin.stars.fields.recipientName')} title={order.recipient_name ?? ''}>
                {order.recipient_name ?? '—'}
              </Row>
              {order.user_username &&
                order.user_username.toLowerCase() === order.recipient_username.toLowerCase() && (
                  <p className="text-xs text-dark-500">{t('admin.stars.forSelf')}</p>
                )}
            </Section>

            <Section title={t('admin.stars.sections.delivery')}>
              <Row label={t('admin.stars.fields.source')}>
                {t(`admin.stars.source.${order.source}`, order.source)}
              </Row>
              <Row label={t('admin.stars.fields.attempts')}>{order.attempts}</Row>
              <Row label={t('admin.stars.fields.created')}>{formatDate(order.created_at)}</Row>
              {order.completed_at && (
                <Row label={t('admin.stars.fields.completed')}>
                  {formatDate(order.completed_at)}
                  {deliverySeconds != null && (
                    <span className="text-dark-400">
                      {' '}
                      · {t('admin.stars.deliveredIn', { seconds: deliverySeconds })}
                    </span>
                  )}
                </Row>
              )}
              {order.refunded_at && (
                <Row label={t('admin.stars.fields.refunded')}>{formatDate(order.refunded_at)}</Row>
              )}
              {order.status === 'paid' && order.next_attempt_at && (
                <Row label={t('admin.stars.fields.nextAttempt')}>
                  {formatDate(order.next_attempt_at)}
                </Row>
              )}
              <Row label={t('admin.stars.fields.updated')}>{formatDate(order.updated_at)}</Row>
            </Section>

            <Section title={t('admin.stars.sections.chain')}>
              <Row label={t('admin.stars.fields.txHash')} title={order.ton_tx_hash ?? ''}>
                <span className="font-mono">
                  {order.ton_tx_hash ? shorten(order.ton_tx_hash) : '—'}
                </span>
              </Row>
              {realTx && (
                <div className="flex flex-wrap justify-end gap-1.5 pb-1">
                  <ExternalButton url={tonscanTxUrl(realTx)} label="Tonscan" />
                  <ExternalButton url={tonviewerTxUrl(realTx)} label="Tonviewer" />
                  <CopyButton value={realTx} label={t('admin.stars.copyHash')} />
                </div>
              )}
              <Row label={t('admin.stars.fields.fragmentReq')} title={order.fragment_req_id ?? ''}>
                <span className="font-mono">
                  {order.fragment_req_id ? shorten(order.fragment_req_id) : '—'}
                </span>
              </Row>
              {order.fragment_req_id && (
                <div className="flex justify-end">
                  <CopyButton value={order.fragment_req_id} label={t('admin.stars.copyReq')} />
                </div>
              )}
            </Section>
          </div>

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

function WalletCard({ shopStatus }: { shopStatus: AdminStarsStatus | undefined }) {
  const { t } = useTranslation();
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['admin-stars-wallet'],
    queryFn: starsApi.getWallet,
    enabled: !!shopStatus?.fragment_configured,
    retry: false,
    staleTime: 60_000,
  });
  const lang = i18n.language;
  const pricePer100 = data?.fragment_price_ton_per_100
    ? Number(data.fragment_price_ton_per_100)
    : 0;
  const starsLeft =
    data && pricePer100 > 0 ? Math.floor((data.balance_ton / pricePer100) * 100) : null;
  const lowThreshold = shopStatus?.wallet_low_stars ?? 0;
  const isLow = starsLeft != null && lowThreshold > 0 && starsLeft < lowThreshold;

  return (
    <div
      className={cn(
        'rounded-xl border bg-dark-800 p-4',
        isLow ? 'border-warning-500/40' : 'border-dark-700',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-dark-100">
          <WalletIcon className="h-5 w-5 text-accent-400" />
          {t('admin.stars.wallet.title')}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching || !shopStatus?.fragment_configured}
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
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-semibold text-dark-100">
              {data.balance_ton.toFixed(4)} TON
            </span>
            {data.ton_rate_kopeks ? (
              <span className="text-dark-400">
                ≈ {formatPrice(Math.round(data.balance_ton * data.ton_rate_kopeks), lang)}
              </span>
            ) : null}
          </div>
          {starsLeft != null && (
            <div className={isLow ? 'text-warning-300' : 'text-dark-300'}>
              {t(isLow ? 'admin.stars.wallet.lowStars' : 'admin.stars.wallet.starsLeft', {
                count: starsLeft,
                value: starsLeft.toLocaleString(lang),
              })}
            </div>
          )}
          {data.fragment_price_ton_per_100 && (
            <div className="text-dark-400">
              {t('admin.stars.wallet.price', { price: data.fragment_price_ton_per_100 })}
            </div>
          )}
          <div className="break-all font-mono text-xs text-dark-500">{data.address}</div>
          <div className="flex flex-wrap gap-1.5">
            <ExternalButton url={tonscanAddressUrl(data.address)} label="Tonscan" />
            <CopyButton value={data.address} label={t('admin.stars.copyAddress')} />
          </div>
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
  const [searchParams] = useSearchParams();
  const { capabilities } = usePlatform();
  const canManage = usePermissionStore((state) => state.hasPermission('stars_shop:manage'));
  // ?order=ID — ссылка из уведомления в Telegram: сразу ищем и раскрываем этот заказ.
  const focusOrderId = Number(searchParams.get('order')) || null;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [status, setStatus] = useState<StarsOrderStatus | ''>('');
  const [search, setSearch] = useState(focusOrderId ? `#${focusOrderId}` : '');
  const [offset, setOffset] = useState(0);
  const lang = i18n.language;

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
  const currentRate = stats?.ton_rate_kopeks ?? shopStatus?.ton_rate_kopeks ?? null;
  const marginPercent =
    stats?.margin_kopeks != null && stats.revenue_kopeks
      ? (stats.margin_kopeks / stats.revenue_kopeks) * 100
      : null;

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
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
        {currentRate ? (
          <span className="text-xs text-dark-400">
            {t('admin.stars.tonRate', {
              value: formatPrice(currentRate, lang),
              source: t(
                `admin.stars.rateSource.${stats?.ton_rate_source ?? shopStatus?.ton_rate_source ?? 'manual'}`,
              ),
            })}
          </span>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('admin.stars.stats.revenue')}
          value={stats ? formatPrice(stats.revenue_kopeks, lang) : undefined}
          subValue={
            stats ? t('admin.stars.stats.orders', { count: stats.orders_completed }) : undefined
          }
          icon={<ChartBarIcon className="h-5 w-5" />}
          tone="success"
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.marginTitle')}
          value={
            stats
              ? stats.margin_kopeks != null
                ? `${stats.margin_kopeks >= 0 ? '+' : ''}${formatPrice(stats.margin_kopeks, lang)}`
                : '—'
              : undefined
          }
          subValue={
            stats
              ? stats.margin_kopeks != null && stats.cost_kopeks != null
                ? t('admin.stars.stats.marginSub', {
                    percent: formatPercent(marginPercent ?? 0, lang),
                    cost: formatPrice(stats.cost_kopeks, lang),
                  })
                : t('admin.stars.stats.noRate')
              : undefined
          }
          icon={<TrendUpIcon className="h-5 w-5" />}
          tone={stats?.margin_kopeks != null && stats.margin_kopeks < 0 ? 'error' : 'accent'}
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.sold')}
          value={stats?.stars_sold.toLocaleString(lang)}
          subValue={
            stats?.stars_sold
              ? t('admin.stars.stats.avgPrice', {
                  value: formatPrice(Math.round(stats.revenue_kopeks / stats.stars_sold), lang),
                })
              : undefined
          }
          icon={<StarIcon className="h-5 w-5" />}
          tone="accent"
          loading={statsLoading}
        />
        <StatCard
          label={t('admin.stars.stats.review')}
          value={stats?.needs_review}
          subValue={
            stats
              ? t('admin.stars.stats.refundedSub', {
                  value: formatPrice(stats.refunded_kopeks, lang),
                })
              : undefined
          }
          icon={<SearchIcon className="h-5 w-5" />}
          tone={stats?.needs_review ? 'error' : 'neutral'}
          loading={statsLoading}
        />
      </div>

      <div className="mb-6">
        <WalletCard shopStatus={shopStatus} />
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
            <OrderCard
              key={order.id}
              order={order}
              canManage={canManage}
              currentRateKopeks={currentRate}
              defaultOpen={order.id === focusOrderId}
            />
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
