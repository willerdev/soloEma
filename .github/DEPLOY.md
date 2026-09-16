# Deploy Trade Guard Solo (soloEma)

This repo is **Trade Guard Solo** only. It does not share the traders database or JWT.

## Render services

| Name | Root | Start |
|------|------|--------|
| **solo-api** | `backend` | `npm run prisma:push && npm run start:solo` |
| **solo-web** | `solo` | `npm start` |

Health check: `/api/v1/health`

## One-time setup

1. **Neon** — new project / database. Paste `DATABASE_URL` on **solo-api** only.
2. **solo-api env** — new `JWT_SECRET`, `APP_VARIANT=solo`, `FRONTEND_URL` / `PUBLIC_APP_URL` = Solo site, `API_PUBLIC_URL` = Solo API origin (NOWPayments IPN). Copy `NOWPAYMENTS_*`, `FLW_*`, `RESEND_API_KEY`, `EMAIL_FROM` from traders-api if you use the same payment/email accounts.
3. **solo-web env** — `API_URL` = solo-api origin, `NEXT_PUBLIC_API_URL` = that origin + `/api/v1`.
4. **GitHub secrets** (optional auto-deploy): `RENDER_DEPLOY_HOOK_SOLO_API`, `RENDER_DEPLOY_HOOK_SOLO_WEB`.
