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

## Notes

- The main dashboard UI lives in options-dashboard-app/app/page.tsx.
- shadcn/ui components are in options-dashboard-app/components/ui.
- If you see missing imports from @/components/ui, re-run shadcn component add commands.