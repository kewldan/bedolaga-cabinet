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

vi.mock('../platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ capabilities: { hasBackButton: true } }),
}));

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

async function renderPage() {
  const { default: AdminStars } = await import('./AdminStars');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
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
    ton_rate_kopeks: 0,
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
