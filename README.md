# Farmforge

A browser-based farm and automation game built with vanilla HTML, CSS, JavaScript, Cloudflare Workers, and Cloudflare D1.

The goal is to grow a small manual farm into an automated production system by unlocking new capabilities rather than repeatedly buying percentage upgrades.

## Current vertical slice

The first playable slice focuses on one complete loop:

- create an account or log in
- load a persistent save
- plant wheat on an 8 x 8 farm
- wait for it to grow
- harvest it
- sell stored wheat
- unlock a harvester that automatically harvests mature crops
- save progress back to D1

## Project structure

```text
/public
  index.html
  /css
    main.css
  /js
    main.js
    game.js
    renderer.js
    input.js
    api.js
    /data
      crops.js
      upgrades.js

/src
  worker.js
  /api
    auth.js
    save.js
  /db
    database.js

/schema
  schema.sql

/tests
  game.test.mjs

wrangler.toml
```

Client gameplay is separated from rendering and input. Content such as crops and unlocks is data-driven. Authentication, persistence, and database access remain server-side.

## Cloudflare setup

1. Create a D1 database:

```bash
npx wrangler d1 create farmforge
```

2. Copy the returned database ID into `wrangler.toml`.

3. Apply the schema:

```bash
npx wrangler d1 execute farmforge --file=./schema/schema.sql
```

For a local D1 database during development:

```bash
npx wrangler d1 execute farmforge --local --file=./schema/schema.sql
```

4. Start local development:

```bash
npm run dev
```

5. Deploy:

```bash
npm run deploy
```

## Development checks

The core simulation has dependency-free tests using Node's built-in test runner:

```bash
npm test
```

## Saves

The active game state lives in one client-side state object. The client periodically saves that state as JSON through `POST /api/save`, and the Worker stores it in D1.

The initial save format intentionally stays small and flexible:

```json
{
  "version": 1,
  "money": 20,
  "inventory": { "wheat": 0 },
  "farm": [],
  "unlocks": [],
  "lastUpdated": 0
}
```

## Authentication

Accounts use username + password. Passwords are salted and hashed server-side with PBKDF2-SHA256. Successful authentication creates a random session token stored in a Secure, HTTP-only, SameSite cookie when served over HTTPS. Only a SHA-256 hash of the session token is stored in D1.

## Adding game content

Add crops to `public/js/data/crops.js` and unlocks to `public/js/data/upgrades.js`. Core gameplay reads values from these definitions instead of repeating crop prices, growth times, or unlock costs throughout the code.

Keep additions straightforward: add configuration first, then only extend core systems when the new mechanic actually requires it.
