import { Expense } from "../models/expense.model.js";
import { analyzeExpenses, getExpenseInsights } from "../services/aiService.js";

export const getAIExpenseAnalysis = async (req, res) => {
    try {
        const userId = req.id;
        
        // Get all expenses for the user
        const expenses = await Expense.find({ userId }).sort({ createdAt: -1 });
        
        if (!expenses || expenses.length === 0) {
            return res.status(404).json({
                analysis: null,
                message: "No expenses found for analysis.",
                success: false
            });
        }

        // Get AI analysis
        const analysis = await analyzeExpenses(expenses);
        
        return res.status(200).json({
            analysis,
            success: true
        });
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return res.status(500).json({
            message: "Failed to analyze expenses with AI",
            success: false
        });
    }
};

export const getAIExpenseInsights = async (req, res) => {
    try {
        const userId = req.id;
        
        // Get all expenses for the user
        const expenses = await Expense.find({ userId }).sort({ createdAt: -1 });
        
        if (!expenses || expenses.length === 0) {
            return res.status(404).json({
                insights: null,
                message: "No expenses found for insights.",
                success: false
            });
        }

        // Get AI insights
        const insights = await getExpenseInsights(expenses);
        
        return res.status(200).json({
            insights,
            success: true
        });
    } catch (error) {
        console.error("AI Insights Error:", error);
        return res.status(500).json({
            message: "Failed to generate expense insights",
            success: false
        });
    }
};

export const getAIBudgetRecommendations = async (req, res) => {
    try {
        const userId = req.id;
        const { monthlyIncome } = req.body;
        
        if (!monthlyIncome) {
            return res.status(400).json({
                message: "Monthly income is required for budget recommendations.",
                success: false
            });
        }

        // Get expenses from the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const expenses = await Expense.find({
            userId,
            createdAt: { $gte: threeMonthsAgo }
        }).sort({ createdAt: -1 });

        if (!expenses || expenses.length === 0) {
            return res.status(404).json({
                message: "No recent expenses found for budget recommendations.",
                success: false
            });
        }

        // Calculate spending patterns
        const categoryBreakdown = expenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {});

        const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const averageMonthlySpending = totalSpent / 3;

        // Create budget recommendation prompt
        // const prompt = `
        // Based on the following financial data, provide personalized budget recommendations:

        // Monthly Income: ${monthlyIncome}
        // Average Monthly Spending: ${averageMonthlySpending.toFixed(2)}
        // Category Breakdown: ${JSON.stringify(categoryBreakdown, null, 2)}

        // Please provide:
        // 1. Recommended budget allocation (50/30/20 rule or similar)
        // 2. Category-specific budget limits
        // 3. Savings recommendations
        // 4. Areas to reduce spending
        // 5. Emergency fund target

        // Format as JSON with clear sections.
        // `;

        // For now, return a structured response (you can integrate with Gemini here)
        const recommendations = {
            monthlyIncome: parseFloat(monthlyIncome),
            currentSpending: averageMonthlySpending,
            recommendedBudget: {
                needs: Math.round(monthlyIncome * 0.5),
                wants: Math.round(monthlyIncome * 0.3),
                savings: Math.round(monthlyIncome * 0.2)
            },
            categoryLimits: Object.keys(categoryBreakdown).reduce((acc, category) => {
                acc[category] = Math.round(categoryBreakdown[category] * 0.8); // 20% reduction target
                return acc;
            }, {}),
            savingsTarget: Math.round(monthlyIncome * 0.2),
            emergencyFundTarget: Math.round(monthlyIncome * 6), // 6 months of income
            recommendations: [
                "Track all expenses to identify spending patterns",
                "Set up automatic transfers to savings",
                "Review subscriptions and cancel unused services",
                "Cook meals at home to reduce food expenses",
                "Use cashback cards for essential purchases"
            ]
        };

        return res.status(200).json({
            recommendations,
            success: true
        });
    } catch (error) {
        console.error("Budget Recommendations Error:", error);
        return res.status(500).json({
            message: "Failed to generate budget recommendations",
            success: false
        });
    }
}; 