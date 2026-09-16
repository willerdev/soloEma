# Trade Guard Solo (soloEma)

Investor-only product: login, wallet, Smart Invest, blockchain contract, settings.

Separate from [thetradeguard.com](https://thetradeguard.com). Own database and JWT.

## Layout

- `backend/` — NestJS (`APP_VARIANT=solo`, entry `npm run start:solo`)
- `solo/` — Next.js UI (port 3001 locally)

## Local

```bash
cd backend
APP_VARIANT=solo DATABASE_URL=... npm run start:solo:dev
```

```bash
cd solo
NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1 npm run dev
```

## Deploy

See `.github/DEPLOY.md`.
