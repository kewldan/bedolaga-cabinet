// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ruLocale from '@/locales/ru.json';

/**
 * Админка звёзд. Заказ «на проверке» — единственный, где ошибка админа стоит денег:
 * повтор после ушедшего перевода оплатит звёзды второй раз. Поэтому такой заказ
 * раскрыт сразу, объясняет, что проверить, и каждое действие — через подтверждение.
 */

function resolveRu(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  return typeof value === 'string' ? value : undefined;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> | string) =>
      (resolveRu(key) ?? (typeof options === 'string' ? options : key)).replace(
        /{{(\w+)}}/g,
        (_m, name) => String(typeof options === 'object' ? (options?.[name] ?? '') : ''),
      ),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const platform = vi.hoisted(() => ({ openLink: vi.fn(), openTelegramLink: vi.fn() }));
vi.mock('../platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasBackButton: true }, ...platform }),
}));

const clipboard = vi.hoisted(() => ({ copyToClipboard: vi.fn(() => Promise.resolve()) }));
vi.mock('../utils/clipboard', () => clipboard);

const permissions = vi.hoisted(() => ({ manage: true }));
vi.mock('@/store/permissions', () => ({
  usePermissionStore: (selector: (state: unknown) => unknown) =>
    selector({ hasPermission: () => permissions.manage }),
}));

const api = vi.hoisted(() => ({
  getAdminStatus: vi.fn(),
  getAdminStats: vi.fn(),
  getAdminOrders: vi.fn(),
  getWallet: vi.fn(),
  retryOrder: vi.fn(),
  refundOrder: vi.fn(),
  completeOrder: vi.fn(),
}));
vi.mock('../api/stars', () => ({ starsApi: api }));

const reviewOrder = {
  id: 42,
  status: 'needs_review',
  quantity: 500,
  amount_kopeks: 80000,
  recipient_username: 'durov',
  recipient_name: null,
  created_at: null,
  completed_at: null,
  refunded_at: null,
  user_id: 1,
  user_display: '@buyer',
  source: 'bot',
  attempts: 1,
  last_error: 'timeout',
  fragment_req_id: 'REQ',
  ton_tx_hash: null,
  cost_nanoton: 1_500_000_000,
  next_attempt_at: null,
  updated_at: null,
};

const TX = 'ce15694ba402224da7033035dccc33f77ba4a9db690a3dd8b1c8442103dd1ffb';
const WALLET = 'UQBSl6VKWo2-sSoKohxeikg3XeH9Goi86fY19nyh6usdchif';

const completedOrder = {
  ...reviewOrder,
  id: 7,
  status: 'completed',
  quantity: 50,
  amount_kopeks: 7000,
  recipient_username: 'kewldan',
  recipient_name: 'Даниил',
  user_display: '@kewldan',
  user_username: 'kewldan',
  user_telegram_id: 787751346,
  last_error: null,
  fragment_req_id: 'REQ-7',
  ton_tx_hash: TX,
  cost_nanoton: 491_500_000,
  ton_rate_kopeks: 12774,
  cost_kopeks: 6278,
  created_at: '2026-10-04T14:23:47Z',
  completed_at: '2026-10-04T14:23:51Z',
};

async function renderPage(url = '/admin/stars') {
  const { default: AdminStars } = await import('./AdminStars');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AdminStars />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  permissions.manage = true;
  api.getAdminStatus.mockResolvedValue({
    enabled: true,
    dry_run: true,
    fragment_configured: false,
    price_per_star_kopeks: 160,
    min_quantity: 50,
    max_quantity: 10000,
    presets: [],
    ton_rate_kopeks: 12774,
    ton_rate_source: 'tonapi',
    wallet_low_stars: 1000,
  });
  api.getWallet.mockResolvedValue({
    address: WALLET,
    state: 'active',
    balance_ton: 13.8466,
    fragment_price_ton_per_100: '0.9844',
    ton_rate_kopeks: 12774,
  });
  api.getAdminStats.mockResolvedValue({
    orders_total: 1,
    orders_completed: 0,
    stars_sold: 0,
    revenue_kopeks: 0,
    refunded_kopeks: 0,
    cost_nanoton: 0,
    margin_kopeks: null,
    by_status: { needs_review: 1 },
    needs_review: 1,
  });
  api.getAdminOrders.mockResolvedValue({ items: [reviewOrder], total: 1, limit: 30, offset: 0 });
  api.retryOrder.mockResolvedValue({ ...reviewOrder, status: 'paid' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('админка звёзд', () => {
  it('предупреждает о тестовом режиме', async () => {
    await renderPage();
    expect(await screen.findByText(/Тестовый режим/)).toBeTruthy();
  });

  it('заказ на проверке раскрыт и объясняет, что проверить', async () => {
    await renderPage();
    expect(await screen.findByText(/Проверьте исходящие переводы кошелька/)).toBeTruthy();
    expect(screen.getByText('1.5000 TON')).toBeTruthy();
  });

  it('повтор — только после подтверждения', async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    expect(api.retryOrder).not.toHaveBeenCalled();
    expect(screen.getByText(/звёзды оплатятся дважды/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await waitFor(() => expect(api.retryOrder).toHaveBeenCalledWith(42));
  });

  it('без права управления действий нет', async () => {
    permissions.manage = false;
    await renderPage();
    await screen.findByText(/Проверьте исходящие переводы кошелька/);
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Вернуть деньги' })).toBeNull();
  });
});

describe('выполненный заказ', () => {
  beforeEach(() => {
    api.getAdminOrders.mockResolvedValue({
      items: [completedOrder],
      total: 1,
      limit: 30,
      offset: 0,
    });
  });

  it('ссылка из Telegram ищет и раскрывает заказ', async () => {
    await renderPage('/admin/stars?order=7');
    await waitFor(() =>
      expect(api.getAdminOrders).toHaveBeenCalledWith(expect.objectContaining({ search: '#7' })),
    );
    expect(await screen.findByText('Tonscan')).toBeTruthy();
    expect(screen.getByText('787751346')).toBeTruthy();
    expect(screen.getByText('Покупка себе')).toBeTruthy();
    expect(screen.getByText(/за 4 с/)).toBeTruthy();
  });

  it('открывает перевод в обозревателях и копирует хеш', async () => {
    await renderPage('/admin/stars?order=7');
    fireEvent.click(await screen.findByText('Tonscan'));
    expect(platform.openLink).toHaveBeenCalledWith(`https://tonscan.org/tx/${TX}`, {
      tryInstantView: false,
    });
    fireEvent.click(screen.getByText('Tonviewer'));
    expect(platform.openLink).toHaveBeenCalledWith(`https://tonviewer.com/transaction/${TX}`, {
      tryInstantView: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Хеш' }));
    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(TX);
    fireEvent.click(screen.getByRole('button', { name: '@kewldan' }));
    expect(platform.openTelegramLink).toHaveBeenCalledWith('https://t.me/kewldan');
  });

  it('тестовый заказ без ссылок на блокчейн', async () => {
    api.getAdminOrders.mockResolvedValue({
      items: [
        { ...completedOrder, ton_tx_hash: 'dry-run-tx-7', cost_nanoton: 0, cost_kopeks: null },
      ],
      total: 1,
      limit: 30,
      offset: 0,
    });
    await renderPage('/admin/stars?order=7');
    await screen.findByText('Блокчейн');
    expect(screen.queryByText('Tonscan')).toBeNull();
  });
});

describe('кошелёк и себестоимость', () => {
  it('показывает запас звёзд и предупреждает, когда кошелёк почти пуст', async () => {
    api.getAdminStatus.mockResolvedValue({
      ...(await api.getAdminStatus()),
      dry_run: false,
      fragment_configured: true,
    });
    api.getWallet.mockResolvedValue({
      address: WALLET,
      state: 'active',
      balance_ton: 5,
      fragment_price_ton_per_100: '1.0000',
      ton_rate_kopeks: 12774,
    });
    await renderPage();
    expect(await screen.findByText(/Хватит только на 500 ⭐/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Адрес' }));
    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(WALLET);
  });

  it('у старого заказа без курса — оценка по текущему', async () => {
    const { orderCost } = await import('./AdminStars');
    const base = { ...completedOrder, cost_kopeks: null } as never;
    expect(orderCost(base, 12774)).toEqual({ kopeks: 6278, estimated: true });
    expect(orderCost(completedOrder as never, 99999)).toEqual({ kopeks: 6278, estimated: false });
    expect(orderCost(base, null)).toBeNull();
  });
});
