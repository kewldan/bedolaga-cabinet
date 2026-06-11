import { type CSSProperties } from 'react';

export type SkeletonVariant = 'text' | 'avatar' | 'card' | 'list' | 'bento';

export interface SkeletonProps {
  /**
   * Variant of skeleton
   * - text: Single line of text
   * - avatar: Circular avatar
   * - card: Full card with header and content
   * - list: Multiple list items
   * - bento: Bento card style (original BentoSkeleton)
   */
  variant?: SkeletonVariant;
  /**
   * Number of skeleton items to render
   */
  count?: number;
  /**
   * Width (for text variant)
   */
  width?: string | number;
  /**
   * Height (for custom sizing)
   */
  height?: string | number;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Whether to animate
   * @default true
   */
  animate?: boolean;
}

const baseClasses = 'bg-dark-800/50 rounded';
const animateClasses = 'animate-pulse';

export function Skeleton({
  variant = 'text',
  count = 1,
  width,
  height,
  className = '',
  animate = true,
}: SkeletonProps) {
  const animation = animate ? animateClasses : '';

  const renderSkeleton = (index: number) => {
    const style: CSSProperties = {
      '--stagger': index,
      width: width,
      height: height,
    } as CSSProperties;

    switch (variant) {
      case 'text':
        return (
          <div
            key={index}
            className={`${baseClasses} ${animation} h-4 ${className}`}
            style={{ ...style, width: width ?? '100%' }}
          />
        );

      case 'avatar':
        return (
          <div
            key={index}
            className={`${baseClasses} ${animation} rounded-full ${className}`}
            style={{ ...style, width: width ?? 40, height: height ?? 40 }}
          />
        );

      case 'card':
        return (
          <div
            key={index}
            className={`${baseClasses} ${animation} border-dark-700/30 rounded-(--bento-radius,24px) border p-4 ${className}`}
            style={style}
          >
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-dark-700/50 h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-dark-700/50 h-4 w-3/4 rounded" />
                <div className="bg-dark-700/50 h-3 w-1/2 rounded" />
              </div>
            </div>
            {/* Content */}
            <div className="space-y-2">
              <div className="bg-dark-700/50 h-3 w-full rounded" />
              <div className="bg-dark-700/50 h-3 w-5/6 rounded" />
              <div className="bg-dark-700/50 h-3 w-4/6 rounded" />
            </div>
          </div>
        );

      case 'list':
        return (
          <div
            key={index}
            className={`${baseClasses} ${animation} flex items-center gap-3 p-3 ${className}`}
            style={style}
          >
            <div className="bg-dark-700/50 h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="bg-dark-700/50 h-4 w-3/4 rounded" />
              <div className="bg-dark-700/50 h-3 w-1/2 rounded" />
            </div>
          </div>
        );

      case 'bento':
      default:
        return (
          <div
            key={index}
            className={`${baseClasses} ${animation} border-dark-700/30 min-h-[160px] w-full rounded-(--bento-radius,24px) border ${className}`}
            style={style}
          />
        );
    }
  };

  if (count > 1) {
    return <>{Array.from({ length: count }).map((_, i) => renderSkeleton(i))}</>;
  }

  return renderSkeleton(0);
}
