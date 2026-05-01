<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Image optimization

`next.config.ts` sets `images: { unoptimized: true }` intentionally.
Client-side WebP compression runs at upload (`src/lib/image.ts`); images are served raw from Supabase Storage CDN.
Do NOT remove `unoptimized: true` without a quota plan — Vercel Hobby tier caps image transforms at 5K/mo.
