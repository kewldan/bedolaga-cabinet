import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GiftIcon } from '@/components/icons';
import type { PendingGift } from '../../api/gift';

interface PendingGiftCardProps {
  gifts: PendingGift[];
  className?: string;
}

export default function PendingGiftCard({ gifts, className }: PendingGiftCardProps) {
  const { t } = useTranslation();

  if (gifts.length === 0) return null;

  return (
    <div className={className ?? 'space-y-3'}>
      {gifts.map((gift) => (
        <motion.div
          key={gift.token}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-accent-500/30 from-accent-500/10 to-accent-500/10 relative overflow-hidden rounded-2xl border bg-linear-to-r via-purple-500/10 p-5"
        >
          {/* Subtle glow effect */}
          <div className="bg-accent-500/10 absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl" />

          <div className="relative flex items-start gap-4">
            {/* Gift icon */}
            <div className="bg-accent-500/20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <GiftIcon className="text-accent-400 h-6 w-6" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <h3 className="text-dark-50 text-sm font-semibold">{t('gift.pending.title')}</h3>
              <p className="text-dark-300 mt-0.5 text-xs">
                {gift.tariff_name && (
                  <span>
                    {gift.tariff_name} — {gift.period_days} {t('gift.days')}
                  </span>
                )}
                {gift.sender_display && (
                  <span className="text-dark-400 ml-1">
                    {t('gift.pending.from', { sender: gift.sender_display })}
                  </span>
                )}
              </p>
              {gift.gift_message && (
                <p className="text-dark-400 mt-1.5 line-clamp-2 text-xs italic">
                  &ldquo;{gift.gift_message}&rdquo;
                </p>
              )}
            </div>

            {/* Activate button */}
            <Link
              to={`/gift?tab=activate&code=${gift.token}`}
              className="bg-accent-500 text-on-accent hover:bg-accent-400 shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            >
              {t('gift.pending.activate')}
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
