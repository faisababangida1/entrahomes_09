import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase config
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.error("Could not load firebase-applet-config.json. Make sure it exists in the root directory.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const SCRAPER_API_KEY = process.env.VITE_SCRAPER_API_KEY;
if (!SCRAPER_API_KEY) {
  console.error("ERROR: VITE_SCRAPER_API_KEY environment variable is missing.");
  console.error("Please add it to your AI Studio Secrets or .env file before running this script.");
  process.exit(1);
}

const LOCATIONS = ['lagos', 'abuja'];
const CATEGORIES = [
  { name: 'apartment', url: 'houses-apartments-for-rent' }
];

const sanitizeString = (str) => {
  if (!str) return '';
  return str.replace(/[<>]/g, '').trim();
};

const sanitizeUrl = (url) => {
  if (!url) return '';
  if (url.trim().toLowerCase().startsWith('javascript:')) return '';
  return url.trim();
};

async function scrapePage(url, location, category, pageNum) {
  console.log(`Scraping real properties for: ${location} - ${category.name} (Page ${pageNum})`);
  const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(scraperUrl);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    let listingElements = Array.from(doc.querySelectorAll('.b-list-advert__item, .masonry-item, .b-list-advert__gallery__item'));
    
    if (listingElements.length === 0) {
      const links = Array.from(doc.querySelectorAll('a'));
      listingElements = links.filter(a => {
        const hasImg = a.querySelector('img') !== null;
        const text = a.textContent || '';
        const hasPrice = text.includes('₦') || text.includes('Naira');
        return hasImg && hasPrice;
      });
    }

    const properties = [];

    for (let i = 0; i < listingElements.length; i++) {
      const el = listingElements[i];
      
      const titleEl = el.querySelector('.qa-advert-title, .b-advert-title-inner, [class*="title"], h3, h4');
      const priceEl = el.querySelector('.qa-advert-price, [class*="price"]');
      const locationEl = el.querySelector('.b-list-advert__region__text, [class*="location"], [class*="region"]');
      const imgEl = el.querySelector('img');
      const linkEl = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
      
      const rawTitle = titleEl?.textContent || 'Property for Rent';
      const title = sanitizeString(rawTitle).substring(0, 190);
      
      const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
      const price = parseInt(priceText, 10) || 0;
      
      const rawLocation = locationEl?.textContent || location;
      const propLocation = sanitizeString(rawLocation).substring(0, 190);
      
      let rawImgSrc = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '';
      let imgSrc = sanitizeUrl(rawImgSrc);
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` : `https://jiji.ng${imgSrc}`;
      }
      if (!imgSrc) imgSrc = `https://picsum.photos/seed/jiji_${Date.now()}_${i}/800/600`;

      let rawUrl = linkEl?.getAttribute('href') || '';
      let propUrl = sanitizeUrl(rawUrl).substring(0, 900);
      if (propUrl && !propUrl.startsWith('http')) {
        propUrl = `https://jiji.ng${propUrl}`;
      }
      if (!propUrl) propUrl = url;
      
      // Extract beds/baths from title if possible
      let beds = 1;
      let baths = 1;
      const bedsMatch = title.match(/(\d+)\s*(bed|bedroom)/i);
      if (bedsMatch) {
        beds = parseInt(bedsMatch[1], 10);
        baths = beds + (Math.random() > 0.5 ? 1 : 0); // Estimate baths if not found
      }
      
      let inferredType = 'apartment';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('house') || lowerTitle.includes('duplex') || lowerTitle.includes('detached') || lowerTitle.includes('bungalow')) {
        inferredType = 'house';
      } else if (lowerTitle.includes('studio') || lowerTitle.includes('self contain') || lowerTitle.includes('room')) {
        inferredType = 'studio';
      }

      const safeId = `ext_${propUrl.replace(/[^a-zA-Z0-9]/g, '').substring(0, 80)}_${i}`;
      
      if (price > 0 || title !== 'Property for Rent') {
        properties.push({
          id: safeId,
          title,
          location: propLocation,
          price: price > 0 ? price : 5000000,
          propertyType: inferredType,
          bedrooms: beds,
          bathrooms: baths,
          images: [imgSrc],
          status: 'available',
          landlordId: 'external_network',
          description: `This property is listed on Jiji.ng. Click 'Contact via WhatsApp' to see more details and contact the landlord directly.`,
          isExternal: true,
          externalSource: 'Jiji.ng',
          externalUrl: propUrl,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    return properties;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
}

async function main() {
  console.log("Starting real bulk scrape...");
  let totalSaved = 0;

  for (const location of LOCATIONS) {
    for (const category of CATEGORIES) {
      // Scrape 15 pages per location/category combination
      for (let page = 1; page <= 15; page++) {
        const queryParams = [];
        if (page > 1) queryParams.push(`page=${page}`);
        // Sort by cheapest to find affordable properties
        queryParams.push('sort=price_asc');
        
        const url = `https://jiji.ng/${location}/${category.url}${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
        const properties = await scrapePage(url, location, category, page);
        
        for (const prop of properties) {
          try {
            const docRef = doc(db, 'properties', prop.id);
            const docSnap = await getDoc(docRef);
            
            // Do not touch the database for existing properties
            if (!docSnap.exists()) {
              await setDoc(docRef, prop);
              totalSaved++;
            }
          } catch (e) {
            console.error(`Failed to save property ${prop.id}:`, e);
          }
        }
        
        console.log(`Saved ${properties.length} properties from ${url}`);
        
        // Sleep to avoid hitting rate limits too hard
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`Bulk scrape completed! Total properties saved: ${totalSaved}`);
  process.exit(0);
}

main();
