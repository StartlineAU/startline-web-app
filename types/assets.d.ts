// Stylesheet side-effect imports. TypeScript 6 type-checks these (TS2882) and
// Next's `next/types/global.d.ts` only declares `*.module.css`, so a plain
// `import "./globals.css"` would otherwise fail `pnpm typecheck`.
declare module "*.css";
