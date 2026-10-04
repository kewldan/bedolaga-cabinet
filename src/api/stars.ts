import apiClient from './client';

// ============== Types ==============

export type StarsOrderStatus =
  | 'paid'
  | 'processing'
  | 'broadcasting'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'needs_review';

export interface StarsShopConfig {
  /** Магазин включён и выдача настроена — иначе раздел скрыт */
  available: boolean;
  price_per_star_kopeks: number;
  min_quantity: number;
  max_quantity: number;
  presets: number[];
  balance_kopeks: number;
}

export interface StarsQuote {
  quantity: number;
  price_per_star_kopeks: number;
  total_kopeks: number;
}

export interface StarsPurchaseRequest {
  quantity: number;
  recipient_username: string;
  expected_total_kopeks: number;
  /** Один ключ на одно намерение купить: повтор запроса не создаёт второй заказ */
  idempotency_key: string;
}

export interface StarsOrder {
  id: number;
  status: StarsOrderStatus;
  quantity: number;
  amount_kopeks: number;
  recipient_username: string;
  recipient_name: string | null;
  created_at: string | null;
  completed_at: string | null;
  refunded_at: string | null;
}

export interface StarsPurchaseResponse {
  order: StarsOrder;
  balance_kopeks: number;
  is_replay: boolean;
}

/** 402 от /stars/purchase: корзина сохранена, после пополнения заказ оплатится сам */
export interface StarsInsufficientBalance {
  code: 'insufficient_balance';
  required_kopeks: number;
  available_kopeks: number;
  missing_kopeks: number;
}

export interface AdminStarsOrder extends StarsOrder {
  user_id: number | null;
  user_display: string | null;
  source: string;
  attempts: number;
  last_error: string | null;
  fragment_req_id: string | null;
  ton_tx_hash: string | null;
  cost_nanoton: number | null;
  /** Курс TON и себестоимость в копейках на момент выдачи */
  ton_rate_kopeks?: number | null;
  cost_kopeks?: number | null;
  next_attempt_at: string | null;
  processing_started_at?: string | null;
  updated_at: string | null;
  user_telegram_id?: number | null;
  user_username?: string | null;
}

export interface AdminStarsOrdersList {
  items: AdminStarsOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminStarsStats {
  orders_total: number;
  orders_completed: number;
  stars_sold: number;
  revenue_kopeks: number;
  refunded_kopeks: number;
  cost_nanoton: number;
  /** null — нет курса TON, себестоимость старых заказов не посчитать */
  margin_kopeks: number | null;
  cost_kopeks?: number | null;
  by_status: Record<string, number>;
  needs_review: number;
  ton_rate_kopeks?: number | null;
  ton_rate_source?: string | null;
}

export interface AdminStarsStatus {
  enabled: boolean;
  dry_run: boolean;
  fragment_configured: boolean;
  price_per_star_kopeks: number;
  min_quantity: number;
  max_quantity: number;
  presets: number[];
  /** Курс TON: ручной (manual) или с tonapi/coingecko; null — недоступен */
  ton_rate_kopeks: number | null;
  ton_rate_source?: string | null;
  wallet_low_stars?: number;
}

export interface AdminStarsWallet {
  address: string;
  state: string;
  balance_ton: number;
  fragment_price_ton_per_100: string | null;
  ton_rate_kopeks?: number | null;
}

// ============== API ==============

export const starsApi = {
  getConfig: async (): Promise<StarsShopConfig> => {
    const response = await apiClient.get('/cabinet/stars/config');
    return response.data;
  },

  getQuote: async (quantity: number): Promise<StarsQuote> => {
    const response = await apiClient.get('/cabinet/stars/quote', { params: { quantity } });
    return response.data;
  },

  purchase: async (data: StarsPurchaseRequest): Promise<StarsPurchaseResponse> => {
    const response = await apiClient.post('/cabinet/stars/purchase', data);
    return response.data;
  },

  getOrders: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: StarsOrder[] }> => {
    const response = await apiClient.get('/cabinet/stars/orders', { params });
    return response.data;
  },

  // Admin
  getAdminStatus: async (): Promise<AdminStarsStatus> => {
    const response = await apiClient.get('/cabinet/admin/stars/status');
    return response.data;
  },

  getAdminStats: async (days?: number): Promise<AdminStarsStats> => {
    const response = await apiClient.get('/cabinet/admin/stars/stats', {
      params: days ? { days } : undefined,
    });
    return response.data;
  },

  getAdminOrders: async (params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminStarsOrdersList> => {
    const response = await apiClient.get('/cabinet/admin/stars/orders', { params });
    return response.data;
  },

  getAdminOrder: async (id: number): Promise<AdminStarsOrder> => {
    const response = await apiClient.get(`/cabinet/admin/stars/orders/${id}`);
    return response.data;
  },

  retryOrder: async (id: number): Promise<AdminStarsOrder> => {
    const response = await apiClient.post(`/cabinet/admin/stars/orders/${id}/retry`);
    return response.data;
  },

  refundOrder: async (id: number, reason?: string): Promise<AdminStarsOrder> => {
    const response = await apiClient.post(`/cabinet/admin/stars/orders/${id}/refund`, {
      reason: reason || undefined,
    });
    return response.data;
  },

  completeOrder: async (id: number, tonTxHash?: string): Promise<AdminStarsOrder> => {
    const response = await apiClient.post(`/cabinet/admin/stars/orders/${id}/complete`, {
      ton_tx_hash: tonTxHash || null,
    });
    return response.data;
  },

  getWallet: async (): Promise<AdminStarsWallet> => {
    const response = await apiClient.get('/cabinet/admin/stars/wallet');
    return response.data;
  },
};
