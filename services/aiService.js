import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_KEY = process.env.GEMINI_API_KEY || null;
let genAI = null;

if (GEMINI_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_KEY);
  } catch (err) {
    console.warn("Failed to initialize GoogleGenerativeAI client:", err);
    genAI = null;
  }
} else {
  console.warn(
    "GEMINI_API_KEY not set. AI endpoints will use deterministic fallbacks."
  );
}

// Helper: compute basic deterministic stats (works without external AI)
const computeBasicStats = (expenses) => {
  const normalized = (expenses || []).map((e) => ({
    description: e.description,
    amount: Number(e.amount || 0),
    category: e.category || "others",
    date: e.createdAt || e.date || null,
  }));

  const totalAmount = normalized.reduce((s, e) => s + e.amount, 0);
  const avg = normalized.length ? totalAmount / normalized.length : 0;
  const categoryBreakdown = normalized.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const topCategory =
    Object.keys(categoryBreakdown).sort(
      (a, b) => categoryBreakdown[b] - categoryBreakdown[a]
    )[0] || null;

  // naive trend detection (compare first third vs last third)
  let trend = "stable";
  const n = normalized.length;
  if (n >= 3) {
    const third = Math.max(1, Math.floor(n / 3));
    const firstSum = normalized
      .slice(0, third)
      .reduce((s, e) => s + e.amount, 0);
    const lastSum = normalized.slice(-third).reduce((s, e) => s + e.amount, 0);
    if (lastSum > firstSum * 1.05) trend = "increasing";
    else if (lastSum < firstSum * 0.95) trend = "decreasing";
  }

  const riskLevel =
    totalAmount > 2000 ? "high" : totalAmount > 800 ? "medium" : "low";

  return {
    normalized,
    totalAmount,
    averageTransaction: Math.round(avg * 100) / 100,
    topCategory,
    spendingTrend: trend,
    categoryBreakdown,
    riskLevel,
  };
};

const safeExtractText = (result) => {
  // Attempt common shapes; log for debugging if unexpected
  if (!result) return "";
  // result.response?.text could be a function or string
  try {
    if (result.response && typeof result.response.text === "function") {
      return result.response.text();
    }
    if (result.response && typeof result.response.text === "string") {
      return result.response.text;
    }
    if (typeof result.text === "string") {
      return result.text;
    }
    return JSON.stringify(result);
  } catch (err) {
    console.warn("Failed to extract text from AI result:", err, result);
    return JSON.stringify(result);
  }
};

export const analyzeExpenses = async (expenses) => {
  try {
    const stats = computeBasicStats(expenses);

    // If no AI client, return deterministic analysis
    if (!genAI) {
      const analysis = `Total spent: ${stats.totalAmount}
Top category: ${stats.topCategory || "N/A"}
Average transaction: ${stats.averageTransaction}
Trend: ${stats.spendingTrend}
Suggested actions: Review top spending categories (${
        stats.topCategory || "N/A"
      }) and reduce non-essential spending.`;
      return analysis;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const expenseData = stats.normalized.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      date: e.date,
    }));

    const prompt = `
As a financial advisor, analyze the following expense data and provide personalized advice to help the user save money and manage their expenses more efficiently.

Expense Data:
${JSON.stringify(expenseData, null, 2)}

Summary:
- Total Expenses: ${stats.totalAmount}
- Number of Transactions: ${expenseData.length}
- Category Breakdown: ${JSON.stringify(stats.categoryBreakdown, null, 2)}

Please provide:
1. Spending Analysis: Identify patterns and potential areas of concern
2. Budget Recommendations: Suggest realistic budget allocations for each category
3. Money-Saving Tips: Provide specific, actionable advice based on their spending patterns
4. Financial Goals: Suggest short-term and long-term financial goals
5. Emergency Fund: Advice on building and maintaining an emergency fund
6. Investment Opportunities: Basic investment advice if applicable

Format the response in a structured, easy-to-read manner with clear sections and actionable steps.
Keep the tone friendly and encouraging.
        `;

    const result = await model.generateContent(prompt);
    // debug log to inspect shape if issues arise
    // console.debug("AI analyze result:", result);
    const text = safeExtractText(result);
    return text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    // fallback deterministic response so endpoints don't 500
    const stats = computeBasicStats(expenses);
    return `AI unavailable — fallback analysis:
Total: ${stats.totalAmount}, Top category: ${
      stats.topCategory || "N/A"
    }, Avg: ${stats.averageTransaction}, Trend: ${stats.spendingTrend}`;
  }
};

export const getExpenseInsights = async (expenses) => {
  try {
    const stats = computeBasicStats(expenses);

    if (!genAI) {
      return {
        topCategory: stats.topCategory,
        totalSpent: stats.totalAmount,
        averageTransaction: stats.averageTransaction,
        spendingTrend: stats.spendingTrend,
        quickTip: `Consider reducing expenses in ${
          stats.topCategory || "high-cost categories"
        } by 10%`,
        riskLevel: stats.riskLevel,
      };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Analyze these expenses and provide quick insights in JSON format:
${JSON.stringify(stats.normalized, null, 2)}

Return a JSON object with:
{
  "topCategory": "category with highest spending",
  "totalSpent": "total amount spent",
  "averageTransaction": "average transaction amount",
  "spendingTrend": "increasing/decreasing/stable",
  "quickTip": "one actionable tip",
  "riskLevel": "low/medium/high"
}
        `;

    const result = await model.generateContent(prompt);
    // console.debug("AI insights result:", result);
    const text = safeExtractText(result);
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // fallback structured response
      return {
        topCategory: stats.topCategory,
        totalSpent: stats.totalAmount,
        averageTransaction: stats.averageTransaction,
        spendingTrend: stats.spendingTrend,
        quickTip: `Consider tracking and reducing ${
          stats.topCategory || "high-cost categories"
        } spending.`,
        riskLevel: stats.riskLevel,
      };
    }
  } catch (error) {
    console.error("AI Insights Error:", error);
    // fallback deterministic insights
    const stats = computeBasicStats(expenses);
    return {
      topCategory: stats.topCategory,
      totalSpent: stats.totalAmount,
      averageTransaction: stats.averageTransaction,
      spendingTrend: stats.spendingTrend,
      quickTip: `Consider tracking and reducing ${
        stats.topCategory || "high-cost categories"
      } spending.`,
      riskLevel: stats.riskLevel,
    };
  }
};
