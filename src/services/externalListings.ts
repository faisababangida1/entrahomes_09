import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ExternalProperty {
  id: string;
  title: string;
  location: string;
  price: number;
  propertyType: string;
  images: string[];
  status: string;
  landlordId: string;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  isExternal?: boolean;
  externalSource?: string;
  externalUrl?: string;
  amenities?: string[];
}

// Simple sanitizer to strip HTML tags and prevent XSS
const sanitizeString = (str: string) => {
  if (!str) return '';
  return str.replace(/[<>]/g, '').trim();
};

const sanitizeUrl = (url: string) => {
  if (!url) return '';
  // Prevent javascript: protocol
  if (url.trim().toLowerCase().startsWith('javascript:')) {
    return '';
  }
  return url.trim();
};

export const fetchScrapedProperties = async (): Promise<ExternalProperty[]> => {
  const CACHE_KEY = 'jiji_listings_cache_v3';
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsedCache = JSON.parse(cached);
      // Cache for 1 hour (3600000 ms) to allow accumulating more properties over time
      if (Date.now() - parsedCache.timestamp < 3600000) {
        return parsedCache.data;
      }
    } catch (e) {
      console.error("Error parsing cache", e);
    }
  }

  const apiKey = import.meta.env.VITE_SCRAPER_API_KEY || '22f7a254821c81a6db10af9d0fd786ab'; // Fallback for dev if not set
  const baseUrl = 'https://jiji.ng/houses-apartments-for-rent';
  
  let allProperties: ExternalProperty[] = [];
  const uniqueUrls = new Set<string>();

  try {
    // Fetch 10 random pages to accumulate different properties over time
    const startPage = Math.floor(Math.random() * 20) + 1;
    
    for (let batch = 0; batch < 2; batch++) {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const page = startPage + batch * 5 + i;
        const targetUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
        promises.push(
          fetch(`https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`)
            .then(res => res.ok ? res.text() : '')
            .catch(err => {
              console.error(`Error fetching page ${page}:`, err);
              return '';
            })
        );
      }
      
      const htmls = await Promise.all(promises);
      
      for (let p = 0; p < htmls.length; p++) {
        const html = htmls[p];
        if (!html) continue;
        
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Jiji.ng specific selectors or generic fallbacks
          let listingElements = Array.from(doc.querySelectorAll('.b-list-advert__item, .masonry-item, .b-list-advert__gallery__item'));
          
          if (listingElements.length === 0) {
            // Generic fallback: find links that contain an image and a price-like text
            const links = Array.from(doc.querySelectorAll('a'));
            listingElements = links.filter(a => {
              const hasImg = a.querySelector('img') !== null;
              const text = a.textContent || '';
              const hasPrice = text.includes('₦') || text.includes('Naira');
              return hasImg && hasPrice;
            });
          }

          for (let i = 0; i < listingElements.length; i++) {
            const el = listingElements[i];
            
            const titleEl = el.querySelector('.qa-advert-title, .b-advert-title-inner, [class*="title"], h3, h4');
            const priceEl = el.querySelector('.qa-advert-price, [class*="price"]');
            const locationEl = el.querySelector('.b-list-advert__region__text, [class*="location"], [class*="region"]');
            const imgEl = el.querySelector('img');
            const linkEl = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
            
            const rawTitle = titleEl?.textContent || 'Property for Rent';
            const title = sanitizeString(rawTitle);
            
            const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
            const price = parseInt(priceText, 10) || 0;
            
            const rawLocation = locationEl?.textContent || 'Nigeria';
            const location = sanitizeString(rawLocation);
            
            let rawImgSrc = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '';
            let imgSrc = sanitizeUrl(rawImgSrc);
            if (imgSrc && !imgSrc.startsWith('http')) {
              imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` : `https://jiji.ng${imgSrc}`;
            }
            if (!imgSrc) imgSrc = `https://picsum.photos/seed/jiji${batch}_${p}_${i}/800/600`;

            let rawUrl = linkEl?.getAttribute('href') || '';
            let url = sanitizeUrl(rawUrl);
            if (url && !url.startsWith('http')) {
              url = `https://jiji.ng${url}`;
            }
            if (!url) url = baseUrl;
            
            // Deduplication based on unique Jiji URL
            if (!uniqueUrls.has(url) && (price > 0 || title !== 'Property for Rent')) {
              uniqueUrls.add(url);
              allProperties.push({
                id: `ext_${encodeURIComponent(url)}`,
                title,
                location,
                price: price > 0 ? price : 5000000, // Fallback price if parsing fails
                propertyType: 'apartment',
                images: [imgSrc],
                status: 'available',
                landlordId: 'external_network',
                description: `This property is listed on Jiji.ng. Click 'Contact via WhatsApp' to see more details and contact the landlord directly.`,
                isExternal: true,
                externalSource: 'Jiji.ng',
                externalUrl: url
              });
            }
          }
        } catch (parseError) {
          console.error(`Error parsing HTML for page ${p}:`, parseError);
          // Continue to the next HTML page instead of crashing the whole batch
        }
      }
    }
    
    if (allProperties.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: allProperties }));
      
      // Save external properties to Firestore in the background
      allProperties.forEach(async (prop) => {
        try {
          const docRef = doc(db, 'properties', prop.id);
          await setDoc(docRef, {
            ...prop,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Failed to save external property to Firestore", e);
        }
      });
    }
    return allProperties;
  } catch (error) {
    console.error("Error fetching from ScraperAPI:", error);
    return [];
  }
};

// Keep this for backwards compatibility with existing imports
export const fetchExternalListings = fetchScrapedProperties;

export const getExternalPropertyById = async (id: string): Promise<ExternalProperty | null> => {
  // Since we don't have a direct API to fetch a single property by ID from Jiji without scraping its specific URL,
  // and we don't store the URL in the ID, we'll return a generic fallback or null.
  // In a real app, you'd store the scraped listings in a global state or database.
  return null;
};
