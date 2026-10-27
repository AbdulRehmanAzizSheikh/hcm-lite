# HCM Lite — AI-assisted Human Capital Management

Single Next.js app (frontend + backend in one project). Deploy once.

Stack: **Next.js 16 + React 19** (frontend) and **Next.js API routes wrapping Express + MongoDB** (backend).

## Quick start
```bash
cd project
cp .env.example .env.local
# edit .env.local: set MONGODB_URI, JWT_SECRET, (optional) AI_API_KEY
npm install
npm run dev   # http://localhost:3000
```
First run: open /setup to create company + Admin.

## Deploy (single)
- Vercel: import repo, set env vars from .env.example, deploy. Done.
- Or any Node host: `npm run build && npm start`.

## Roles
Admin, HR, Employee — same as brief.

## AI
Default Gemini (gemini-3-flash-preview). Leave AI_API_KEY empty for free Pollinations fallback.

## What's done
All 25 functionalities + RBAC + analytics + AI (chat/summary/smart-leave/policy Q&A) + payslip PDF + audit log + i18n (EN/UR/Roman Urdu/AR) + user guide.
