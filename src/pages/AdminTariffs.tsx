import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tariffsApi, TariffListItem } from '../api/tariffs';
import { useDestructiveConfirm, useNotify } from '@/platform';
import { usePlatform } from '../platform/hooks/usePlatform';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BackIcon,
  CheckIcon,
  EditIcon,
  GiftIcon,
  GripIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from '@/components/icons';

// ============ Sortable Tariff Card ============

interface SortableTariffCardProps {
  tariff: TariffListItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onToggleTrial: () => void;
}

function SortableTariffCard({
  tariff,
  onEdit,
  onDelete,
  onToggle,
  onToggleTrial,
}: SortableTariffCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tariff.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-dark-800 rounded-xl border p-4 transition-colors ${
        isDragging
          ? 'border-accent-500/50 shadow-accent-500/20 shadow-xl'
          : tariff.is_active
            ? 'border-dark-700'
            : 'border-dark-700/50 opacity-60'
      }`}
    >
      <div className="flex gap-3">
        <button
          {...attributes}
          {...listeners}
          className="text-dark-500 hover:bg-dark-700/50 hover:text-dark-300 mt-1 shrink-0 cursor-grab touch-none rounded-lg p-2.5 active:cursor-grabbing sm:p-1.5"
          title={t('admin.tariffs.dragToReorder')}
        >
          <GripIcon />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-dark-100 truncate font-medium">{tariff.name}</h3>
                {tariff.is_daily ? (
                  <span className="bg-warning-500/20 text-warning-400 rounded px-2 py-0.5 text-xs">
                    {t('admin.tariffs.dailyType')}
                  </span>
                ) : (
                  <span className="bg-accent-500/20 text-accent-400 rounded px-2 py-0.5 text-xs">
                    {t('admin.tariffs.periodType')}
                  </span>
                )}
                {tariff.is_trial_available && (
                  <span className="bg-success-500/20 text-success-400 rounded px-2 py-0.5 text-xs">
                    {t('admin.tariffs.trial')}
                  </span>
                )}
                {tariff.show_in_gift && (
                  <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                    <GiftIcon className="h-3 w-3" />
                    {t('admin.tariffs.giftBadge')}
                  </span>
                )}
                {!tariff.is_active && (
                  <span className="bg-dark-600 text-dark-400 rounded px-2 py-0.5 text-xs">
                    {t('admin.tariffs.inactive')}
                  </span>
                )}
              </div>
              <div className="text-dark-400 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {tariff.is_daily && tariff.daily_price_kopeks > 0 && (
                  <span className="text-warning-400">
                    {(tariff.daily_price_kopeks / 100).toFixed(2)}{' '}
                    {t('admin.tariffs.currencyPerDay')}
                  </span>
                )}
                <span>
                  {tariff.traffic_limit_gb === 0
                    ? t('admin.tariffs.unlimited')
                    : `${tariff.traffic_limit_gb} GB`}
                </span>
                <span>{t('admin.tariffs.devices', { count: tariff.device_limit })}</span>
                <span>{t('admin.tariffs.servers', { count: tariff.servers_count })}</span>
                <span>
                  {t('admin.tariffs.subscriptions', { count: tariff.subscriptions_count })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                onClick={onToggle}
                className={`rounded-lg p-2 transition-colors ${
                  tariff.is_active
                    ? 'bg-success-500/20 text-success-400 hover:bg-success-500/30'
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                }`}
                title={
                  tariff.is_active ? t('admin.tariffs.deactivate') : t('admin.tariffs.activate')
                }
              >
                {tariff.is_active ? <CheckIcon /> : <XIcon />}
              </button>

              <button
                onClick={onToggleTrial}
                className={`rounded-lg p-2 transition-colors ${
                  tariff.is_trial_available
                    ? 'bg-accent-500/20 text-accent-400 hover:bg-accent-500/30'
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                }`}
                title={t('admin.tariffs.toggleTrial')}
              >
                <GiftIcon />
              </button>

              <button
                onClick={onEdit}
                className="bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-100 rounded-lg p-2 transition-colors"
                title={t('admin.tariffs.edit')}
              >
                <EditIcon />
              </button>

              <button
                onClick={onDelete}
                className="bg-dark-700 text-dark-300 hover:bg-error-500/20 hover:text-error-400 rounded-lg p-2 transition-colors"
                title={t('admin.tariffs.delete')}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function AdminTariffs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDelete = useDestructiveConfirm();
  const notify = useNotify();
  const { capabilities } = usePlatform();

  const [localTariffs, setLocalTariffs] = useState<TariffListItem[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);

  // Queries
  const { data: tariffsData, isLoading } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => tariffsApi.getTariffs(true),
  });

  // Sync fetched data to local state
  useEffect(() => {
    if (tariffsData?.tariffs && !orderChanged) {
      setLocalTariffs(tariffsData.tariffs);
    }
  }, [tariffsData, orderChanged]);

  // Save order mutation
  const saveOrderMutation = useMutation({
    mutationFn: (tariffIds: number[]) => tariffsApi.updateOrder(tariffIds),
    onSuccess: () => {
      setOrderChanged(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      notify.success(t('admin.tariffs.orderSaved'));
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: tariffsApi.deleteTariff,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      if (data.affected_subscriptions > 0) {
        notify.success(
          t('admin.tariffs.deleteSuccessWithSubscriptions', { count: data.affected_subscriptions }),
        );
      } else {
        notify.success(t('admin.tariffs.deleteSuccess'));
      }
    },
  });

  const handleDelete = async (tariff: TariffListItem) => {
    const confirmText =
      tariff.subscriptions_count > 0
        ? t('admin.tariffs.confirmDeleteWithSubscriptions', {
            count: tariff.subscriptions_count,
          })
        : t('admin.tariffs.confirmDeleteText');

    const confirmed = await confirmDelete(
      confirmText,
      t('common.delete'),
      t('admin.tariffs.confirmDelete'),
    );

    if (confirmed) {
      deleteMutation.mutate(tariff.id);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: tariffsApi.toggleTariff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
  });

  const toggleTrialMutation = useMutation({
    mutationFn: tariffsApi.toggleTrial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalTariffs((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      setOrderChanged(true);
    }
  }, []);

  const handleSaveOrder = () => {
    saveOrderMutation.mutate(localTariffs.map((t) => t.id));
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <h1 className="text-dark-100 text-xl font-bold">{t('admin.tariffs.title')}</h1>
            <p className="text-dark-400 text-sm">{t('admin.tariffs.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orderChanged && (
            <button
              onClick={handleSaveOrder}
              disabled={saveOrderMutation.isPending}
              className="bg-success-500 hover:bg-success-600 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
            >
              {saveOrderMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <SaveIcon className="h-4 w-4" />
              )}
              {t('admin.tariffs.saveOrder')}
            </button>
          )}
          <button
            onClick={() => navigate('/admin/tariffs/create')}
            className="bg-accent-500 text-on-accent hover:bg-accent-600 flex items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors"
          >
            <PlusIcon />
            {t('admin.tariffs.create')}
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="text-dark-500 mb-4 flex items-center gap-2 text-sm">
        <GripIcon />
        {t('admin.tariffs.dragToReorder')}
      </div>

      {/* Tariffs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="border-accent-500 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : localTariffs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-dark-400">{t('admin.tariffs.noTariffs')}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={localTariffs.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {localTariffs.map((tariff) => (
                <SortableTariffCard
                  key={tariff.id}
                  tariff={tariff}
                  onEdit={() => navigate(`/admin/tariffs/${tariff.id}/edit`)}
                  onDelete={() => handleDelete(tariff)}
                  onToggle={() => toggleMutation.mutate(tariff.id)}
                  onToggleTrial={() => toggleTrialMutation.mutate(tariff.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
