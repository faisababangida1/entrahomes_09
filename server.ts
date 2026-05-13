import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import crypto from "crypto";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Turso Client
const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) {
  console.warn("TURSO_DATABASE_URL is not set.");
}

const db = createClient({
  url: dbUrl || "",
  authToken: dbToken || "",
});

// Initialize Schema
async function initSchema() {
  try {
    console.log("Initializing database schema...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        landlordId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        price REAL,
        propertyType TEXT,
        status TEXT DEFAULT 'available',
        images TEXT,
        bedrooms INTEGER,
        furnished INTEGER DEFAULT 0,
        createdAt TEXT
      )
    `);
    
    // Fallback: Ensure columns exist
    const addColumn = async (col: string, type: string) => {
      try {
        await db.execute(`ALTER TABLE properties ADD COLUMN ${col} ${type}`);
        console.log(`Column ${col} added successfully.`);
      } catch (e: any) {
        if (!e.message.includes("duplicate column name") && !e.message.includes("already exists")) {
          console.error(`Error adding column ${col}:`, e.message);
        }
      }
    };

    await addColumn('status', "TEXT DEFAULT 'available'");
    await addColumn('images', "TEXT");
    await addColumn('bedrooms', "INTEGER");
    await addColumn('furnished', "INTEGER DEFAULT 0");
    await addColumn('createdAt', "TEXT");
    
    console.log("Database schema check complete.");
  } catch (error) {
    console.error("Schema initialization failed:", error);
  }
}

initSchema();

// API Routes
app.get("/api/properties", async (req, res) => {
  try {
    const { category, status } = req.query;
    let sql = "SELECT * FROM properties";
    const args: any[] = [];
    
    const conditions = [];
    if (status) {
      conditions.push("status = ?");
      args.push(status);
    }
    if (category && category !== 'all') {
      conditions.push("propertyType = ?");
      args.push(category);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    
    sql += " ORDER BY createdAt DESC";

    const result = await db.execute({ sql, args });
    
    // Parse images string back to array if needed
    const rows = result.rows.map(row => ({
      ...row,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images || []
    }));
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM properties WHERE id = ?",
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }
    const property = result.rows[0];
    res.json({
      ...property,
      images: typeof property.images === 'string' ? JSON.parse(property.images) : property.images || []
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

app.post("/api/properties", async (req, res) => {
  try {
    const p = req.body;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    await db.execute({
      sql: `INSERT INTO properties (id, landlordId, title, description, location, price, propertyType, status, images, bedrooms, furnished, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, 
        p.landlordId, 
        p.title, 
        p.description, 
        p.location, 
        p.price, 
        p.propertyType, 
        p.status || 'available', 
        JSON.stringify(p.images || []),
        p.bedrooms || null,
        p.furnished ? 1 : 0,
        createdAt
      ],
    });
    res.status(201).json({ id, ...p, createdAt });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({ error: "Failed to create property" });
  }
});

app.put("/api/properties/:id", async (req, res) => {
  try {
    const p = req.body;
    await db.execute({
      sql: `UPDATE properties SET 
            title = ?, description = ?, location = ?, price = ?, propertyType = ?, status = ?, images = ?, bedrooms = ?, furnished = ?
            WHERE id = ?`,
      args: [
        p.title, 
        p.description, 
        p.location, 
        p.price, 
        p.propertyType, 
        p.status, 
        JSON.stringify(p.images || []),
        p.bedrooms || null,
        p.furnished ? 1 : 0,
        req.params.id
      ],
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: "Failed to update property" });
  }
});

app.delete("/api/properties/:id", async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM properties WHERE id = ?",
      args: [req.params.id],
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ error: "Failed to delete property" });
  }
});

app.get("/api/properties/landlord/:landlordId", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM properties WHERE landlordId = ?",
      args: [req.params.landlordId],
    });
    const rows = result.rows.map(row => ({
      ...row,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images || []
    }));
    res.json(rows);
  } catch (error) {
    console.error("Error fetching landlord properties:", error);
    res.status(500).json({ error: "Failed to fetch landlord properties" });
  }
});

// Admin Scraping endpoint
app.post("/api/admin/bulk-scrape", async (req, res) => {
  const { limit = 200, location = 'lagos' } = req.body;
  const apiKey = process.env.VITE_SCRAPER_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: "SCRAPER_API_KEY is not set in environment." });
  }

  res.json({ message: "Scraping started in background. This will take a few minutes." });

  // Run scraping in background
  (async () => {
    try {
      console.log(`Starting bulk scrape for ${limit} properties in ${location}...`);
      let count = 0;
      let page = 1;

      while (count < limit) {
        const targetUrl = `https://jiji.ng/${location}/houses-apartments-for-rent?page=${page}`;
        const scraperUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`Scraping page ${page}...`);
        const response = await fetch(scraperUrl);
        if (!response.ok) {
          console.error(`Failed to fetch page ${page}`);
          break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const listings = $('.b-list-advert-base, .masonry-item, .b-list-advert__item');

        if (listings.length === 0) {
          console.log("No more listings found.");
          break;
        }

        for (let i = 0; i < listings.length && count < limit; i++) {
          const el = listings[i];
          const title = $(el).find('.qa-advert-title, .b-advert-title-inner, [class*="title"]').text().trim();
          const priceStr = $(el).find('.qa-advert-price, [class*="price"]').text().replace(/[^0-9]/g, '');
          const price = parseInt(priceStr, 10) || 0;
          const loc = $(el).find('.b-list-advert__region__text, [class*="location"]').text().trim();
          const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
          const url = 'https://jiji.ng' + ($(el).find('a').attr('href') || '');

          if (!title || price === 0) continue;

          const id = `ext_${crypto.createHash('md5').update(url).digest('hex')}`;
          const createdAt = new Date().toISOString();

          try {
            await db.execute({
              sql: `INSERT OR REPLACE INTO properties (id, landlordId, title, description, location, price, propertyType, status, images, createdAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                id,
                'external_network',
                title,
                `This property is listed on Jiji.ng. Location: ${loc || location}. Source: ${url}`,
                loc || location,
                price,
                'apartment',
                'available',
                JSON.stringify([img]),
                createdAt
              ]
            });
            count++;
            if (count % 10 === 0) console.log(`Saved ${count} properties...`);
          } catch (dbErr: any) {
            console.error(`Error saving property ${id}:`, dbErr.message);
          }
        }
        page++;
        // Add a small delay between pages to avoid being aggressive even with ScraperAPI
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log(`Bulk scrape completed. ${count} properties saved.`);
    } catch (err) {
      console.error("Bulk scrape error:", err);
    }
  })();
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
