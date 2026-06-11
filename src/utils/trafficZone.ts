export type TrafficZone = 'normal' | 'warning' | 'danger' | 'critical';

export type TrafficColorKey = 'accent' | 'warning' | 'error';

interface TrafficZoneResult {
  zone: TrafficZone;
  textClass: string;
  dotClass: string;
  glowColor: string;
  labelKey: string;
  gradientFrom: string;
  gradientTo: string;
  /** CSS variable for the main zone color: `rgb(var(--rt-accent-400))` */
  mainVar: string;
  /** Raw CSS variable reference for opacity manipulation: `var(--rt-accent-400)` */
  mainVarRaw: string;
  /** Key into ThemeColors for resolving mainHex at runtime */
  colorKey: TrafficColorKey;
}

const ZONES: Record<TrafficZone, Omit<TrafficZoneResult, 'zone'>> = {
  normal: {
    textClass: 'text-accent-400',
    dotClass: 'bg-accent-400',
    glowColor: 'rgba(var(--rt-accent-500), 0.5)',
    labelKey: 'dashboard.zone.normal',
    gradientFrom: 'rgb(var(--rt-accent-500))',
    gradientTo: 'rgb(var(--rt-accent-400))',
    mainVar: 'rgb(var(--rt-accent-400))',
    mainVarRaw: 'var(--rt-accent-400)',
    colorKey: 'accent',
  },
  warning: {
    textClass: 'text-warning-400',
    dotClass: 'bg-warning-400',
    glowColor: 'rgba(var(--rt-warning-500), 0.5)',
    labelKey: 'dashboard.zone.warning',
    gradientFrom: 'rgb(var(--rt-warning-500))',
    gradientTo: 'rgb(var(--rt-warning-400))',
    mainVar: 'rgb(var(--rt-warning-400))',
    mainVarRaw: 'var(--rt-warning-400)',
    colorKey: 'warning',
  },
  danger: {
    textClass: 'text-warning-300',
    dotClass: 'bg-warning-300',
    glowColor: 'rgba(var(--rt-warning-400), 0.5)',
    labelKey: 'dashboard.zone.danger',
    gradientFrom: 'rgb(var(--rt-warning-600))',
    gradientTo: 'rgb(var(--rt-warning-400))',
    mainVar: 'rgb(var(--rt-warning-400))',
    mainVarRaw: 'var(--rt-warning-400)',
    colorKey: 'warning',
  },
  critical: {
    textClass: 'text-error-400',
    dotClass: 'bg-error-400',
    glowColor: 'rgba(var(--rt-error-500), 0.5)',
    labelKey: 'dashboard.zone.critical',
    gradientFrom: 'rgb(var(--rt-error-500))',
    gradientTo: 'rgb(var(--rt-error-400))',
    mainVar: 'rgb(var(--rt-error-400))',
    mainVarRaw: 'var(--rt-error-400)',
    colorKey: 'error',
  },
};

export function getTrafficZone(percent: number): TrafficZoneResult {
  let zone: TrafficZone;
  if (percent >= 90) zone = 'critical';
  else if (percent >= 75) zone = 'danger';
  else if (percent >= 50) zone = 'warning';
  else zone = 'normal';

  return { zone, ...ZONES[zone] };
}
