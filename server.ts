import express from "express";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Turso Client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

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
    const rows = result.rows.map(row => ({
      ...row,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images || []
    }));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM properties WHERE id = ?",
      args: [req.params.id],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const property = result.rows[0];
    res.json({
      ...property,
      images: typeof property.images === 'string' ? JSON.parse(property.images) : property.images || []
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

// Vercel doesn't need app.listen() - it handles the invocation
export default app;
