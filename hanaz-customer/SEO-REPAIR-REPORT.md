# Hanaz Official — SEO Repair Report

**Date:** 2026-09-26  
**Commit:** `67db802` (pushed to `main`)  
**Repository:** fourfrontlab/Hanaz-Official  
**Production:** https://www.hanazofficial.store/

---

## 1. Before-State Findings

### Product Content Errors (Critical)
| Issue | Location | Incorrect | Correct (Owner-Confirmed) |
|-------|----------|-----------|---------------------------|
| Vitamin C form | Serum page title, meta, schema, body, FAQ | "10% SAP" / "10% Ethyl-Ascorbic Acid" | 5% 3-O-Ethyl Ascorbic Acid |
| False ingredients (serum) | Serum key ingredients list | Niacinamide, Glycolic Acid, Ferulic Acid, Green Tea, Aloe Vera | Not present in formulation |
| Missing full ingredients | Serum page | Not listed | AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL |
| Face wash name | All references | "Hanaz Vitamin C Face Cleanser" | HANAZ C-Active Brightening Cleanser and Face Wash |
| Missing concentrations | Face wash key ingredients | "Vitamin C (SAP)" / "Niacinamide" (no %) | Sodium Ascorbyl Phosphate (1%), Niacinamide (3%) |
| Face wash breadcrumb schema | pdp-face-wash.html line 63 | "Vitamin C Serum" | "C-Active Brightening Cleanser and Face Wash" |
| Product schema image (face wash) | pdp-face-wash.html | hanaz-logo.jpg (brand logo) | vitamin-c-facewash.webp (actual product) |
| Missing sizes | Both product pages | Not stated | Serum: 30 ml, Face Wash: 100 ml |

### URL and Redirect Issues
| Legacy URL | Before | After |
|------------|--------|-------|
| /pages/our-story | 404 | 301 to /about.html |
| /pages/contact | 404 | 301 to /contact.html |
| /products/hanaz-vitamin-c-serum | 301 to /products.html (generic) | 301 to /pdp-vitamin-c.html?id=... (actual serum) |
| Canonical URLs (serum) | product-detail.html?id=hanaz-vitamin-c-serum | pdp-vitamin-c.html?id=7ff4066c-... |
| Canonical URLs (face wash) | product-detail.html?id=0aa58f95-... | pdp-face-wash.html?id=0aa58f95-... |
| /index.html to / | Preserved from c88799d | Preserved |

### Homepage SEO
- No H1 tag - critical for search engines
- Organization schema missing alternateName and sameAs
- No WebSite structured data
- "Clinically tested" claims across 6 pages (unsubstantiated)

### Sitemap Issues
- All 14 URLs had fake lastmod 2023-11-01
- Serum URL used non-existent slug product-detail.html?id=hanaz-vitamin-c-serum
- Face wash used product-detail.html URL instead of pdp-face-wash.html

### Crawl/Robots Issues
- Private pages not blocked: account.html, login.html, signup.html, complaint.html

---

## 2. Files Changed

| File | Changes |
|------|---------|
| pdp-vitamin-c.html | Title, meta, OG, canonical, schema, description, ingredients list, FAQ - all corrected to 5% 3-O-Ethyl Ascorbic Acid |
| pdp-face-wash.html | Title, meta, OG, canonical, schema, breadcrumb, H1, ingredient concentrations |
| index.html | Added H1, WebSite schema, Organization alternateName + sameAs, updated meta descriptions |
| about.html | Replaced "clinically tested" with "dermatologist-grade" |
| products.html | Replaced "clinically tested" with "dermatologist-grade" |
| sitemap.xml | Replaced all URLs with canonical versions, removed fake lastmod dates |
| robots.txt | Added Disallow for private/account pages |
| vercel.json | Added redirects: /pages/our-story, /pages/contact, /products/hanaz-vitamin-c-serum |
| eg.html | Removed (test file) |

---

## 3. Product Information Source

All product details are **owner-confirmed** (not independently laboratory-verified):
- Serum: Hanaz Vitamin C Serum, 30 ml, 5% 3-O-Ethyl Ascorbic Acid
- Face Wash: HANAZ C-Active Brightening Cleanser and Face Wash, 100 ml, 3% Niacinamide + 1% SAP

---

## 4. Validation Results

| Check | Result |
|-------|--------|
| No "10% SAP" remaining in serum page | PASS |
| No false ingredients (Ferulic, Glycolic, Green Tea, Aloe Vera) | PASS |
| No Niacinamide reference in serum page | PASS |
| Face wash breadcrumb fixed | PASS |
| "Clinically tested" removed from all pages | PASS |
| Fake 2023-11-01 lastmod removed | PASS |
| Sitemap uses canonical URLs | PASS |
| Homepage has H1 | PASS |
| WebSite schema present | PASS |
| sameAs social profiles added | PASS |
| Legacy redirects configured | PASS |
| robots.txt blocks private pages | PASS |
| /index.html to / preserved | PASS |

---

## 5. Commit and Deployment

- **Commit:** 67db802 pushed to main on 2026-09-26
- **Push:** Successful to fourfrontlab/Hanaz-Official
- **Deployment:** Pending - the Vercel build requires SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET environment variables

**IMPORTANT:** The previous production deployment failed because SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET were not configured in Vercel. The build script check-commerce.cjs will fail without them. These must be set in Vercel encrypted environment settings before the build can succeed.

### Deployment Prerequisites (Manual Steps Required)

1. Go to Vercel Dashboard > Project Settings > Environment Variables
2. Add the following server-side variables:
   - SUPABASE_URL - your Supabase project URL
   - SUPABASE_SERVICE_ROLE_KEY - your Supabase service role key (secret)
   - SESSION_SECRET - at least 32 random characters
   - SITE_ORIGIN - https://www.hanazofficial.store
3. Redeploy from the latest commit

The SEO changes (HTML, sitemap, redirects, robots.txt) are all static files and will be served correctly once the build succeeds.

---

## 6. Search Console Status

- **Domain property:** hanazofficial.store - verified
- **Dashboard:** Currently "Processing data" - metrics unavailable (not zero)
- **Sitemap submission:** Submit https://www.hanazofficial.store/sitemap.xml once the deployment is live
- **URL inspection:** Request indexing for the following after deployment:
  - https://www.hanazofficial.store/ (homepage with new H1)
  - https://www.hanazofficial.store/pdp-vitamin-c.html?id=7ff4066c-ca6d-4fc2-8405-46289d66f05f
  - https://www.hanazofficial.store/pdp-face-wash.html?id=0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39

### Search Console Manual Steps After Deployment

1. Go to Google Search Console > Sitemaps
2. Check existing sitemap submissions - if the old sitemap was submitted, it will auto-update
3. If no sitemap is submitted, add https://www.hanazofficial.store/sitemap.xml
4. Use URL Inspection to request indexing for the 3 key URLs above
5. Do NOT repeatedly submit indexing requests - one submission per URL is sufficient

---

## 7. Remaining Manual Steps

| Step | Owner | Reason |
|------|-------|--------|
| Set Vercel environment variables | Site owner | Required for build to succeed |
| Redeploy on Vercel | Site owner | After environment variables are set |
| Submit sitemap in Search Console | Site owner | After deployment is confirmed live |
| Request indexing for key URLs | Site owner | After sitemap submission |
| Verify live deployment | Site owner | Confirm changes are live on production |
| Update Supabase product records | Site owner | JS dynamically overwrites SEO from DB - see note below |

---

## 8. Measurement Plan

### Baseline
Search Console reports are currently processing - **measurement remains pending**.
Record the first available data as the "before" baseline.

### Metrics to Track (Google Search Console > Performance)

| Metric | Filter | Date Range |
|--------|--------|------------|
| Clicks | Query contains "hanaz" | Compare 28-day periods before/after deployment |
| Impressions | Query contains "hanaz" | Same |
| CTR | Query contains "hanaz" | Same |
| Average Position | Query contains "hanaz" | Same |
| Clicks | Query contains "hanaz official" | Same |
| Clicks | Query contains "hanazofficial" | Same |
| Clicks | Country = Pakistan | Same |
| Impressions | Country = Pakistan | Same |

### Recommended Review Schedule
- Week 1-2: Check indexing status of key URLs
- Week 3-4: First meaningful comparison (28 days post-deployment)
- Week 6-8: Full impact assessment with seasonal adjustments

### Flagged Items (Not Amplified)

The following existing content may constitute unsupported claims and should be reviewed by the site owner:
- "5.0 (Reviews)" rating display with 5 stars on both product pages - these appear to be hardcoded, not from actual customer reviews
- "Verified Buyer" review cards (Sarah M., Ahmed K., Fatima R.) - cannot confirm these are genuine verified purchases
- "DERMATOLOGIST GRADE ACTIVE" badge - the products contain dermatologist-grade ingredients, but this badge might imply dermatologist endorsement
- "Fragrance-free" claim on serum page - the owner-supplied ingredient list does not contain PARFUM/FRAGRANCE, so this appears accurate for the serum

These were NOT removed (they pre-existed and are the owner's responsibility to verify), but they are flagged as potentially unsupported.

---

## 9. JS Dynamic SEO Override Note

The serum page (pdp-vitamin-c.html lines ~1425-1469) contains JavaScript that dynamically overwrites title, meta description, canonical, OG tags, and Product schema from Supabase product data at runtime. The initial server-rendered HTML now has correct values, but if the Supabase products table contains outdated data (e.g., "10% SAP"), the client-side JS will overwrite the corrected HTML. The Supabase product records should also be updated to match.
