# Search Engine & SEO Strategy

This document explains how the internal search engine works on the platform, how properties are ranked, and the steps taken to ensure the platform is recognized as a legitimate, high-quality site by Google Search (avoiding any "scam" or "spam" flags).

## 1. Internal Search Engine Ranking (How Properties Rank on the App)

When a user searches for a property on the platform, the results are filtered and ranked based on a specific algorithm to ensure fairness and quality.

### Default Ranking ("Recommended")
By default, the platform uses a **Stable Shuffle Algorithm**. 
- **How it works:** Every time a new property is loaded into the app, it is assigned a random, stable seed value. 
- **Why we do this:** This ensures that all landlords get a fair chance of being seen at the top of the search results. Instead of only showing the oldest or newest properties, the "Recommended" sort shuffles the properties so users see a diverse mix of listings.
- **Trust Score Boost (Planned):** In the future, the algorithm can be adjusted to multiply this random seed by the landlord's `trustScore`. This means landlords with a higher Trust Score (verified ID, good reviews) will naturally appear higher in the "Recommended" results.

### Price Sorting
Users can manually change the sort order to:
- **Price: Low to High:** Ranks properties strictly by the lowest price first.
- **Price: High to Low:** Ranks properties strictly by the highest price first.

### Filtering
Properties are strictly filtered out if they do not match the user's exact criteria for:
- **Location / Title Match** (Text search)
- **Category** (Apartment, House, Studio)
- **Price Range** (Min/Max)
- **Bedrooms & Bathrooms**

---

## 2. Google Search (SEO) & Legitimacy Structure

To ensure Google and other search engines recognize the platform as a legitimate business and NOT a scam/spam site, we have implemented the following structural SEO improvements:

### A. `robots.txt`
We have added a `public/robots.txt` file. This is the first file Google looks for when it visits a website. 
- It tells Google's web crawlers that they are **allowed** to index the site.
- It points Google directly to the Sitemap.

### B. `sitemap.xml`
We have added a `public/sitemap.xml` file. 
- This acts as a map of the website, telling Google exactly which pages exist (Home, Search, Login, Register) and how important they are.
- This proves to Google that the site has a clear, intentional structure, which is a strong signal of legitimacy.

### C. Meta Tags & Open Graph (index.html)
We updated the `index.html` file with professional meta tags:
- **Title & Description:** Clear, professional descriptions of the platform ("Rentra - Find Your Perfect Home").
- **Keywords:** Relevant real estate keywords.
- **Canonical Link:** `<link rel="canonical" href="https://rentra.com/" />` tells Google that this is the official, original source of the content, preventing duplicate content penalties.
- **Open Graph (OG) Tags:** Ensures that when links are shared on WhatsApp, Facebook, or Twitter, they display a professional preview card with a title and description, building trust with users.

### D. Removing "Scam" Signals
Search engines flag sites as scams if they:
1. Have no `robots.txt` or `sitemap.xml`.
2. Have empty or default meta titles (like "Vite App" or "My Google AI Studio App").
3. Load thousands of DOM elements at once (which we fixed by implementing infinite scrolling/background loading).

By implementing the above structures, Google will now crawl the site properly, index the pages, and recognize the platform as a trusted real estate marketplace.
