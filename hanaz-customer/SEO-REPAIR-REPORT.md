# Hanaz Official — SEO Repair Report

**Date:** 2026-09-26  
**Repository:** fourfrontlab/Hanaz-Official  
**Production:** https://www.hanazofficial.store/

---

## 1. Before-State Findings & Fixes Applied (Local Code)

### Product Content Errors (Owner-Confirmed Formulation)
| Issue | Incorrect | Corrected To |
|-------|-----------|--------------|
| Vitamin C form | "10% SAP" / "10% Ethyl-Ascorbic Acid" | 5% 3-O-Ethyl Ascorbic Acid |
| False ingredients (serum) | Niacinamide, Glycolic Acid, Ferulic Acid, Green Tea, Aloe Vera | Removed from formulation |
| Missing full ingredients | Not listed | Added full INCI (AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN...) |
| Face wash name | "Hanaz Vitamin C Face Cleanser" | HANAZ C-Active Brightening Cleanser & Face Wash |
| Missing concentrations | "Vitamin C (SAP)" / "Niacinamide" | Sodium Ascorbyl Phosphate (1%), Niacinamide (3%) |
| Face wash schema & image | "Vitamin C Serum", logo used as image | "C-Active Brightening Cleanser & Face Wash", actual product image used |
| Substantive claims | "Clinically tested" across multiple pages | "Premium", "High-Quality Active Ingredients", "Expertly formulated" (neutral/factual wording) |

### URL, Redirect, and Crawl Issues
| Issue | Before | After |
|-------|--------|-------|
| Legacy URLs (404) | `/pages/our-story`, `/pages/contact` | 301 to `/about.html` and `/contact.html` (via `vercel.json`) |
| Legacy Product URL | `/products/hanaz-vitamin-c-serum` | 301 to `pdp-vitamin-c.html` |
| Canonical URLs | Overridden by JS to non-existent slugs | Preserved correct pathname in JS, static HTML updated |
| Homepage SEO | Missing H1, WebSite schema, sameAs | Added H1, WebSite schema, Organization alternateName and sameAs |
| Sitemap | Fake 2023-11-01 dates, wrong URLs | Dates removed, canonical URLs used |
| Private Page Indexing | Not protected | Added `<meta name="robots" content="noindex">` to `login.html`, `signup.html`, `account.html`, `checkout.html`, `track-order.html`, `complaint.html` |

---

## 2. Supabase Metadata Override (Action Required)

The product pages use client-side JavaScript to fetch data from Supabase, which currently overwrites the SEO metadata (`document.title`, `metaDesc`, `ogTitle`, `ogDesc`, and `schemaScript`) on page load. While I have updated the static HTML, **the JavaScript will inject the database values on runtime**. 

To ensure consistency and prevent the old, incorrect data from flashing or replacing the corrected SEO, the site owner MUST update the `products` table in Supabase.

### Required Database Updates (Run in Supabase SQL Editor):

```sql
-- 1. Create a recoverable backup of the affected fields
CREATE TABLE IF NOT EXISTS products_seo_backup_20260926 AS 
SELECT id, title, description, ingredients 
FROM products 
WHERE id IN (
  '7ff4066c-ca6d-4fc2-8405-46289d66f05f', 
  '0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39'
);

-- 2. Update Vitamin C Serum
UPDATE products 
SET 
  title = 'Hanaz Vitamin C Serum',
  description = 'Brightening antioxidant serum with 5% 3-O-Ethyl Ascorbic Acid, Sodium Hyaluronate, and Vitamin E. 30 ml. Available in Pakistan.',
  -- Adjust the syntax below if ingredients is a JSONB array in your schema
  ingredients = 'AQUA / WATER • 3-O-ETHYL ASCORBIC ACID • GLYCERIN • SODIUM HYALURONATE • POLYSORBATE 20 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL'
WHERE id = '7ff4066c-ca6d-4fc2-8405-46289d66f05f';

-- 3. Update Face Wash
UPDATE products 
SET 
  title = 'HANAZ C-Active Brightening Cleanser & Face Wash',
  description = 'Brightening face wash with 3% Niacinamide and 1% Sodium Ascorbyl Phosphate. Gently removes impurities while brightening your complexion. 100 ml. Available in Pakistan.',
  -- Adjust the syntax below if ingredients is a JSONB array in your schema
  ingredients = 'AQUA/WATER • GLYCERIN • COCAMIDOPROPYL BETAINE • PROPANEDIOL • SODIUM COCOYL ISETHIONATE • NIACINAMIDE • SODIUM ASCORBYL PHOSPHATE • PEG-40 HYDROGENATED CASTOR OIL • SIMMONDSIA CHINENSIS (JOJOBA) SEED OIL • PROPYLENE GLYCOL • PEG-150 PENTAERYTHRITYL TETRASTEARATE (AND) PPG-2 HYDROXYETHYL COCAMIDE • POLYSORBATE 20 • POLYSORBATE 80 • TOCOPHEROL • DISODIUM EDTA • PHENOXYETHANOL (AND) ETHYLHEXYLGLYCERIN • SODIUM HYDROXIDE • PARFUM/FRAGRANCE'
WHERE id = '0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39';
```

*(Note: Prices, stock, IDs, and order-related data are left completely untouched.)*

---

## 3. Vercel Deployment & Environment Variables

The previous production deployment failed because Vercel was missing critical environment variables. 
The build script (`scripts/check-commerce.cjs`) strictly checks for: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_ORIGIN`, and `SESSION_SECRET`. 

Since the previous build only flagged `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` as missing, it implies that `SUPABASE_URL` and `SITE_ORIGIN` are already present in the Vercel environment.

### Exact Manual Steps to Fix Vercel Build (Do NOT bypass):
1. Log into your Vercel Dashboard and go to the **Hanaz Official** project.
2. Navigate to **Settings** → **Environment Variables**.
3. Check if `SESSION_SECRET` exists. If it exists, **DO NOT overwrite or rotate it** (doing so would invalidate existing user sessions). If it does *not* exist, add it (must be at least 32 random characters).
4. Add `SUPABASE_SERVICE_ROLE_KEY`. This must be the server-side, `service_role` key from your Supabase project (do not use the public `anon` key).
5. Once these variables are saved, trigger a new deployment from the latest `main` commit.

---

## 4. Post-Deployment Verification (Live Checks)

Once the Vercel build succeeds and is live, perform the following verification:

1. **Redirect Status:** Navigate to `https://www.hanazofficial.store/products/hanaz-vitamin-c-serum` and ensure it permanently (301) redirects to the new `pdp-vitamin-c.html` URL.
2. **Canonicals & Sitemap:** Check `https://www.hanazofficial.store/sitemap.xml` to ensure the correct URLs are present. View the source of the homepage and product pages to ensure canonicals match.
3. **JavaScript Execution:** Wait for the page to fully load (so Supabase data is fetched). Inspect the `<title>`, `<meta name="description">`, and JSON-LD schema to confirm the DB is serving the newly corrected data (no "10% SAP").
4. **Layout & Commerce Smoke Test:** Check mobile responsiveness, click "Add to Cart", and navigate to checkout to ensure commerce flows are unaffected.

## 5. Search Console Action

After the corrected sitemap is live and verified:
1. Open Google Search Console.
2. Submit `https://www.hanazofficial.store/sitemap.xml`.
3. Use the URL Inspection Tool to request indexing for the homepage and the two product URLs.
