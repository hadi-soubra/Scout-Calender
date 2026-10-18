# Beirut 02 Calendar

A shared calendar for the group. Each unit signs in with its own account and pins its events, so everyone can see what's happening at the same time.

- **Frontend:** Angular, with FullCalendar for the month, week and list views (`web/`)
- **Backend:** a Cloudflare Worker using Hono (`worker/`), with a Cloudflare D1 database (`migrations/`)
- **Accounts:** one per unit. A unit can edit only its own pins; the Group (admin) account can edit everything.

## First-time setup

```sh
npm install
npm --prefix web install
npx wrangler login
```

`accounts.json` holds the unit emails, names, colours and initial passwords. It is **gitignored**: keep it private. The seed script hashes the passwords before they go into the database.

## Run locally

```sh
npm run db:migrate:local
npm run seed:local
npm run dev            # builds Angular, then serves on http://localhost:8787
```

## Deploy to Cloudflare

1. Create the database and copy the `database_id` it prints into `wrangler.jsonc`:
   ```sh
   npx wrangler d1 create scout-calendar
   ```
2. Create the tables and the accounts:
   ```sh
   npm run db:migrate:remote
   npm run seed:remote
   ```
3. Deploy:
   ```sh
   npm run deploy
   ```
   The site is live at `https://scout-calendar.<your-subdomain>.workers.dev`. To use your own domain, go to the Cloudflare dashboard, open **Workers & Pages → scout-calendar → Settings → Domains & Routes**.

Later updates only need `npm run deploy`.

## Managing accounts

- To change a password, or to change a unit's name or colour, edit `accounts.json` and run `npm run seed:remote` again. This **overwrites the passwords of every account listed** with the values in the file. Pins are kept.
- To add a unit, add an entry to `accounts.json` and run the seed again.
