This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Monitor de uso (D1)

`/admin/metrics` muestra tasa de éxito, distribución de fuentes del Sankey
(8-K vs XBRL vs Yahoo fallback), errores por etapa y tickers que más fallan.
Cada request a `/api/analyze` escribe una fila en una D1 (best-effort,
no bloquea el response).

### Setup inicial

```bash
# 1. Crear la base D1 (devuelve un database_id)
wrangler d1 create ticker-metrics

# 2. Pegar el database_id en wrangler.toml
#    (campo database_id bajo [[d1_databases]])

# 3. Aplicar el schema
wrangler d1 execute ticker-metrics --file=db/schema.sql --remote
wrangler d1 execute ticker-metrics --file=db/schema.sql --local   # para dev

# 4. Setear ADMIN_TOKEN en Cloudflare:
#    Pages → Settings → Environment variables → Production
#    Local dev: copiar a .dev.vars como ADMIN_TOKEN=...
```

### Retención

`/api/admin/retention?days=90` borra eventos viejos. Llamarlo desde un cron
externo (Cloudflare Worker con cron trigger, cron-job.org, etc.) una vez al
día con header `x-admin-token`.

### Queries útiles

```bash
# Tasa de errores últimas 24h
wrangler d1 execute ticker-metrics --remote --command \
  "SELECT status, COUNT(*) FROM analyze_events WHERE ts >= unixepoch()*1000 - 86400000 GROUP BY status"

# Tickers que más fallaron esta semana
wrangler d1 execute ticker-metrics --remote --command \
  "SELECT ticker, COUNT(*) AS errors FROM analyze_events WHERE status='error' AND ts >= unixepoch()*1000 - 7*86400000 GROUP BY ticker ORDER BY errors DESC LIMIT 10"
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
