import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { 
    getAIExpenseAnalysis, 
    getAIExpenseInsights, 
    getAIBudgetRecommendations 
} from "../controllers/ai.controller.js";

const router = express.Router();

// Get comprehensive AI analysis of expenses
router.get("/analysis", isAuthenticated, getAIExpenseAnalysis);

// Get quick AI insights about expenses
router.get("/insights", isAuthenticated, getAIExpenseInsights);

// Get AI-powered budget recommendations
router.post("/budget-recommendations", isAuthenticated, getAIBudgetRecommendations);

export default router; 