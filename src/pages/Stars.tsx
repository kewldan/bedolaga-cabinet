import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  starsApi,
  type StarsInsufficientBalance,
  type StarsOrder,
  type StarsOrderStatus,
  type StarsPurchaseResponse,
} from '../api/stars';
import { useAuthStore } from '../store/auth';
import { formatPrice } from '../utils/format';
import { getApiErrorMessage } from '../utils/api-error';
import { cn } from '../lib/utils';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { AnimatedCheckmark } from '@/components/ui/AnimatedCheckmark';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { StarIcon } from '@/components/icons';
import { useHaptic } from '@/platform';

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const ACTIVE_STATUSES: StarsOrderStatus[] = ['paid', 'processing', 'broadcasting'];

/** Ник без @ и t.me/ — так же, как нормализует сервер. */
export function normalizeRecipient(raw: string): string {
  let value = raw.trim();
  for (const prefix of ['https://t.me/', 'http://t.me/', 't.me/']) {
    if (value.toLowerCase().startsWith(prefix)) value = value.slice(prefix.length);
  }
  return value.replace(/^@+/, '').trim();
}

export function isValidRecipient(raw: string): boolean {
  return USERNAME_RE.test(normalizeRecipient(raw));
}

function newCheckoutKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STATUS_TONE: Record<StarsOrderStatus, string> = {
  paid: 'bg-dark-700 text-dark-300',
  processing: 'bg-accent-500/15 text-accent-400',
  broadcasting: 'bg-accent-500/15 text-accent-400',
  completed: 'bg-success-500/15 text-success-400',
  failed: 'bg-error-500/15 text-error-400',
  refunded: 'bg-warning-500/15 text-warning-400',
  needs_review: 'bg-warning-500/15 text-warning-400',
};

function OrderRow({ order }: { order: StarsOrder }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dark-800 bg-dark-900 p-3">
      <div className="min-w-0">
        <div className="truncate font-medium text-dark-100">
          {order.quantity} ⭐ → @{order.recipient_username}
        </div>
        <div className="text-xs text-dark-500">
          #{order.id} · {formatPrice(order.amount_kopeks, i18n.language)}
          {order.created_at && ` · ${new Date(order.created_at).toLocaleString(i18n.language)}`}
        </div>
      </div>
      <span className={cn('shrink-0 rounded-lg px-2 py-1 text-xs', STATUS_TONE[order.status])}>
        {t(`stars.status.${order.status}`)}
      </span>
    </div>
  );
}

export default function Stars() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const user = useAuthStore((state) => state.user);

  const [target, setTarget] = useState<'self' | 'other'>(user?.username ? 'self' : 'other');
  const [otherRecipient, setOtherRecipient] = useState('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [customQuantity, setCustomQuantity] = useState('');
  // Ключ идемпотентности живёт, пока не сменились получатель и количество: повтор
  // после сбоя сети идёт тем же ключом, и сервер вернёт уже созданный заказ.
  const checkout = useRef<{ signature: string; key: string } | null>(null);
  const [missingKopeks, setMissingKopeks] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidOrder, setPaidOrder] = useState<StarsPurchaseResponse | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['stars-config'],
    queryFn: starsApi.getConfig,
    staleTime: 30000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['stars-orders'],
    queryFn: () => starsApi.getOrders({ limit: 20 }),
    // Пока есть невыданные заказы — обновляем статус сами.
    refetchInterval: (query) =>
      query.state.data?.items.some((order) => ACTIVE_STATUSES.includes(order.status))
        ? 4000
        : false,
  });
  const orders = ordersData?.items ?? [];

  useEffect(() => {
    if (config && quantity === null && config.presets.length > 0) {
      setQuantity(config.presets[Math.min(1, config.presets.length - 1)]);
    }
  }, [config, quantity]);

  const recipient = target === 'self' ? (user?.username ?? '') : normalizeRecipient(otherRecipient);
  const recipientValid = USERNAME_RE.test(recipient);
  const quantityValid =
    !!config &&
    quantity !== null &&
    quantity >= config.min_quantity &&
    quantity <= config.max_quantity;
  const total = config && quantity !== null ? quantity * config.price_per_star_kopeks : 0;
  const balance = paidOrder?.balance_kopeks ?? config?.balance_kopeks ?? 0;

  const signature = `${recipient.toLowerCase()}|${quantity ?? ''}`;
  const checkoutKeyFor = (sig: string): string => {
    if (checkout.current?.signature !== sig) {
      checkout.current = { signature: sig, key: newCheckoutKey() };
    }
    return checkout.current.key;
  };

  // Другие параметры — прошлые ошибки и недостача к ним уже не относятся.
  // biome-ignore lint/correctness/useExhaustiveDependencies: сброс именно на смену параметров покупки
  useEffect(() => {
    setMissingKopeks(null);
    setError(null);
  }, [signature]);

  const purchase = useMutation({
    mutationFn: () =>
      starsApi.purchase({
        quantity: quantity ?? 0,
        recipient_username: recipient,
        expected_total_kopeks: total,
        idempotency_key: checkoutKeyFor(signature),
      }),
    onSuccess: (data) => {
      haptic.notification('success');
      setPaidOrder(data);
      setMissingKopeks(null);
      queryClient.invalidateQueries({ queryKey: ['stars-orders'] });
      queryClient.invalidateQueries({ queryKey: ['stars-config'] });
    },
    onError: (err) => {
      haptic.notification('error');
      if (axios.isAxiosError(err) && err.response?.status === 402) {
        const detail = err.response.data?.detail as StarsInsufficientBalance;
        setMissingKopeks(detail.missing_kopeks);
        return;
      }
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['stars-config'] });
        setError(t('stars.errors.priceChanged'));
        return;
      }
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        setError(t('stars.errors.invalid'));
        return;
      }
      setError(getApiErrorMessage(err, t('stars.errors.generic')));
    },
  });

  const selectPreset = (value: number) => {
    haptic.impact('light');
    setCustomQuantity('');
    setQuantity(value);
  };

  const onCustomChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    setCustomQuantity(digits);
    setQuantity(digits ? Number(digits) : null);
  };

  const startOver = () => {
    setPaidOrder(null);
    checkout.current = null;
  };

  const presets = useMemo(() => config?.presets ?? [], [config]);

  if (isLoading) {
    return (
      <SkeletonGroup className="space-y-4">
        <Skeleton variant="card" count={3} className="h-28" />
      </SkeletonGroup>
    );
  }

  if (!config?.available) {
    return (
      <div className="animate-fade-in py-16 text-center">
        <StarIcon className="mx-auto mb-3 h-10 w-10 text-dark-500" />
        <p className="text-dark-400">{t('stars.unavailable')}</p>
        <button onClick={() => navigate('/')} className="btn-secondary mt-6">
          {t('stars.toHome')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-dark-100">
          <StarIcon filled className="h-6 w-6 text-warning-400" />
          {t('stars.title')}
        </h1>
        <p className="text-sm text-dark-400">
          {t('stars.subtitle', { price: formatPrice(config.price_per_star_kopeks, i18n.language) })}
        </p>
      </div>

      {paidOrder ? (
        <div className="rounded-2xl border border-dark-800 bg-dark-900 p-6 text-center">
          <div className="mb-3 flex justify-center">
            <AnimatedCheckmark />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-dark-100">
            {t('stars.paid.title', { id: paidOrder.order.id })}
          </h2>
          <p className="mb-5 text-sm text-dark-400">
            {t('stars.paid.text', {
              quantity: paidOrder.order.quantity,
              recipient: paidOrder.order.recipient_username,
            })}
          </p>
          <button onClick={startOver} className="btn-primary w-full">
            {t('stars.paid.again')}
          </button>
        </div>
      ) : (
        <>
          {/* Получатель */}
          <section className="rounded-2xl border border-dark-800 bg-dark-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-dark-300">{t('stars.recipient.title')}</h2>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!user?.username}
                onClick={() => setTarget('self')}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  target === 'self'
                    ? 'border-accent-500 bg-accent-500/10 text-dark-100'
                    : 'border-dark-700 text-dark-300 hover:border-dark-600',
                  !user?.username && 'cursor-not-allowed opacity-50',
                )}
              >
                {user?.username
                  ? t('stars.recipient.self', { username: user.username })
                  : t('stars.recipient.selfNoUsername')}
              </button>
              <button
                type="button"
                onClick={() => setTarget('other')}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  target === 'other'
                    ? 'border-accent-500 bg-accent-500/10 text-dark-100'
                    : 'border-dark-700 text-dark-300 hover:border-dark-600',
                )}
              >
                {t('stars.recipient.other')}
              </button>
            </div>
            {target === 'other' && (
              <div>
                <input
                  value={otherRecipient}
                  onChange={(event) => setOtherRecipient(event.target.value)}
                  placeholder="@username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="input w-full"
                />
                <p
                  className={cn(
                    'mt-1.5 text-xs',
                    otherRecipient && !recipientValid ? 'text-error-400' : 'text-dark-500',
                  )}
                >
                  {otherRecipient && !recipientValid
                    ? t('stars.recipient.invalid')
                    : t('stars.recipient.hint')}
                </p>
              </div>
            )}
          </section>

          {/* Количество */}
          <section className="rounded-2xl border border-dark-800 bg-dark-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-dark-300">{t('stars.quantity.title')}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectPreset(value)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    quantity === value && !customQuantity
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-dark-700 hover:border-dark-600',
                  )}
                >
                  <div className="font-semibold text-dark-100">{value} ⭐</div>
                  <div className="text-xs text-dark-400">
                    {formatPrice(value * config.price_per_star_kopeks, i18n.language)}
                  </div>
                </button>
              ))}
            </div>
            <input
              value={customQuantity}
              onChange={(event) => onCustomChange(event.target.value)}
              inputMode="numeric"
              placeholder={t('stars.quantity.custom', {
                min: config.min_quantity,
                max: config.max_quantity,
              })}
              className="input mt-3 w-full"
            />
            {customQuantity && !quantityValid && (
              <p className="mt-1.5 text-xs text-error-400">
                {t('stars.quantity.invalid', {
                  min: config.min_quantity,
                  max: config.max_quantity,
                })}
              </p>
            )}
          </section>

          {/* Итог */}
          <section className="rounded-2xl border border-dark-800 bg-dark-900 p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-dark-400">{t('stars.summary.total')}</span>
                <span className="text-lg font-semibold text-dark-100">
                  {quantityValid ? formatPrice(total, i18n.language) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-dark-400">{t('stars.summary.balance')}</span>
                <span className="text-dark-200">{formatPrice(balance, i18n.language)}</span>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
                {error}
              </div>
            )}

            {missingKopeks !== null && (
              <InsufficientBalancePrompt
                className="mt-3"
                missingAmountKopeks={missingKopeks}
                message={t('stars.insufficient', { quantity, recipient })}
              />
            )}

            <button
              onClick={() => purchase.mutate()}
              disabled={!recipientValid || !quantityValid || purchase.isPending}
              className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {purchase.isPending
                ? t('stars.summary.paying')
                : quantityValid
                  ? t('stars.summary.pay', { total: formatPrice(total, i18n.language) })
                  : t('stars.summary.payDisabled')}
            </button>
            <p className="mt-2 text-center text-xs text-dark-500">{t('stars.summary.note')}</p>
          </section>
        </>
      )}

      {orders.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-dark-300">{t('stars.orders.title')}</h2>
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
