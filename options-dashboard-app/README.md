This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Trade Persistence (Important)

Trades are always saved to browser storage. To keep trades across devices, browser resets, and redeploys,
you must configure cloud sync using Vercel Blob.

1. In Vercel, create/connect a Blob store for this project.
2. Add `BLOB_READ_WRITE_TOKEN` in Project Settings -> Environment Variables.
3. Redeploy the project.

If cloud sync is missing, the dashboard will show `Cloud sync not configured`, and trades will only exist
in the browser where they were entered.

## Tradier Setup

1. Create a local env file:

```bash
cp .env.example .env.local
```

2. Add your Tradier API key to `TRADIER_API_KEY` in `.env.local`.

3. Optional: if you are using paper/sandbox access, also set:

```bash
TRADIER_BASE_URL=https://sandbox.tradier.com
```

The app uses a server route (`/api/tradier/snapshot`) so your Tradier key does not need to be sent directly to Tradier from the browser.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
