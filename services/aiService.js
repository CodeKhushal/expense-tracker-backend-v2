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

// -------------------------
// Helper Functions
// -------------------------

const computeBasicStats = (expenses = []) => {
  const normalized = expenses.map((e) => ({
    description: e.description || "No description",
    amount: Number(e.amount || 0),
    category: e.category || "others",
    date: e.createdAt || e.date || null,
  }));

  const totalAmount = normalized.reduce((sum, e) => sum + e.amount, 0);

  const averageTransaction =
    normalized.length > 0
      ? Number((totalAmount / normalized.length).toFixed(2))
      : 0;

  const categoryBreakdown = normalized.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const topCategory =
    Object.keys(categoryBreakdown).sort(
      (a, b) => categoryBreakdown[b] - categoryBreakdown[a]
    )[0] || null;

  // Basic spending trend
  let spendingTrend = "stable";

  if (normalized.length >= 3) {
    const third = Math.max(1, Math.floor(normalized.length / 3));

    const firstSum = normalized
      .slice(0, third)
      .reduce((sum, e) => sum + e.amount, 0);

    const lastSum = normalized
      .slice(-third)
      .reduce((sum, e) => sum + e.amount, 0);

    if (lastSum > firstSum * 1.05) {
      spendingTrend = "increasing";
    } else if (lastSum < firstSum * 0.95) {
      spendingTrend = "decreasing";
    }
  }

  const riskLevel =
    totalAmount > 2000
      ? "high"
      : totalAmount > 800
      ? "medium"
      : "low";

  return {
    normalized,
    totalAmount,
    averageTransaction,
    categoryBreakdown,
    topCategory,
    spendingTrend,
    riskLevel,
  };
};

const extractTextFromResponse = async (result) => {
  try {
    if (!result) return "";

    // Latest Gemini SDK response handling
    if (result.response) {
      const response = await result.response;

      if (typeof response.text === "function") {
        return response.text();
      }

      if (typeof response.text === "string") {
        return response.text;
      }
    }

    // Fallbacks
    if (typeof result.text === "string") {
      return result.text;
    }

    return JSON.stringify(result);
  } catch (err) {
    console.error("Failed to extract Gemini response text:", err);
    return "";
  }
};

const cleanJsonResponse = (text) => {
  try {
    // Remove markdown formatting
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Extract first JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No valid JSON found");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("JSON parsing error:", err);
    return null;
  }
};

// -------------------------
// Expense Analysis
// -------------------------

export const analyzeExpenses = async (expenses = []) => {
  try {
    const stats = computeBasicStats(expenses);

    // Fallback if AI unavailable
    if (!genAI) {
      return `
Expense Analysis Summary

Total Spent: ₹${stats.totalAmount}
Top Category: ${stats.topCategory || "N/A"}
Average Transaction: ₹${stats.averageTransaction}
Trend: ${stats.spendingTrend}

Suggestions:
- Review spending in ${stats.topCategory || "high-cost categories"}
- Reduce non-essential purchases
- Track weekly expenses consistently
      `;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const expenseData = stats.normalized.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      date: e.date,
    }));

    const prompt = `
You are a financial advisor.

Analyze the following expense data and provide practical financial advice.

Expense Data:
${JSON.stringify(expenseData, null, 2)}

Summary:
- Total Expenses: ₹${stats.totalAmount}
- Number of Transactions: ${expenseData.length}
- Category Breakdown:
${JSON.stringify(stats.categoryBreakdown, null, 2)}

Provide:

1. Spending Analysis
2. Budget Recommendations
3. Money Saving Tips
4. Financial Goals
5. Emergency Fund Advice
6. Basic Investment Suggestions

Keep the response:
- Friendly
- Actionable
- Well-structured
- Easy to read
`;

    const result = await model.generateContent(prompt);

    const text = await extractTextFromResponse(result);

    return text || "Unable to generate AI analysis.";
  } catch (error) {
    console.error("AI Analysis Error:", error);

    const stats = computeBasicStats(expenses);

    return `
AI unavailable — fallback analysis

Total Spent: ₹${stats.totalAmount}
Top Category: ${stats.topCategory || "N/A"}
Average Transaction: ₹${stats.averageTransaction}
Trend: ${stats.spendingTrend}
Risk Level: ${stats.riskLevel}
    `;
  }
};

// -------------------------
// Quick Insights
// -------------------------

export const getExpenseInsights = async (expenses = []) => {
  try {
    const stats = computeBasicStats(expenses);

    // Fallback if Gemini unavailable
    if (!genAI) {
      return {
        topCategory: stats.topCategory,
        totalSpent: stats.totalAmount,
        averageTransaction: stats.averageTransaction,
        spendingTrend: stats.spendingTrend,
        quickTip: `Try reducing spending in ${
          stats.topCategory || "high-cost categories"
        } by 10%.`,
        riskLevel: stats.riskLevel,
      };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
Analyze the following expenses and return ONLY valid JSON.

Expenses:
${JSON.stringify(stats.normalized, null, 2)}

Return this exact structure:

{
  "topCategory": "category name",
  "totalSpent": number,
  "averageTransaction": number,
  "spendingTrend": "increasing/decreasing/stable",
  "quickTip": "short actionable tip",
  "riskLevel": "low/medium/high"
}

Do not include markdown.
Do not include explanation text.
`;

    const result = await model.generateContent(prompt);

    const text = await extractTextFromResponse(result);

    const parsed = cleanJsonResponse(text);

    if (parsed) {
      return parsed;
    }

    // Backup fallback
    return {
      topCategory: stats.topCategory,
      totalSpent: stats.totalAmount,
      averageTransaction: stats.averageTransaction,
      spendingTrend: stats.spendingTrend,
      quickTip: `Track and reduce spending in ${
        stats.topCategory || "high-cost categories"
      }.`,
      riskLevel: stats.riskLevel,
    };
  } catch (error) {
    console.error("AI Insights Error:", error);

    const stats = computeBasicStats(expenses);

    return {
      topCategory: stats.topCategory,
      totalSpent: stats.totalAmount,
      averageTransaction: stats.averageTransaction,
      spendingTrend: stats.spendingTrend,
      quickTip: `Track and reduce spending in ${
        stats.topCategory || "high-cost categories"
      }.`,
      riskLevel: stats.riskLevel,
    };
  }
};
