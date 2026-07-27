# Semrush Fix Change Log — bookwithkong.com (kong-site-latest)
Date: 3 July 2026

## P1 — SoftwareApplication schema (Issue 45: 36 errors → 0)
Diagnosis: 36 invalid items = 24 bare `about`-array references (6 compare pages × 2 + 2 blog listicles × 5/7) + 12 ItemList comparison items missing Google-required rating. The 11 valid items are the full array-form `["SoftwareApplication","Product"]` blocks (homepage, Australia, 9 product pages) with offers + real aggregateRating — untouched.

- compare/kong-vs-{fareharbor,rezdy,bookeo,checkfront,bokun,amelia}.html:
  - `about` array items: `SoftwareApplication` → `Thing` (name+url only; dropped applicationCategory).
  - ItemList items: `SoftwareApplication` → `Service` with `serviceType: "Tour and activity booking software"` (keeps name/url/description/offers — all valid on Service; no rating requirement). No pricing facts changed.
- blog/best-booking-software-{australia,malaysia}.html: `about` items → `Thing`.
- Zero fabricated ratings/reviews added.

## P2 — Titles, metas, H1s
- Diagnosed 3 "missing title/viewport/lang" pages: the 3 newest blog posts (getyourguide-vs-viator-vs-klook, how-to-get-more-tour-bookings, how-to-become-an-ota-supplier) had a broken head from a template-splice bug: missing `<html lang>`, `<head>`, charset, viewport, GA4 + Clarity tags, unclosed comment. **Fully rebuilt the head opening on all 3** (Issues 3, 20, 114 resolved).
- Duplicate title (index vs australia/index): australia retitled "Kong Australia — free booking system for tour operators" (Issue 6).
- Short titles expanded to 50–60 chars (Issue 101): blog.html ("Tour Operator Blog — Booking, Marketing & Licensing Guides | Kong"), legal-terms.html, privacy-policy, terms-and-conditions, careers-founding-bd.
- Short metas expanded ~150 chars: blog.html, legal-terms.html (Issues 15/106 best-effort).
- H1 audit: every page has exactly one H1 (2-H1 flags were false positives from template comments).

## P3 — Sitemap, redirects, orphans
- Canonical host standardized: all 169 `https://bookwithkong.com/...` URLs (canonicals, og:url, schema @id/mainEntityOfPage/logo) → `https://www.bookwithkong.com/...`, matching sitemap.xml (Issue 214 root cause — internal refs 301ing non-www→www).
- Schema logo URL corrected to the actually-served path: /images/logo.webp.
- 6 blog posts' `<a href="https://www.bookwithkong.com">` → `href="/"` (no more absolute self-links through redirects).
- Sitemap verified: 43 URLs, all www + extensionless + existing files, no redirecting entries (Issue 18).
- Orphan page careers-founding-bd: contextual links added from about.html ("Who we are") and contact-us.html (Issue 213).
- Weak page blog/tourism-tax-malaysia (1 incoming): links added from motac-license-guide and tobtab-licence-explained.
- research one-pager links made extensionless to match site URL convention.

## P4 — Broken things
- 3 broken internal images fixed: legal-terms/{privacy-policy,refund-policy,terms-and-conditions}.html referenced `../logo.webp` (doesn't exist at root) → `../images/logo.webp` (Issue 13: 3 → 0).
- Broken external links (Issue 12, 9 instances) + 403/disallowed resources (218/210): NOT fixable from the codebase without Semrush's per-URL list (export was cut off). Needs the URL list or a live crawl. FLAGGED.

## P5 — Performance
- compare/compare.css minified in place (28.2KB → 22.4KB).
- image-slot.js comments stripped (30.9KB → 20.0KB), syntax-verified.
- All other CSS/JS is inline in HTML or third-party CDN (already minified). If Semrush flagged 8 files, the remainder are host-injected — FLAGGED for hosting check.

## P6 — Mobile/international
- Viewport + lang fixed on the 3 rebuilt blog posts (see P2). All other pages verified to have both.
- HSTS header (Issue 205): hosting-level — FLAGGED for Blake/Zack: add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

## P7 — Content depth (deliberately conservative)
- No filler copy added anywhere (per ground rules).
- Low text-to-HTML ratio (112): product pages are template-heavy by design; no mechanical stripping done to avoid regressions. FLAGGED as accepted/backlog.
- Low word count (117): likely careers-founding-bd + legal hub — flagged for Blake's copy review rather than generated.

## Facts check
No product facts, prices, or claims changed. All edits are markup/metadata or added internal links using existing approved stats.

## Residual items for hosting/Blake
1. HSTS header (server config).
2. Broken external links + 403 resources (need per-URL list).
3. Any host-injected JS/CSS minification.
4. Redeploy + re-run Semrush audit; expected: 36 schema errors → 0, title/meta/H1 errors → 0, redirect notices → ~0.
