# Tailscale Proxy POC Brainstorm

**Date:** 2026-02-01
**Status:** Ready for implementation

## What We're Building

A minimal proof-of-concept to validate that Playwright can route browser traffic through a Tailscale exit node when running in a containerized VPS environment.

**Core validation:**
1. Verify outbound IP is the exit node's IP (not the VPS IP)
2. Successfully login to PCSE website through the proxy
3. Capture screenshots as proof of both validations

## Why This Approach

**Single-file test script** chosen because:
- Absolute minimum complexity for validation
- Easy to deploy and delete after POC is validated
- No framework overhead - just Playwright + TypeScript
- Mirrors the production pattern (Tailscale sidecar + app container) at minimal scale

**Raw Playwright** (no Stagehand) because:
- PCSE login uses stable CSS selectors that don't need AI detection
- Reduces dependencies and container size
- Simpler debugging

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project location | Standalone `tailscale-proxy-test` | Clean separation, disposable after validation |
| Dependencies | Raw Playwright only | Minimum for the task |
| Build system | TypeScript with simple tsc/bun | Familiar from existing repo |
| Docker pattern | Tailscale sidecar (same as pcse-automation) | Proven pattern, validates same architecture |
| Success criteria | IP verification + login + screenshots | Proves routing AND functionality |

## Technical Approach

### Test Flow
1. Launch browser with SOCKS5 proxy pointing to Tailscale container
2. Navigate to IP-check service (api.ipify.org or similar)
3. Log + screenshot the detected IP
4. Navigate to PCSE login page
5. Fill credentials from environment variables
6. Wait for success (practice selection page) or failure (error element)
7. Screenshot result
8. Exit with code 0 (success) or 1 (failure)

### Docker Architecture
```
┌─────────────────────────────────────────┐
│  docker-compose.yml                     │
├─────────────────────────────────────────┤
│  tailscale:                             │
│    - TS_AUTHKEY (auth key)              │
│    - TS_EXIT_NODE (exit node IP)        │
│    - SOCKS5 on port 1080                │
│    - Health check before app starts     │
├─────────────────────────────────────────┤
│  app:                                   │
│    - Playwright + test script           │
│    - TAILSCALE_PROXY_URL=socks5://...   │
│    - PCSE credentials from env          │
│    - depends_on: tailscale (healthy)    │
└─────────────────────────────────────────┘
```

### Files to Create
```
tailscale-proxy-test/
├── src/
│   └── test.ts           # The single test file (~50 lines)
├── docker-compose.yml    # Tailscale + app containers
├── Dockerfile            # Minimal: node + playwright
├── package.json          # playwright, typescript
├── tsconfig.json         # Basic TS config
├── .env.example          # Document required vars
└── README.md             # How to run
```

## Open Questions

None - ready to implement.

## Next Steps

Run `/workflows:plan` to generate implementation plan, then build it.
