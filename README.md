# options-dashboard

Next.js trading dashboard workspace.

## Project Structure

- options-dashboard-app: Next.js app (App Router, TypeScript, Tailwind, shadcn/ui)

## Prerequisites

- Node.js 20+
- npm 10+

## Install Dependencies

From the app directory:

```bash
cd options-dashboard-app
npm install
```

## Run Locally

```bash
cd options-dashboard-app
npm run dev
```

Open http://localhost:3000.

## Build For Production

```bash
cd options-dashboard-app
npm run build
npm run start
```

## Deploy to Vercel

1. Connect your GitHub repo to Vercel.
2. In Vercel Dashboard → your project → Settings → Environment Variables, add:
   - `TRADIER_API_KEY` = your real Tradier API key
   - Optional: `TRADIER_BASE_URL` = `https://sandbox.tradier.com` (for paper trading)
3. Select which environments get these vars (Production, Preview, Development).
4. Save and redeploy:
   - Push a new commit to main to trigger auto-deploy, or
   - Go to Deployments tab and click Redeploy on the latest build.

## Notes

- The main dashboard UI lives in options-dashboard-app/app/page.tsx.
- shadcn/ui components are in options-dashboard-app/components/ui.
- If you see missing imports from @/components/ui, re-run shadcn component add commands.
- The Tradier API integration runs server-side via `/api/tradier/snapshot` route so keys never leave the server.