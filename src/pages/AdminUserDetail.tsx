import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import i18n from '../i18n';
import { DEVICE_ALIAS_MAX_LENGTH } from '../constants/devices';
import { useCurrency } from '../hooks/useCurrency';
import { useNotify } from '../platform/hooks/useNotify';
import { copyToClipboard as copyText } from '../utils/clipboard';
import {
  adminUsersApi,
  type UserDetailResponse,
  type UserAvailableTariff,
  type UserListItem,
  type UserPanelInfo,
  type UserNodeUsageResponse,
  type PanelSyncStatusResponse,
  type UpdateSubscriptionRequest,
  type AdminUserGiftsResponse,
  type SubscriptionRequestRecord,
} from '../api/adminUsers';
import { promocodesApi, type PromoGroup } from '../api/promocodes';
import { AdminBackButton } from '../components/admin';
import { GiftsTab } from '../components/admin/userDetail/GiftsTab';
import { SyncTab } from '../components/admin/userDetail/SyncTab';
import { ReferralsTab } from '../components/admin/userDetail/ReferralsTab';
import { BalanceTab } from '../components/admin/userDetail/BalanceTab';
import { TicketsTab } from '../components/admin/userDetail/TicketsTab';
import { createNumberInputHandler, toNumber } from '../utils/inputHelpers';
import { usePermissionStore } from '../store/permissions';
import { getFlagEmoji } from '../utils/subscriptionHelpers';

// ============ Helpers ============

// Алгоритмический ISO 3166-1 alpha-2 → regional indicator (вместо хардкод-словаря,
// который не покрывал все страны: например, EE раньше плыл сырым текстом в одних
// местах, MX/AR/EG до сих пор отсутствуют в других). Единая точка истины в utils.
const getCountryFlag = (code: string | null | undefined): string => getFlagEmoji(code);

// ============ Icons ============

const RefreshIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const MinusIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </svg>
);

// (ArrowDownIcon / ArrowUpIcon moved to components/admin/userDetail/SyncTab.tsx)

const TelegramIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

// ============ Components ============

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-success-500/20 text-success-400 border-success-500/30',
    blocked: 'bg-error-500/20 text-error-400 border-error-500/30',
    deleted: 'bg-dark-600 text-dark-400 border-dark-500',
    trial: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
    expired: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    limited: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    disabled: 'bg-dark-600 text-dark-400 border-dark-500',
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}

// (GiftStatusBadge / GiftCard / GiftsTab JSX moved to components/admin/userDetail/GiftsTab.tsx)

// ============ Main Page ============

export default function AdminUserDetail() {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const navigate = useNavigate();
  const notify = useNotify();
  const { id } = useParams<{ id: string }>();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };
  const locale = localeMap[i18n.language] || 'ru-RU';

  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'info' | 'subscription' | 'balance' | 'sync' | 'tickets' | 'gifts' | 'referrals'
  >('info');
  const [syncStatus, setSyncStatus] = useState<PanelSyncStatusResponse | null>(null);
  const [tariffs, setTariffs] = useState<UserAvailableTariff[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Referrals
  const [referrals, setReferrals] = useState<UserListItem[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);

  // (Referrals-tab state, query, handlers, click-outside + debounced search
  // effects moved into components/admin/userDetail/ReferralsTab.tsx)

  // Panel info & node usage
  const [panelInfo, setPanelInfo] = useState<UserPanelInfo | null>(null);
  const [panelInfoLoading, setPanelInfoLoading] = useState(false);
  const [nodeUsage, setNodeUsage] = useState<UserNodeUsageResponse | null>(null);
  const [nodeUsageDays, setNodeUsageDays] = useState(7);

  // Inline confirm state
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Balance form state moved into BalanceTab.tsx)

  // (Tickets-tab state + query + chat-view state moved into TicketsTab.tsx)

  // Subscription form
  const [subAction, setSubAction] = useState<string>('extend');
  const [subDays, setSubDays] = useState<number | ''>(30);
  const [selectedTariffId, setSelectedTariffId] = useState<number | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<number | null>(null);
  const hasAutoSelectedSub = useRef(false);
  const [subscriptionDetailView, setSubscriptionDetailView] = useState(false);

  // Promo group
  const [promoGroups, setPromoGroups] = useState<PromoGroup[]>([]);
  const [editingPromoGroup, setEditingPromoGroup] = useState(false);

  // Referral commission
  const [editingReferralCommission, setEditingReferralCommission] = useState(false);
  const [referralCommissionValue, setReferralCommissionValue] = useState<number | ''>('');

  // (Send-promo-offer form state moved into BalanceTab.tsx)

  // Traffic packages
  const [selectedTrafficGb, setSelectedTrafficGb] = useState<string>('');

  // Devices
  const [devices, setDevices] = useState<
    {
      hwid: string;
      platform: string;
      device_model: string;
      created_at: string | null;
      local_name?: string | null;
    }[]
  >([]);
  const [devicesTotal, setDevicesTotal] = useState(0);
  const [deviceLimit, setDeviceLimit] = useState(0);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [editingDeviceHwid, setEditingDeviceHwid] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Gifts
  const [giftsData, setGiftsData] = useState<AdminUserGiftsResponse | null>(null);
  const [giftsLoading, setGiftsLoading] = useState(false);

  // Subscription request history
  const [requestHistory, setRequestHistory] = useState<SubscriptionRequestRecord[]>([]);
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);
  const [requestHistoryOffset, setRequestHistoryOffset] = useState(0);
  const [requestHistoryTotal, setRequestHistoryTotal] = useState(0);
  const [requestHistoryExpanded, setRequestHistoryExpanded] = useState(false);
  const [requestHistorySubId, setRequestHistorySubId] = useState<number | null>(null);

  const userId = id ? parseInt(id, 10) : null;

  // React Query owns the main user fetch: caching across navigations + auto-loading
  // state. loadUser is kept as a thin refetch wrapper so the 25+ mutation handlers
  // that call `await loadUser()` after writes need no changes.
  const userQuery = useQuery({
    queryKey: ['admin-user-detail', userId] as const,
    queryFn: () => {
      if (!userId) throw new Error('No userId');
      return adminUsersApi.getUser(userId);
    },
    enabled: !!userId && !isNaN(userId),
  });

  useEffect(() => {
    if (userQuery.data) setUser(userQuery.data);
  }, [userQuery.data]);

  useEffect(() => {
    setLoading(userQuery.isFetching);
  }, [userQuery.isFetching]);

  useEffect(() => {
    if (userQuery.isError) {
      console.error('Failed to load user:', userQuery.error);
      navigate('/admin/users');
    }
  }, [userQuery.isError, userQuery.error, navigate]);

  const loadUser = useCallback(
    async () => {
      await userQuery.refetch();
    },
    // userQuery.refetch is a stable function across renders; including the whole
    // userQuery object would re-create loadUser on every render and cascade into
    // useEffects that depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userQuery.refetch],
  );

  // ---- React Query hooks for the rest of the leaf loaders -----------------
  // Each loader callback below becomes a thin refetch wrapper so existing call
  // sites (mutation handlers, useEffects) continue to work unchanged. queryKey
  // includes the inputs that drive the request (userId / activeSubscriptionId)
  // so changing them auto-invalidates.

  const syncStatusQuery = useQuery({
    queryKey: ['admin-user-sync-status', userId, activeSubscriptionId] as const,
    queryFn: () => adminUsersApi.getSyncStatus(userId as number, activeSubscriptionId ?? undefined),
    enabled: !!userId && !isNaN(userId) && activeTab === 'sync' && hasPermission('users:sync'),
  });
  const tariffsQuery = useQuery({
    queryKey: ['admin-user-tariffs', userId] as const,
    queryFn: () => adminUsersApi.getAvailableTariffs(userId as number, true),
    enabled: !!userId && !isNaN(userId) && activeTab === 'subscription',
  });
  // (ticketsQuery moved into TicketsTab.tsx)
  const referralsQuery = useQuery({
    queryKey: ['admin-user-referrals', userId] as const,
    queryFn: () => adminUsersApi.getReferrals(userId as number, 0, 50),
    enabled: !!userId && !isNaN(userId) && activeTab === 'info',
  });
  // (referralsListQuery moved into ReferralsTab.tsx — the tab owns it now)
  const panelInfoQuery = useQuery({
    queryKey: ['admin-user-panel-info', userId, activeSubscriptionId] as const,
    queryFn: () => adminUsersApi.getPanelInfo(userId as number, activeSubscriptionId ?? undefined),
    enabled: !!userId && !isNaN(userId),
  });
  const nodeUsageQuery = useQuery({
    queryKey: ['admin-user-node-usage', userId, activeSubscriptionId] as const,
    queryFn: () => adminUsersApi.getNodeUsage(userId as number, activeSubscriptionId ?? undefined),
    enabled: !!userId && !isNaN(userId) && activeTab === 'subscription',
  });
  const devicesQuery = useQuery({
    queryKey: ['admin-user-devices', userId, activeSubscriptionId] as const,
    queryFn: () =>
      adminUsersApi.getUserDevices(userId as number, activeSubscriptionId ?? undefined),
    enabled: !!userId && !isNaN(userId) && activeTab === 'subscription',
  });
  const giftsQuery = useQuery({
    queryKey: ['admin-user-gifts', userId] as const,
    queryFn: () => adminUsersApi.getUserGifts(userId as number),
    enabled: !!userId && !isNaN(userId) && activeTab === 'gifts',
  });
  const promoGroupsQuery = useQuery({
    queryKey: ['admin-promo-groups-all'] as const,
    queryFn: () => promocodesApi.getPromoGroups({ limit: 100 }),
    enabled: activeTab === 'info' && hasPermission('users:promo_group'),
  });

  // --- Sync each query's data + isFetching into existing state vars --------
  useEffect(() => {
    if (syncStatusQuery.data) setSyncStatus(syncStatusQuery.data);
  }, [syncStatusQuery.data]);
  useEffect(() => {
    if (tariffsQuery.data) setTariffs(tariffsQuery.data.tariffs);
  }, [tariffsQuery.data]);
  // (ticketsQuery sync moved into TicketsTab.tsx)
  useEffect(() => {
    if (referralsQuery.data) setReferrals(referralsQuery.data.users || []);
    setReferralsLoading(referralsQuery.isFetching);
  }, [referralsQuery.data, referralsQuery.isFetching]);
  // (referralsListQuery sync moved into ReferralsTab.tsx)
  useEffect(() => {
    if (panelInfoQuery.data) setPanelInfo(panelInfoQuery.data);
    setPanelInfoLoading(panelInfoQuery.isFetching);
  }, [panelInfoQuery.data, panelInfoQuery.isFetching]);
  useEffect(() => {
    if (nodeUsageQuery.data) setNodeUsage(nodeUsageQuery.data);
  }, [nodeUsageQuery.data]);
  useEffect(() => {
    if (devicesQuery.data) {
      setDevices(devicesQuery.data.devices);
      setDevicesTotal(devicesQuery.data.total);
      setDeviceLimit(devicesQuery.data.device_limit);
    }
    setDevicesLoading(devicesQuery.isFetching);
  }, [devicesQuery.data, devicesQuery.isFetching]);
  useEffect(() => {
    if (giftsQuery.data) setGiftsData(giftsQuery.data);
    setGiftsLoading(giftsQuery.isFetching);
  }, [giftsQuery.data, giftsQuery.isFetching]);
  useEffect(() => {
    if (promoGroupsQuery.data) setPromoGroups(promoGroupsQuery.data.items);
  }, [promoGroupsQuery.data]);

  // --- Loader callbacks: thin refetch wrappers (signatures unchanged) ------

  const loadSyncStatus = useCallback(
    async () => {
      await syncStatusQuery.refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncStatusQuery.refetch],
  );

  // (loadTickets / loadTicketDetail moved into TicketsTab.tsx)

  // (loadReferralsList moved into ReferralsTab.tsx)

  const loadPanelInfo = useCallback(
    async () => {
      await panelInfoQuery.refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelInfoQuery.refetch],
  );

  const loadRequestHistory = useCallback(
    async (offset = 0, append = false) => {
      if (!userId) return;
      try {
        setRequestHistoryLoading(true);
        const data = await adminUsersApi.getSubscriptionRequestHistory(
          userId,
          requestHistorySubId ?? undefined,
          offset,
          20,
        );
        setRequestHistory((prev) => (append ? [...prev, ...data.records] : data.records));
        setRequestHistoryTotal(data.total);
        setRequestHistoryOffset(offset + data.records.length);
      } catch {
        // silent
      } finally {
        setRequestHistoryLoading(false);
      }
    },
    [userId, requestHistorySubId],
  );

  const loadNodeUsage = useCallback(
    async () => {
      await nodeUsageQuery.refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeUsageQuery.refetch],
  );

  const loadDevices = useCallback(
    async () => {
      await devicesQuery.refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devicesQuery.refetch],
  );

  const loadSubscriptionData = useCallback(async () => {
    await Promise.all([loadPanelInfo(), loadNodeUsage(), loadDevices()]);
  }, [loadPanelInfo, loadNodeUsage, loadDevices]);

  // (handleTicketReply / handleTicketStatusChange + selected-ticket/scroll
  // useEffects moved into TicketsTab.tsx)

  useEffect(() => {
    if (!userId || isNaN(userId)) {
      navigate('/admin/users');
    }
    // user data is auto-loaded by userQuery (enabled when userId is valid)
  }, [userId, navigate]);

  // Reload request history when the request-history subscription selector changes
  useEffect(() => {
    if (!requestHistoryExpanded || requestHistorySubId === null) return;
    setRequestHistory([]);
    setRequestHistoryOffset(0);
    setRequestHistoryTotal(0);
    loadRequestHistory(0);
  }, [requestHistorySubId]); // eslint-disable-line react-hooks/exhaustive-deps

  // All other per-tab data fetching is driven by useQuery `enabled` gating
  // wired to userId / activeSubscriptionId / activeTab — no manual triggers needed.

  // (handleUpdateBalance moved into BalanceTab.tsx)

  const handleUpdateSubscription = async (overrideAction?: string) => {
    if (!userId) return;
    const action = overrideAction || subAction;
    if ((action === 'extend' || action === 'shorten') && toNumber(subDays, 0) <= 0) {
      notify.error(t('admin.users.detail.subscription.invalidDays'));
      return;
    }
    setActionLoading(true);
    try {
      const data: UpdateSubscriptionRequest = {
        action: action as UpdateSubscriptionRequest['action'],
        ...(activeSubscriptionId && action !== 'create'
          ? { subscription_id: activeSubscriptionId }
          : {}),
        ...(action === 'extend' || action === 'shorten' ? { days: toNumber(subDays, 30) } : {}),
        ...(action === 'change_tariff' && selectedTariffId ? { tariff_id: selectedTariffId } : {}),
        ...(action === 'create'
          ? {
              days: toNumber(subDays, 30),
              ...(selectedTariffId ? { tariff_id: selectedTariffId } : {}),
            }
          : {}),
      };
      await adminUsersApi.updateSubscription(userId, data);
      await loadUser();
    } catch (error) {
      console.error('Failed to update subscription:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!userId || !confirm(t('admin.users.confirm.block'))) return;
    setActionLoading(true);
    try {
      await adminUsersApi.blockUser(userId);
      await loadUser();
    } catch (error) {
      console.error('Failed to block user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.unblockUser(userId);
      await loadUser();
    } catch (error) {
      console.error('Failed to unblock user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncFromPanel = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.syncFromPanel(
        userId,
        {
          update_subscription: true,
          update_traffic: true,
        },
        activeSubscriptionId ?? undefined,
      );
      await loadUser();
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to sync from panel:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncToPanel = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.syncToPanel(
        userId,
        { create_if_missing: true },
        activeSubscriptionId ?? undefined,
      );
      await loadUser();
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to sync to panel:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInlineConfirm = (actionKey: string, executeFn: () => Promise<void>) => {
    if (confirmingAction === actionKey) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingAction(null);
      executeFn().catch(() => {});
    } else {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingAction(actionKey);
      confirmTimerRef.current = setTimeout(() => setConfirmingAction(null), 3000);
    }
  };

  const handleDeleteDevice = async (hwid: string) => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.deleteUserDevice(userId, hwid, activeSubscriptionId ?? undefined);
      notify.success(t('admin.users.detail.devices.deleted'));
      await loadDevices();
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Admin renames a device on behalf of the user. Empty/whitespace input
  // clears the alias and falls back to the platform/model default.
  const handleRenameDevice = async (hwid: string) => {
    if (!userId) return;
    setRenameSaving(true);
    // Snapshot inputs BEFORE the await so a fast click on another device
    // mid-flight doesn't smuggle a different alias into this hwid's request.
    const snapshotName = editingDeviceName.trim();
    try {
      await adminUsersApi.renameUserDevice(userId, hwid, snapshotName || null);
      notify.success(t('admin.users.detail.devices.renamed', 'Имя устройства обновлено'));
      // Reset edit state only if user is still on the saved row.
      setEditingDeviceHwid((current) => (current === hwid ? null : current));
      await loadDevices();
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      notify.error(apiMessage || t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setRenameSaving(false);
    }
  };

  const handleResetDevices = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.resetUserDevices(userId, activeSubscriptionId ?? undefined);
      notify.success(t('admin.users.detail.devices.allDeleted'));
      await loadDevices();
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTraffic = async (gb: number) => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.updateSubscription(userId, {
        action: 'add_traffic',
        traffic_gb: gb,
        ...(activeSubscriptionId ? { subscription_id: activeSubscriptionId } : {}),
      });
      notify.success(t('admin.users.detail.subscription.trafficAdded'));
      setSelectedTrafficGb('');
      await loadUser();
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTraffic = async (purchaseId: number) => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.updateSubscription(userId, {
        action: 'remove_traffic',
        traffic_purchase_id: purchaseId,
        ...(activeSubscriptionId ? { subscription_id: activeSubscriptionId } : {}),
      });
      notify.success(t('admin.users.detail.subscription.trafficRemoved'));
      await loadUser();
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetDeviceLimit = async (newLimit: number) => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.updateSubscription(userId, {
        action: 'set_device_limit',
        device_limit: newLimit,
        ...(activeSubscriptionId ? { subscription_id: activeSubscriptionId } : {}),
      });
      notify.success(t('admin.users.detail.subscription.deviceLimitUpdated'));
      await loadUser();
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Multi-subscription: pick active subscription or first from list
  const userSubscriptions = useMemo(() => user?.subscriptions ?? [], [user?.subscriptions]);
  const selectedSub =
    userSubscriptions.find((s) => s.id === activeSubscriptionId) ?? user?.subscription ?? null;

  // Auto-select first subscription when user loads (one-time init)
  useEffect(() => {
    if (user && userSubscriptions.length > 0 && !hasAutoSelectedSub.current) {
      const activeSub = userSubscriptions.find((s) => s.is_active) ?? userSubscriptions[0];
      setActiveSubscriptionId(activeSub.id);
      setRequestHistorySubId(activeSub.id);
      hasAutoSelectedSub.current = true;
    }
  }, [user, userSubscriptions]);

  const currentTariff = tariffs.find((t) => t.id === selectedSub?.tariff_id) || null;

  const handleChangePromoGroup = async (groupId: number | null) => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await adminUsersApi.updatePromoGroup(userId, groupId);
      await loadUser();
      setEditingPromoGroup(false);
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateReferralCommission = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const value = referralCommissionValue === '' ? null : toNumber(referralCommissionValue);
      if (value !== null && (value < 0 || value > 100)) {
        notify.error(t('admin.users.detail.referral.invalidPercent'), t('common.error'));
        return;
      }
      await adminUsersApi.updateReferralCommission(userId, value);
      await loadUser();
      setEditingReferralCommission(false);
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // (handleDeactivateOffer / handleSendOffer moved into BalanceTab.tsx)

  // (Referrals-tab handlers + debounced search useEffects + click-outside
  // useEffects moved into components/admin/userDetail/ReferralsTab.tsx)

  const handleResetTrial = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const result = await adminUsersApi.resetTrial(userId);
      if (result.success) {
        notify.success(t('admin.users.userActions.success.resetTrial'), t('common.success'));
        await loadUser();
      } else {
        notify.error(result.message || t('admin.users.userActions.error'), t('common.error'));
      }
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetSubscription = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const result = await adminUsersApi.resetSubscription(userId);
      if (result.success) {
        notify.success(t('admin.users.userActions.success.resetSubscription'), t('common.success'));
        await loadUser();
      } else {
        notify.error(result.message || t('admin.users.userActions.error'), t('common.error'));
      }
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const result = await adminUsersApi.disableUser(userId);
      if (result.success) {
        notify.success(t('admin.users.userActions.success.disable'), t('common.success'));
        await loadUser();
      } else {
        notify.error(result.message || t('admin.users.userActions.error'), t('common.error'));
      }
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleFullDeleteUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const result = await adminUsersApi.fullDeleteUser(userId);
      if (result.success) {
        notify.success(t('admin.users.userActions.success.delete'), t('common.success'));
        navigate('/admin/users');
      } else {
        notify.error(result.message || t('admin.users.userActions.error'), t('common.error'));
      }
    } catch {
      notify.error(t('admin.users.userActions.error'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Compute node usage for selected period from cached 30-day data
  const nodeUsageForPeriod = (() => {
    if (!nodeUsage || nodeUsage.items.length === 0) return [];
    return nodeUsage.items
      .map((item) => {
        const daily = item.daily_bytes || [];
        const sliced = daily.slice(-nodeUsageDays);
        const total = sliced.reduce((sum, v) => sum + v, 0);
        return { ...item, total_bytes: total };
      })
      .sort((a, b) => b.total_bytes - a.total_bytes);
  })();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await copyText(text);
      notify.success(t('admin.users.detail.copied'));
    } catch {
      // copy adapter already handles fallback + permission errors; surface
      // the failure to the user instead of swallowing it silently.
      notify.error(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-dark-400">{t('admin.users.notFound')}</p>
        <button
          onClick={() => navigate('/admin/users')}
          className="rounded-lg bg-accent-500 px-4 py-2 text-white transition-colors hover:bg-accent-600"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin/users" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-lg font-bold text-white">
            {user.first_name?.[0] || user.username?.[0] || '?'}
          </div>
          <div>
            <div className="font-semibold text-dark-100">{user.full_name}</div>
            <div className="flex items-center gap-2 text-sm text-dark-400">
              <TelegramIcon />
              {user.telegram_id}
              {user.username && <span>@{user.username}</span>}
            </div>
          </div>
        </div>
        <button onClick={loadUser} className="rounded-lg p-2 transition-colors hover:bg-dark-700">
          <RefreshIcon className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="scrollbar-hide -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 py-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {(['info', 'subscription', 'balance', 'sync', 'tickets', 'gifts', 'referrals'] as const)
          .filter((tab) => tab !== 'sync' || hasPermission('users:sync'))
          .map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30'
                  : 'bg-dark-800/50 text-dark-400 active:bg-dark-700'
              }`}
            >
              {tab === 'info' && t('admin.users.detail.tabs.info')}
              {tab === 'subscription' && t('admin.users.detail.tabs.subscription')}
              {tab === 'balance' && t('admin.users.detail.tabs.balance')}
              {tab === 'sync' && t('admin.users.detail.tabs.sync')}
              {tab === 'tickets' && t('admin.users.detail.tabs.tickets')}
              {tab === 'gifts' && t('admin.users.detail.tabs.gifts')}
              {tab === 'referrals' && t('admin.users.detail.tabs.referrals')}
            </button>
          ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 p-3">
              <span className="text-dark-400">{t('admin.users.detail.status')}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={user.status} />
                {user.status === 'active' ? (
                  <button
                    onClick={handleBlockUser}
                    disabled={actionLoading}
                    className="rounded-lg bg-error-500/20 px-3 py-1 text-xs text-error-400 transition-colors hover:bg-error-500/30"
                  >
                    {t('admin.users.actions.block')}
                  </button>
                ) : user.status === 'blocked' ? (
                  <button
                    onClick={handleUnblockUser}
                    disabled={actionLoading}
                    className="rounded-lg bg-success-500/20 px-3 py-1 text-xs text-success-400 transition-colors hover:bg-success-500/30"
                  >
                    {t('admin.users.actions.unblock')}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">Email</div>
                <div className="text-dark-100">{user.email || '-'}</div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">{t('admin.users.detail.language')}</div>
                <div className="text-dark-100">{user.language}</div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.users.detail.registration')}
                </div>
                <div className="text-dark-100">{formatDate(user.created_at)}</div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.users.detail.botActivity')}
                </div>
                <div className="text-dark-100">{formatDate(user.last_activity)}</div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.users.detail.cabinetLastLogin')}
                </div>
                <div className="text-dark-100">{formatDate(user.cabinet_last_login)}</div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.users.detail.totalSpent')}
                </div>
                <div className="text-dark-100">
                  {formatWithCurrency(user.total_spent_kopeks / 100)}
                </div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.users.detail.purchases')}
                </div>
                <div className="text-dark-100">{user.purchase_count}</div>
              </div>
            </div>

            {/* VPN Connection Info */}
            {(panelInfo || userSubscriptions.length > 0) && (
              <div className="rounded-xl border border-dark-700/30 bg-dark-800/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-200">
                    {t('admin.users.detail.vpnConnection')}
                  </span>
                  {userSubscriptions.length > 1 && (
                    <select
                      value={activeSubscriptionId ?? ''}
                      onChange={(e) => {
                        const subId = Number(e.target.value);
                        setActiveSubscriptionId(subId);
                      }}
                      className="rounded-lg border border-dark-600 bg-dark-700 px-3 py-1.5 text-xs text-dark-200"
                    >
                      {userSubscriptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.tariff_name || `#${s.id}`} — {s.status}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {panelInfoLoading && !panelInfo?.found && (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  </div>
                )}
                {panelInfo?.found && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-dark-700/30 p-3">
                      <div className="mb-1 text-xs text-dark-500">
                        {t('admin.users.detail.lastConnection')}
                      </div>
                      <div className="flex items-center gap-2">
                        {panelInfo.online_at &&
                          (() => {
                            const onlineDate = new Date(panelInfo.online_at);
                            const isRecent = Date.now() - onlineDate.getTime() < 5 * 60 * 1000;
                            return (
                              <>
                                <span
                                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${isRecent ? 'bg-success-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-dark-500'}`}
                                  title={isRecent ? t('admin.users.detail.online') : ''}
                                />
                                <span
                                  className={`text-sm ${isRecent ? 'font-medium text-success-400' : 'text-dark-100'}`}
                                >
                                  {isRecent
                                    ? t('admin.users.detail.online')
                                    : formatDate(panelInfo.online_at)}
                                </span>
                              </>
                            );
                          })()}
                        {!panelInfo.online_at && <span className="text-sm text-dark-100">-</span>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-dark-700/30 p-3">
                      <div className="mb-1 text-xs text-dark-500">
                        {t('admin.users.detail.firstConnection')}
                      </div>
                      <div className="text-sm text-dark-100">
                        {panelInfo.first_connected_at
                          ? new Date(panelInfo.first_connected_at).toLocaleDateString(locale, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '-'}
                      </div>
                    </div>
                    {panelInfo.last_connected_node_name && (
                      <div className="col-span-2 rounded-lg bg-dark-700/30 p-3">
                        <div className="mb-1 text-xs text-dark-500">
                          {t('admin.users.detail.lastNode')}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-dark-100">
                          <svg
                            className="h-4 w-4 shrink-0 text-dark-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                            />
                          </svg>
                          {panelInfo.last_connected_node_name}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!panelInfoLoading && !panelInfo?.found && userSubscriptions.length > 0 && (
                  <div className="py-2 text-center text-xs text-dark-500">
                    {t('admin.users.detail.noVpnData')}
                  </div>
                )}
              </div>
            )}

            {/* Campaign */}
            {user.campaign_name && (
              <div className="rounded-xl border border-accent-500/20 bg-accent-500/5 p-3">
                <div className="mb-1 text-xs text-dark-500">{t('admin.users.detail.campaign')}</div>
                <div className="text-sm font-medium text-accent-400">{user.campaign_name}</div>
              </div>
            )}

            {/* Promo Group */}
            <div className="rounded-xl bg-dark-800/50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-dark-500">{t('admin.users.detail.promoGroup')}</span>
                {hasPermission('users:promo_group') && (
                  <button
                    onClick={() => setEditingPromoGroup(!editingPromoGroup)}
                    className="text-xs text-accent-400 transition-colors hover:text-accent-300"
                  >
                    {editingPromoGroup
                      ? t('common.cancel')
                      : t('admin.users.detail.changePromoGroup')}
                  </button>
                )}
              </div>
              {editingPromoGroup ? (
                <div className="mt-2 space-y-2">
                  <select
                    value={user.promo_group?.id ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChangePromoGroup(val ? parseInt(val, 10) : null);
                    }}
                    disabled={actionLoading}
                    className="input text-sm"
                  >
                    <option value="">{t('admin.users.detail.selectPromoGroup')}</option>
                    {promoGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  {user.promo_group && (
                    <button
                      onClick={() => handleChangePromoGroup(null)}
                      disabled={actionLoading}
                      className="w-full rounded-lg bg-dark-700 py-1.5 text-xs text-dark-300 transition-colors hover:bg-dark-600"
                    >
                      {t('admin.users.detail.removePromoGroup')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium text-dark-100">
                  {user.promo_group?.name || (
                    <span className="text-dark-500">{t('admin.users.detail.noPromoGroup')}</span>
                  )}
                </div>
              )}
            </div>

            {/* Referral */}
            <div className="rounded-xl bg-dark-800/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-dark-200">
                  {t('admin.users.detail.referral.title')}
                </span>
                {hasPermission('users:referral') && (
                  <button
                    onClick={() => {
                      if (!editingReferralCommission) {
                        setReferralCommissionValue(user.referral.commission_percent ?? '');
                      }
                      setEditingReferralCommission(!editingReferralCommission);
                    }}
                    className="text-xs text-accent-400 transition-colors hover:text-accent-300"
                  >
                    {editingReferralCommission ? t('common.cancel') : t('common.edit')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-dark-100">
                    {user.referral.referrals_count}
                  </div>
                  <div className="text-xs text-dark-500">
                    {t('admin.users.detail.referral.referrals')}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-dark-100">
                    {formatWithCurrency(user.referral.total_earnings_kopeks / 100)}
                  </div>
                  <div className="text-xs text-dark-500">
                    {t('admin.users.detail.referral.earned')}
                  </div>
                </div>
                <div>
                  {editingReferralCommission ? (
                    <div className="space-y-1">
                      <input
                        type="number"
                        value={referralCommissionValue}
                        onChange={createNumberInputHandler(setReferralCommissionValue, 0)}
                        placeholder="0-100"
                        className="input w-full text-center text-sm"
                        min={0}
                        max={100}
                        disabled={actionLoading}
                      />
                      <button
                        onClick={handleUpdateReferralCommission}
                        disabled={actionLoading}
                        className="w-full rounded-lg bg-accent-500 px-2 py-1 text-xs text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                      >
                        {actionLoading ? t('common.loading') : t('common.save')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-dark-100">
                        {user.referral.commission_percent != null
                          ? `${user.referral.commission_percent}%`
                          : t('admin.users.detail.referral.default')}
                      </div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.referral.commission')}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Referrals list */}
            {user.referral.referrals_count > 0 && (
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-2 text-sm font-medium text-dark-200">
                  {t('admin.users.detail.referralsList')}
                </div>
                {referralsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="py-2 text-center text-xs text-dark-500">
                    {t('admin.users.detail.noReferrals')}
                  </div>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {referrals.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => navigate(`/admin/users/${ref.id}`)}
                        className="flex w-full items-center justify-between rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-dark-600 text-xs font-bold text-dark-300">
                            {ref.first_name?.[0] || ref.username?.[0] || '?'}
                          </div>
                          <div>
                            <div className="text-sm text-dark-100">{ref.full_name}</div>
                            <div className="text-xs text-dark-500">
                              {formatDate(ref.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-dark-400">
                          {formatWithCurrency(ref.total_spent_kopeks / 100)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Restrictions */}
            {(user.restriction_topup || user.restriction_subscription) && (
              <div className="rounded-xl border border-error-500/30 bg-error-500/10 p-3">
                <div className="mb-2 text-sm font-medium text-error-400">
                  {t('admin.users.detail.restrictions.title')}
                </div>
                {user.restriction_topup && (
                  <div className="text-xs text-error-300">
                    {t('admin.users.detail.restrictions.topup')}
                  </div>
                )}
                {user.restriction_subscription && (
                  <div className="text-xs text-error-300">
                    {t('admin.users.detail.restrictions.subscription')}
                  </div>
                )}
                {user.restriction_reason && (
                  <div className="mt-1 text-xs text-dark-400">
                    {t('admin.users.detail.restrictions.reason')}: {user.restriction_reason}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="rounded-xl bg-dark-800/50 p-4">
              <div className="mb-3 text-sm font-medium text-dark-200">
                {t('admin.users.detail.actions.title')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleInlineConfirm('resetTrial', handleResetTrial)}
                  disabled={actionLoading}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    confirmingAction === 'resetTrial'
                      ? 'bg-accent-500 text-white'
                      : 'bg-accent-500/15 text-accent-400 hover:bg-accent-500/25'
                  }`}
                >
                  {confirmingAction === 'resetTrial'
                    ? t('admin.users.detail.actions.areYouSure')
                    : t('admin.users.userActions.resetTrial')}
                </button>
                <button
                  onClick={() => handleInlineConfirm('resetSubscription', handleResetSubscription)}
                  disabled={actionLoading}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    confirmingAction === 'resetSubscription'
                      ? 'bg-warning-500 text-white'
                      : 'bg-warning-500/15 text-warning-400 hover:bg-warning-500/25'
                  }`}
                >
                  {confirmingAction === 'resetSubscription'
                    ? t('admin.users.detail.actions.areYouSure')
                    : t('admin.users.userActions.resetSubscription')}
                </button>
                <button
                  onClick={() => handleInlineConfirm('disable', handleDisableUser)}
                  disabled={actionLoading}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    confirmingAction === 'disable'
                      ? 'bg-dark-500 text-white'
                      : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}
                >
                  {confirmingAction === 'disable'
                    ? t('admin.users.detail.actions.areYouSure')
                    : t('admin.users.userActions.disable')}
                </button>
                <button
                  onClick={() => handleInlineConfirm('fullDelete', handleFullDeleteUser)}
                  disabled={actionLoading}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    confirmingAction === 'fullDelete'
                      ? 'bg-rose-500 text-white'
                      : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                  }`}
                >
                  {confirmingAction === 'fullDelete'
                    ? t('admin.users.detail.actions.areYouSure')
                    : t('admin.users.userActions.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-4">
            {/* Multi-subscription: Level 1 — subscription list */}
            {userSubscriptions.length > 1 && !subscriptionDetailView && (
              <>
                <div className="space-y-3">
                  {userSubscriptions.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveSubscriptionId(sub.id);
                        setSubscriptionDetailView(true);
                      }}
                      className="w-full rounded-xl border border-dark-700/50 bg-dark-800/50 p-4 text-left transition-all hover:border-dark-600"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-dark-100">
                            {sub.tariff_name || `#${sub.id}`}
                          </span>
                          <StatusBadge status={sub.status} />
                        </div>
                        <svg
                          className="h-4 w-4 text-dark-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-dark-400">
                        <span>
                          {sub.traffic_used_gb.toFixed(1)} / {sub.traffic_limit_gb}{' '}
                          {t('common.units.gb')}
                        </span>
                        <span>{formatDate(sub.end_date)}</span>
                        <span>
                          {sub.device_limit}{' '}
                          {t('admin.users.detail.subscription.devices', 'устройств')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Create new subscription — at list level */}
                {hasPermission('users:subscription') && (
                  <div className="rounded-xl bg-dark-800/50 p-4">
                    <div className="mb-3 text-sm font-medium text-dark-200">
                      {t('admin.users.detail.subscription.createNew', 'Создать подписку')}
                    </div>
                    <div className="space-y-3">
                      <select
                        value={selectedTariffId || ''}
                        onChange={(e) =>
                          setSelectedTariffId(e.target.value ? parseInt(e.target.value) : null)
                        }
                        className="input"
                      >
                        <option value="">
                          {t('admin.users.detail.subscription.selectTariff')}
                        </option>
                        {tariffs
                          .filter((tariffItem) => {
                            const purchasedIds = new Set(
                              userSubscriptions
                                .filter(
                                  (s) =>
                                    s.is_active || s.status === 'trial' || s.status === 'limited',
                                )
                                .map((s) => s.tariff_id),
                            );
                            return !purchasedIds.has(tariffItem.id);
                          })
                          .map((tariffItem) => (
                            <option key={tariffItem.id} value={tariffItem.id}>
                              {tariffItem.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        value={subDays}
                        onChange={createNumberInputHandler(setSubDays, 1)}
                        placeholder={t('admin.users.detail.subscription.days')}
                        className="input"
                        min={1}
                        max={3650}
                      />
                      <button
                        onClick={() => handleUpdateSubscription('create')}
                        disabled={actionLoading}
                        className="btn-primary w-full"
                      >
                        {actionLoading
                          ? t('admin.users.detail.subscription.creating')
                          : t('admin.users.detail.subscription.create')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Level 2 — subscription detail (or single subscription) */}
            {(subscriptionDetailView || userSubscriptions.length <= 1) && selectedSub ? (
              <>
                {/* Back to list (multi-subscription) */}
                {subscriptionDetailView && userSubscriptions.length > 1 && (
                  <button
                    onClick={() => setSubscriptionDetailView(false)}
                    className="flex items-center gap-1.5 text-sm text-dark-400 transition-colors hover:text-dark-200"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('admin.users.detail.subscription.backToList', 'Все подписки')}
                  </button>
                )}

                {/* Current subscription */}
                <div className="rounded-xl bg-dark-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-dark-200">
                      {t('admin.users.detail.subscription.current')}
                      {userSubscriptions.length > 1 && (
                        <span className="ml-2 text-xs text-dark-500">#{selectedSub.id}</span>
                      )}
                    </span>
                    <StatusBadge status={selectedSub.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.subscription.tariff')}
                      </div>
                      <div className="text-dark-100">
                        {selectedSub.tariff_name ||
                          t('admin.users.detail.subscription.notSpecified')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.subscription.validUntil')}
                      </div>
                      <div className="text-dark-100">{formatDate(selectedSub.end_date)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.subscription.traffic')}
                      </div>
                      <div className="text-dark-100">
                        {panelInfo?.found
                          ? (panelInfo.used_traffic_bytes / (1024 * 1024 * 1024)).toFixed(1)
                          : selectedSub.traffic_used_gb.toFixed(1)}{' '}
                        / {selectedSub.traffic_limit_gb} {t('common.units.gb')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.subscription.devices')}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetDeviceLimit(selectedSub.device_limit - 1)}
                          disabled={actionLoading || selectedSub.device_limit <= 1}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-dark-700 text-dark-300 transition-colors hover:bg-dark-600 disabled:opacity-30"
                        >
                          <MinusIcon />
                        </button>
                        <span className="min-w-[2ch] text-center text-dark-100">
                          {selectedSub.device_limit}
                        </span>
                        <button
                          onClick={() => handleSetDeviceLimit(selectedSub.device_limit + 1)}
                          disabled={
                            actionLoading ||
                            (currentTariff?.max_device_limit != null &&
                              selectedSub.device_limit >= currentTariff.max_device_limit)
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-dark-700 text-dark-300 transition-colors hover:bg-dark-600 disabled:opacity-30"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Traffic Packages */}
                {selectedSub.traffic_purchases && selectedSub.traffic_purchases.length > 0 && (
                  <div className="rounded-xl bg-dark-800/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-dark-200">
                        {t('admin.users.detail.subscription.trafficPackages')}
                        {selectedSub.purchased_traffic_gb > 0 && (
                          <span className="ml-2 text-xs text-dark-400">
                            ({selectedSub.purchased_traffic_gb} {t('common.units.gb')})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedSub.traffic_purchases.map((tp) => (
                        <div
                          key={tp.id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                            tp.is_expired ? 'bg-dark-700/30 opacity-60' : 'bg-dark-700/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm text-dark-200">
                              <span className="font-medium">
                                {tp.traffic_gb} {t('common.units.gb')}
                              </span>
                              {tp.is_expired ? (
                                <span className="rounded-full bg-error-500/20 px-1.5 py-0.5 text-[10px] text-error-400">
                                  {t('admin.users.detail.subscription.expired')}
                                </span>
                              ) : (
                                <span className="text-xs text-dark-400">
                                  {tp.days_remaining}{' '}
                                  {t('admin.users.detail.subscription.daysLeft')}
                                </span>
                              )}
                            </div>
                          </div>
                          {!tp.is_expired && (
                            <button
                              onClick={() =>
                                handleInlineConfirm(`removeTraffic_${tp.id}`, () =>
                                  handleRemoveTraffic(tp.id),
                                )
                              }
                              disabled={actionLoading}
                              className={`ml-2 shrink-0 rounded-lg px-2 py-1 text-xs transition-all disabled:opacity-50 ${
                                confirmingAction === `removeTraffic_${tp.id}`
                                  ? 'bg-error-500 text-white'
                                  : 'text-dark-500 hover:bg-error-500/15 hover:text-error-400'
                              }`}
                            >
                              {confirmingAction === `removeTraffic_${tp.id}` ? '?' : '\u00D7'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Traffic */}
                {currentTariff &&
                  currentTariff.traffic_topup_enabled &&
                  Object.keys(currentTariff.traffic_topup_packages).length > 0 && (
                    <div className="rounded-xl bg-dark-800/50 p-4">
                      <div className="mb-3 text-sm font-medium text-dark-200">
                        {t('admin.users.detail.subscription.addTraffic')}
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={selectedTrafficGb}
                          onChange={(e) => setSelectedTrafficGb(e.target.value)}
                          className="input flex-1"
                        >
                          <option value="">
                            {t('admin.users.detail.subscription.selectPackage')}
                          </option>
                          {Object.entries(currentTariff.traffic_topup_packages)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([gb]) => (
                              <option key={gb} value={gb}>
                                {gb} {t('common.units.gb')}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() =>
                            selectedTrafficGb && handleAddTraffic(Number(selectedTrafficGb))
                          }
                          disabled={actionLoading || !selectedTrafficGb}
                          className="shrink-0 rounded-lg bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                        >
                          {t('admin.users.detail.subscription.addButton')}
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-dark-500">
                        {t('admin.users.detail.subscription.addTrafficNote')}
                      </div>
                    </div>
                  )}

                {/* Actions */}
                {hasPermission('users:subscription') && (
                  <div className="rounded-xl bg-dark-800/50 p-4">
                    <div className="mb-3 font-medium text-dark-200">
                      {t('admin.users.detail.subscription.actions')}
                    </div>
                    <div className="space-y-3">
                      <select
                        value={subAction}
                        onChange={(e) => setSubAction(e.target.value)}
                        className="input"
                      >
                        <option value="extend">
                          {t('admin.users.detail.subscription.extend')}
                        </option>
                        <option value="shorten">
                          {t('admin.users.detail.subscription.shorten')}
                        </option>
                        {userSubscriptions.length <= 1 && (
                          <option value="change_tariff">
                            {t('admin.users.detail.subscription.changeTariff')}
                          </option>
                        )}
                        <option value="cancel">
                          {t('admin.users.detail.subscription.cancel')}
                        </option>
                        <option value="activate">
                          {t('admin.users.detail.subscription.activate')}
                        </option>
                      </select>

                      {(subAction === 'extend' || subAction === 'shorten') && (
                        <input
                          type="number"
                          value={subDays}
                          onChange={createNumberInputHandler(setSubDays, 1)}
                          placeholder={t('admin.users.detail.subscription.days')}
                          className="input"
                          min={1}
                          max={3650}
                        />
                      )}

                      {subAction === 'change_tariff' && (
                        <select
                          value={selectedTariffId || ''}
                          onChange={(e) =>
                            setSelectedTariffId(e.target.value ? parseInt(e.target.value) : null)
                          }
                          className="input"
                        >
                          <option value="">
                            {t('admin.users.detail.subscription.selectTariff')}
                          </option>
                          {tariffs.map((tariffItem) => (
                            <option key={tariffItem.id} value={tariffItem.id}>
                              {tariffItem.name}{' '}
                              {!tariffItem.is_available &&
                                t('admin.users.detail.subscription.unavailable')}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={() => handleUpdateSubscription()}
                        disabled={actionLoading}
                        className="btn-primary w-full"
                      >
                        {actionLoading
                          ? t('admin.users.actions.applying')
                          : t('admin.users.actions.apply')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {/* Create new subscription — only for single-sub users or no subs */}
            {hasPermission('users:subscription') && userSubscriptions.length <= 1 && (
              <div className="rounded-xl bg-dark-800/50 p-4">
                {userSubscriptions.length === 0 && (
                  <div className="mb-4 text-center text-dark-400">
                    {t('admin.users.detail.subscription.noActive')}
                  </div>
                )}
                <div className="mb-3 text-sm font-medium text-dark-200">
                  {t('admin.users.detail.subscription.createNew', 'Создать подписку')}
                </div>
                <div className="space-y-3">
                  <select
                    value={selectedTariffId || ''}
                    onChange={(e) =>
                      setSelectedTariffId(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="input"
                  >
                    <option value="">{t('admin.users.detail.subscription.selectTariff')}</option>
                    {tariffs
                      .filter((tariffItem) => {
                        // In multi-tariff: hide tariffs user already has
                        if (userSubscriptions.length > 0) {
                          const purchasedIds = new Set(
                            userSubscriptions
                              .filter((s) => s.is_active || s.status === 'trial')
                              .map((s) => s.tariff_id),
                          );
                          return !purchasedIds.has(tariffItem.id);
                        }
                        return true;
                      })
                      .map((tariffItem) => (
                        <option key={tariffItem.id} value={tariffItem.id}>
                          {tariffItem.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={subDays}
                    onChange={createNumberInputHandler(setSubDays, 1)}
                    placeholder={t('admin.users.detail.subscription.days')}
                    className="input"
                    min={1}
                    max={3650}
                  />
                  <button
                    onClick={() => handleUpdateSubscription('create')}
                    disabled={actionLoading}
                    className="btn-primary w-full"
                  >
                    {actionLoading
                      ? t('admin.users.detail.subscription.creating')
                      : t('admin.users.detail.subscription.create')}
                  </button>
                </div>
              </div>
            )}

            {/* Panel Info, Traffic, Devices — only inside subscription detail */}
            {(subscriptionDetailView || userSubscriptions.length <= 1) && (
              <>
                {panelInfoLoading ? (
                  <div className="flex justify-center rounded-xl bg-dark-800/50 py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  </div>
                ) : panelInfo && !panelInfo.found ? (
                  <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4 text-center text-sm text-dark-400">
                    {t('admin.users.detail.panelNotFound')}
                  </div>
                ) : panelInfo && panelInfo.found ? (
                  <>
                    {/* Links */}
                    {(panelInfo.subscription_url || panelInfo.happ_link) && (
                      <div className="rounded-xl bg-dark-800/50 p-4">
                        <div className="mb-3 text-sm font-medium text-dark-200">
                          {t('admin.users.detail.subscriptionUrl')} /{' '}
                          {t('admin.users.detail.happLink')}
                        </div>
                        <div className="space-y-2">
                          {panelInfo.subscription_url && (
                            <button
                              onClick={() => copyToClipboard(panelInfo.subscription_url!)}
                              className="w-full rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                            >
                              <div className="mb-0.5 text-xs text-dark-500">
                                {t('admin.users.detail.subscriptionUrl')}
                              </div>
                              <div className="truncate font-mono text-xs text-dark-200">
                                {panelInfo.subscription_url}
                              </div>
                            </button>
                          )}
                          {panelInfo.happ_link && (
                            <button
                              onClick={() => copyToClipboard(panelInfo.happ_link!)}
                              className="w-full rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                            >
                              <div className="mb-0.5 text-xs text-dark-500">
                                {t('admin.users.detail.happLink')}
                              </div>
                              <div className="truncate font-mono text-xs text-dark-200">
                                {panelInfo.happ_link}
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Config */}
                    {(panelInfo.trojan_password ||
                      panelInfo.vless_uuid ||
                      panelInfo.ss_password) && (
                      <div className="rounded-xl bg-dark-800/50 p-4">
                        <div className="mb-3 text-sm font-medium text-dark-200">
                          {t('admin.users.detail.panelConfig')}
                        </div>
                        <div className="space-y-2">
                          {panelInfo.trojan_password && (
                            <button
                              onClick={() => copyToClipboard(panelInfo.trojan_password!)}
                              className="w-full rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                            >
                              <div className="mb-0.5 text-xs text-dark-500">
                                {t('admin.users.detail.trojanPassword')}
                              </div>
                              <div className="truncate font-mono text-xs text-dark-200">
                                {panelInfo.trojan_password}
                              </div>
                            </button>
                          )}
                          {panelInfo.vless_uuid && (
                            <button
                              onClick={() => copyToClipboard(panelInfo.vless_uuid!)}
                              className="w-full rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                            >
                              <div className="mb-0.5 text-xs text-dark-500">
                                {t('admin.users.detail.vlessUuid')}
                              </div>
                              <div className="truncate font-mono text-xs text-dark-200">
                                {panelInfo.vless_uuid}
                              </div>
                            </button>
                          )}
                          {panelInfo.ss_password && (
                            <button
                              onClick={() => copyToClipboard(panelInfo.ss_password!)}
                              className="w-full rounded-lg bg-dark-700/50 p-2 text-left transition-colors hover:bg-dark-700"
                            >
                              <div className="mb-0.5 text-xs text-dark-500">
                                {t('admin.users.detail.ssPassword')}
                              </div>
                              <div className="truncate font-mono text-xs text-dark-200">
                                {panelInfo.ss_password}
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Connection info */}
                    <div className="rounded-xl bg-dark-800/50 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-dark-500">
                            {t('admin.users.detail.firstConnected')}
                          </div>
                          <div className="text-sm text-dark-100">
                            {formatDate(panelInfo.first_connected_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-dark-500">
                            {t('admin.users.detail.lastOnline')}
                          </div>
                          <div className="text-sm text-dark-100">
                            {formatDate(panelInfo.online_at)}
                          </div>
                        </div>
                        {panelInfo.last_connected_node_name && (
                          <div className="col-span-2">
                            <div className="text-xs text-dark-500">
                              {t('admin.users.detail.lastNode')}
                            </div>
                            <div className="text-sm text-dark-100">
                              {panelInfo.last_connected_node_name}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live traffic */}
                    <div className="rounded-xl bg-dark-800/50 p-4">
                      <div className="mb-3 text-sm font-medium text-dark-200">
                        {t('admin.users.detail.liveTraffic')}
                      </div>
                      <div className="mb-2">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-dark-400">
                            {formatBytes(panelInfo.used_traffic_bytes)}
                          </span>
                          <span className="text-dark-500">
                            {panelInfo.traffic_limit_bytes > 0
                              ? formatBytes(panelInfo.traffic_limit_bytes)
                              : '∞'}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-dark-700">
                          <div
                            className="h-full rounded-full bg-accent-500 transition-all"
                            style={{
                              width:
                                panelInfo.traffic_limit_bytes > 0
                                  ? `${Math.min(100, (panelInfo.used_traffic_bytes / panelInfo.traffic_limit_bytes) * 100)}%`
                                  : '0%',
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-dark-500">
                        {t('admin.users.detail.lifetime')}:{' '}
                        {formatBytes(panelInfo.lifetime_used_traffic_bytes)}
                      </div>
                    </div>

                    {/* Node usage */}
                    <div className="rounded-xl bg-dark-800/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-dark-200">
                          {t('admin.users.detail.nodeUsage')}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 3, 7, 14, 30].map((d) => (
                              <button
                                key={d}
                                onClick={() => setNodeUsageDays(d)}
                                className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                                  nodeUsageDays === d
                                    ? 'bg-accent-500/20 text-accent-400'
                                    : 'text-dark-500 hover:text-dark-300'
                                }`}
                              >
                                {d}d
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => loadSubscriptionData()}
                            className="rounded-lg p-1 text-dark-500 transition-colors hover:text-dark-300"
                            title={t('common.refresh')}
                          >
                            <RefreshIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {nodeUsageForPeriod.length > 0 ? (
                        <div className="space-y-2">
                          {nodeUsageForPeriod.map((item) => {
                            const maxBytes = nodeUsageForPeriod[0].total_bytes;
                            const pct = maxBytes > 0 ? (item.total_bytes / maxBytes) * 100 : 0;
                            return (
                              <div key={item.node_uuid}>
                                <div className="mb-1 flex justify-between text-xs">
                                  <span className="text-dark-300">
                                    {item.country_code && (
                                      <span className="mr-1">
                                        {getCountryFlag(item.country_code)}
                                      </span>
                                    )}
                                    {item.node_name}
                                  </span>
                                  <span className="text-dark-400">
                                    {formatBytes(item.total_bytes)}
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-dark-700">
                                  <div
                                    className="h-full rounded-full bg-accent-500/60"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-xs text-dark-500">-</div>
                      )}
                    </div>
                  </>
                ) : null}

                {/* Devices */}
                <div className="rounded-xl bg-dark-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-200">
                      {t('admin.users.detail.devices.title')} ({devicesTotal}/{deviceLimit})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadDevices()}
                        className="rounded-lg p-1 text-dark-500 transition-colors hover:text-dark-300"
                        title={t('common.refresh')}
                      >
                        <RefreshIcon className="h-3.5 w-3.5" />
                      </button>
                      {devices.length > 0 && (
                        <button
                          onClick={() => handleInlineConfirm('resetDevices', handleResetDevices)}
                          disabled={actionLoading}
                          className={`rounded-lg px-2 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
                            confirmingAction === 'resetDevices'
                              ? 'bg-error-500 text-white'
                              : 'bg-error-500/15 text-error-400 hover:bg-error-500/25'
                          }`}
                        >
                          {confirmingAction === 'resetDevices'
                            ? t('admin.users.detail.actions.areYouSure')
                            : t('admin.users.detail.devices.resetAll')}
                        </button>
                      )}
                    </div>
                  </div>
                  {devicesLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                    </div>
                  ) : devices.length > 0 ? (
                    <div className="space-y-2">
                      {devices.map((device) => {
                        const isEditing = editingDeviceHwid === device.hwid;
                        // Display priority: alias \u2192 model \u2192 platform \u2192 hwid prefix.
                        const displayName =
                          (device.local_name && device.local_name.trim()) ||
                          device.platform ||
                          device.device_model ||
                          device.hwid.slice(0, 12);

                        return (
                          <div
                            key={device.hwid}
                            className="flex items-center justify-between rounded-lg bg-dark-700/50 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingDeviceName}
                                  maxLength={DEVICE_ALIAS_MAX_LENGTH}
                                  placeholder={
                                    device.platform ||
                                    device.device_model ||
                                    device.hwid.slice(0, 12)
                                  }
                                  onChange={(e) => setEditingDeviceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleRenameDevice(device.hwid);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingDeviceHwid(null);
                                      setEditingDeviceName('');
                                    }
                                  }}
                                  className="w-full rounded-md bg-dark-900/70 px-2 py-1 text-xs font-medium text-dark-50 outline-none ring-1 ring-dark-600/60 focus:ring-accent-500/50"
                                />
                              ) : (
                                <div className="truncate text-xs font-medium text-dark-200">
                                  {displayName}
                                </div>
                              )}
                              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-dark-500">
                                {device.device_model && device.platform && (
                                  <span>{device.device_model}</span>
                                )}
                                <span className="font-mono">{device.hwid.slice(0, 8)}...</span>
                                {device.created_at && (
                                  <span>
                                    {new Date(device.created_at).toLocaleDateString(locale)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleRenameDevice(device.hwid)}
                                    disabled={renameSaving}
                                    className="rounded-lg px-2 py-1 text-success-400 transition-all hover:bg-success-500/15 disabled:opacity-50"
                                    title={t(
                                      'admin.users.detail.devices.renameSave',
                                      t(
                                        'common.save',
                                        '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C',
                                      ),
                                    )}
                                    aria-label={t(
                                      'admin.users.detail.devices.renameSave',
                                      '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C',
                                    )}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDeviceHwid(null);
                                      setEditingDeviceName('');
                                    }}
                                    disabled={renameSaving}
                                    className="rounded-lg px-2 py-1 text-dark-500 transition-all hover:bg-dark-700 disabled:opacity-50"
                                    title={t(
                                      'common.cancel',
                                      '\u041E\u0442\u043C\u0435\u043D\u0430',
                                    )}
                                    aria-label={t(
                                      'common.cancel',
                                      '\u041E\u0442\u043C\u0435\u043D\u0430',
                                    )}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDeviceHwid(device.hwid);
                                      setEditingDeviceName(device.local_name || '');
                                    }}
                                    className="rounded-lg px-2 py-1 text-dark-500 transition-all hover:bg-accent-500/15 hover:text-accent-400"
                                    title={t(
                                      'admin.users.detail.devices.rename',
                                      '\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C',
                                    )}
                                    aria-label={t(
                                      'admin.users.detail.devices.rename',
                                      '\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C',
                                    )}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleInlineConfirm(`deleteDevice_${device.hwid}`, () =>
                                        handleDeleteDevice(device.hwid),
                                      )
                                    }
                                    disabled={actionLoading}
                                    className={`rounded-lg px-2 py-1 text-xs transition-all disabled:opacity-50 ${
                                      confirmingAction === `deleteDevice_${device.hwid}`
                                        ? 'bg-error-500 text-white'
                                        : 'text-dark-500 hover:bg-error-500/15 hover:text-error-400'
                                    }`}
                                  >
                                    {confirmingAction === `deleteDevice_${device.hwid}`
                                      ? '?'
                                      : '\u00D7'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-dark-500">
                      {t('admin.users.detail.devices.none')}
                    </div>
                  )}
                </div>

                {/* Subscription Request History */}
                <div className="rounded-xl bg-dark-800/50">
                  <button
                    onClick={() => {
                      const next = !requestHistoryExpanded;
                      setRequestHistoryExpanded(next);
                      if (next && requestHistory.length === 0) {
                        loadRequestHistory(0);
                      }
                    }}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dark-200">
                        {t('admin.users.detail.requestHistory')}
                      </span>
                      {requestHistoryTotal > 0 && (
                        <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs font-medium text-accent-400">
                          {requestHistoryTotal}
                        </span>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 text-dark-500 transition-transform ${requestHistoryExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {requestHistoryExpanded && (
                    <div className="border-t border-dark-700/50 px-4 pb-4 pt-3">
                      {/* Subscription selector for multi-tariff */}
                      {userSubscriptions.length > 1 && (
                        <div className="mb-3">
                          <select
                            value={requestHistorySubId || ''}
                            onChange={(e) => {
                              setRequestHistorySubId(Number(e.target.value) || null);
                            }}
                            className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-100"
                          >
                            {userSubscriptions.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.tariff_name || `#${sub.id}`} — {sub.status}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {requestHistoryLoading && requestHistory.length === 0 ? (
                        <div className="flex justify-center py-6">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                        </div>
                      ) : requestHistory.length === 0 && !requestHistoryLoading ? (
                        <div className="py-6 text-center text-sm text-dark-500">
                          {t('admin.users.detail.noRequests')}
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 text-xs text-dark-500">
                            {t('admin.users.detail.requestHistoryTotal')}: {requestHistoryTotal}
                          </div>

                          {/* Table */}
                          <div className="-mx-4 overflow-x-auto px-4">
                            <table className="w-full min-w-[480px] text-left text-sm">
                              <thead>
                                <tr className="border-b border-dark-700/50 text-xs text-dark-500">
                                  <th className="pb-2 pr-3 font-medium">
                                    {t('admin.users.detail.requestAt')}
                                  </th>
                                  <th className="pb-2 pr-3 font-medium">
                                    {t('admin.users.detail.requestIp')}
                                  </th>
                                  <th className="pb-2 font-medium">
                                    {t('admin.users.detail.requestUserAgent')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {requestHistory.map((record, idx) => (
                                  <tr
                                    key={record.id}
                                    className={`border-b border-dark-700/30 ${idx % 2 === 0 ? 'bg-dark-800/30' : ''}`}
                                  >
                                    <td className="whitespace-nowrap py-2.5 pr-3 text-dark-200">
                                      {formatDate(record.requestAt)}
                                    </td>
                                    <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs text-dark-300">
                                      {record.requestIp || '\u2014'}
                                    </td>
                                    <td
                                      className="max-w-[200px] truncate py-2.5 text-xs text-dark-400"
                                      title={record.userAgent || ''}
                                    >
                                      {record.userAgent
                                        ? record.userAgent.length > 60
                                          ? `${record.userAgent.slice(0, 60)}...`
                                          : record.userAgent
                                        : '\u2014'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Load more */}
                          {requestHistory.length < requestHistoryTotal && (
                            <button
                              onClick={() => loadRequestHistory(requestHistoryOffset, true)}
                              disabled={requestHistoryLoading}
                              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-dark-700/50 py-2.5 text-sm text-dark-300 transition-colors hover:bg-dark-700 disabled:opacity-50"
                            >
                              {requestHistoryLoading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                              ) : (
                                t('admin.users.detail.loadMore')
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Balance Tab */}
        {activeTab === 'balance' && userId && (
          <BalanceTab
            user={user}
            userId={userId}
            hasPermission={hasPermission}
            onUserRefresh={loadUser}
            formatDate={formatDate}
          />
        )}

        {/* Sync Tab */}
        {activeTab === 'sync' && (
          <SyncTab
            user={user}
            syncStatus={syncStatus}
            userSubscriptions={userSubscriptions}
            activeSubscriptionId={activeSubscriptionId}
            onActiveSubscriptionChange={setActiveSubscriptionId}
            actionLoading={actionLoading}
            onSyncFromPanel={handleSyncFromPanel}
            onSyncToPanel={handleSyncToPanel}
            locale={locale}
          />
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && userId && (
          <TicketsTab userId={userId} formatDate={formatDate} />
        )}

        {/* Gifts Tab */}
        {activeTab === 'gifts' && (
          <GiftsTab
            giftsLoading={giftsLoading}
            giftsData={giftsData}
            locale={locale}
            onNavigateToUser={(id) => navigate(`/admin/users/${id}`)}
          />
        )}

        {/* Referrals Tab */}
        {activeTab === 'referrals' && user && userId && (
          <ReferralsTab user={user} userId={userId} onUserRefresh={loadUser} />
        )}
      </div>
    </div>
  );
}
