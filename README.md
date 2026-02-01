# Tailscale Proxy POC

Minimal proof-of-concept to validate Playwright can route browser traffic through a Tailscale exit node in a containerized environment.

## What it does

1. Checks outbound IP via api.ipify.org (verifies traffic goes through exit node)
2. Logs into PCSE website
3. Takes screenshots at each step as proof
4. Exits with code 0 (success) or 1 (failure)

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `TS_AUTHKEY` - Tailscale auth key from admin console
   - `TS_EXIT_NODE` - The 100.x.x.x IP of your exit node
   - `PCSE_USERNAME` / `PCSE_PASSWORD` - PCSE credentials

2. Run:
   ```bash
   docker compose up --build
   ```

3. Check results:
   - Exit code: 0 = success, 1 = failure
   - Screenshots in `./screenshots/` directory

## Local development (without Tailscale)

```bash
npm install
npm run build
PCSE_USERNAME=x PCSE_PASSWORD=y npm run test
```

Or with bun:
```bash
bun install
PCSE_USERNAME=x PCSE_PASSWORD=y bun run dev
```
