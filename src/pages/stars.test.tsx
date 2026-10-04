// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ruLocale from '@/locales/ru.json';

/**
 * Страница /stars: покупка звёзд с баланса.
 *
 * Главное, что здесь легко сломать: повторное нажатие «Оплатить» должно идти с тем же
 * ключом идемпотентности (иначе двойное списание), а 402 — показывать пополнение на
 * недостающую сумму, а не общую ошибку.
 */

function resolveRu(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  return typeof value === 'string' ? value : undefined;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (resolveRu(key) ?? key).replace(/{{(\w+)}}/g, (_m, name) => String(options?.[name] ?? '')),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ impact: vi.fn(), notification: vi.fn(), selection: vi.fn() }),
}));

vi.mock('../components/InsufficientBalancePrompt', () => ({
  default: ({ missingAmountKopeks }: { missingAmountKopeks: number }) => (
    <div data-testid="insufficient">{missingAmountKopeks}</div>
  ),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getOrders: vi.fn(),
  purchase: vi.fn(),
}));
vi.mock('../api/stars', () => ({ starsApi: api }));

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { username: 'buyer_nick', balance_kopeks: 50000 } }),
}));

const config = {
  available: true,
  price_per_star_kopeks: 160,
  min_quantity: 50,
  max_quantity: 10000,
  presets: [50, 100, 250],
  balance_kopeks: 50000,
};

async function renderPage() {
  const { default: Stars } = await import('./Stars');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Stars />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getConfig.mockResolvedValue(config);
  api.getOrders.mockResolvedValue({ items: [] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('нормализация получателя', () => {
  it('принимает ник, @ник и ссылку t.me', async () => {
    const { normalizeRecipient, isValidRecipient } = await import('./Stars');
    expect(normalizeRecipient(' @durov ')).toBe('durov');
    expect(normalizeRecipient('https://t.me/Durov')).toBe('Durov');
    expect(isValidRecipient('t.me/abcd')).toBe(true);
    for (const bad of ['', 'ab', '1user', 'user name', 'юзер']) {
      expect(isValidRecipient(bad)).toBe(false);
    }
  });
});

describe('страница звёзд', () => {
  it('скрыта, когда магазин недоступен', async () => {
    api.getConfig.mockResolvedValue({ ...config, available: false });
    await renderPage();
    expect(await screen.findByText('Покупка звёзд сейчас недоступна')).toBeTruthy();
  });

  it('оплачивает себе выбранный пресет одним ключом на повтор', async () => {
    api.purchase.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      order: { id: 7, quantity: 100, recipient_username: 'buyer_nick', status: 'paid' },
      balance_kopeks: 34000,
      is_replay: false,
    });
    await renderPage();
    const pay = await screen.findByRole('button', { name: /Оплатить/ });

    fireEvent.click(pay);
    await waitFor(() => expect(api.purchase).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: /Оплатить/ }));
    await screen.findByText('Заказ #7 оплачен');

    const [first, second] = api.purchase.mock.calls.map(([body]) => body);
    expect(first).toMatchObject({
      quantity: 100,
      recipient_username: 'buyer_nick',
      expected_total_kopeks: 16000,
    });
    expect(second.idempotency_key).toBe(first.idempotency_key);
  });

  it('при 402 сразу ведёт на оплату недостающего', async () => {
    const error = Object.assign(new Error('402'), {
      isAxiosError: true,
      response: {
        status: 402,
        data: { detail: { code: 'insufficient_balance', missing_kopeks: 76000 } },
      },
    });
    api.purchase.mockRejectedValue(error);
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Оплатить/ }));
    expect((await screen.findByTestId('insufficient')).textContent).toBe('76000');
    expect(navigate).toHaveBeenCalledWith('/balance/top-up?amount=760&returnTo=%2Fstars');
  });

  it('при нехватке баланса кнопка называет сумму доплаты', async () => {
    api.getConfig.mockResolvedValue({ ...config, balance_kopeks: 6000 });
    await renderPage();
    // 100 ⭐ × 1,60 ₽ = 160 ₽, на балансе 60 ₽ → доплатить 100 ₽
    expect(await screen.findByText('Доплатить')).toBeTruthy();
    const pay = await screen.findByRole('button', { name: /Оплатить/ });
    expect(pay.textContent).toMatch(/100/);
    expect(screen.getByText(/Откроется оплата недостающей суммы/)).toBeTruthy();
  });

  it('не даёт оплатить с некорректным ником', async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Другому' }));
    fireEvent.change(screen.getByPlaceholderText('@username'), { target: { value: 'a b' } });
    const pay = screen.getByRole('button', { name: /Оплатить/ }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    expect(screen.getByText(/Нужен ник Telegram/)).toBeTruthy();
  });
});
