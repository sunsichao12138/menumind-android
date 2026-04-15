import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import express from "express";
import cors from "cors";

import { authMiddleware } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import ingredientsRouter from "./routes/ingredients.js";
import recipesRouter from "./routes/recipes.js";
import favoritesRouter from "./routes/favorites.js";
import plansRouter from "./routes/plans.js";
import historyRouter from "./routes/history.js";
import profileRouter from "./routes/profile.js";
import aiRouter from "./routes/ai.js";
import familiesRouter from "./routes/families.js";
import ingredientLogsRouter from "./routes/ingredient-logs.js";
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Public routes (no auth required)
app.use("/api/auth", authRouter);

// Protected routes (auth required)
app.use("/api/ingredients", authMiddleware, ingredientsRouter);
app.use("/api/recipes", authMiddleware, recipesRouter);
app.use("/api/favorites", authMiddleware, favoritesRouter);
app.use("/api/plans", authMiddleware, plansRouter);
app.use("/api/history", authMiddleware, historyRouter);
app.use("/api/profile", authMiddleware, profileRouter);
app.use("/api/ai", authMiddleware, aiRouter);
app.use("/api/families", authMiddleware, familiesRouter);
app.use("/api/ingredient-logs", authMiddleware, ingredientLogsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
