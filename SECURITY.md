# Security Policy

## Reporting Security Issues
If you discover any security vulnerabilities within this application, please report them directly to:
**Security Contact:** info@puenpublishing.com

Please do not open public issues for sensitive security disclosures.

## Implemented Protections
- **Row Level Security (RLS):** Enabled and enforced on Supabase PostgreSQL. Anon keys have default-deny policy; mutations are authenticated via server-side service-role.
- **Stripe Webhook Signature Verification:** Mandatory signing secret checks prevent unsigned/spoofed events.
- **Server-Side Grading & Validation:** Gamification quiz answers and sticker completions are verified on the server with IP rate limiting.
- **Sanitized Secrets:** No production secrets are committed in git. All runtime credentials are encrypted via Vercel Environment Variables.
