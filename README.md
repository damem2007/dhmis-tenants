# DHMIS Tenant Web

The tenant public website and storefront application.

## Installation

Requirements: Node.js 20+ and a running DHMIS Backend.

```bash
cd tenant-web
npm install
cp .env.example .env.local
npm run dev
```

Set VITE_API_BASE_URL, the optional tenant slug, and the app environment in .env.local. Build with npm run build; preview with npm run preview.
