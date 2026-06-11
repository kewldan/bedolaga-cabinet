import TwemojiImport from 'react-twemoji';

/**
 * react-twemoji — старый CJS-пакет, экспортирующий `{ default: Component }`
 * без маркера `__esModule`. Интероп у бандлеров расходится: esbuild/Rollup
 * разворачивали default сами, Rolldown (Vite 8) отдаёт объект модуля как есть,
 * и React падает с «Element type is invalid: ... got: object».
 * Шим нормализует оба варианта — все импорты идут через него.
 */
type TwemojiComponent = typeof TwemojiImport;

const candidate = TwemojiImport as TwemojiComponent | { default: TwemojiComponent };

const Twemoji: TwemojiComponent =
  typeof candidate === 'function'
    ? candidate
    : (candidate as { default: TwemojiComponent }).default;

export default Twemoji;
