import { Expense } from "../models/expense.model.js";

export const addExpense = async (req, res) => {
    try {
        const { description, amount, category } = req.body;
        const userId = req.id; // current logged in user
        if (!description || !amount || !category) {
            return res.status(400).json({
                message: "Something is missing!",
                success: false
            });
        }
        const expense = await Expense.create({
            description,
            amount: Number(amount),
            category,
            userId
        });
        return res.status(201).json({
            message: "New Expense Added.",
            expense,
            success: true
        });
    } catch (error) {
        console.log(error);
    }
};
export const getAllExpenses = async (req, res) => {
    try {
        const userId = req.id;
        let category = req.query.category || ""; // Default to empty string if category is not provided
        const done = req.query.done || ""; // Default to empty string if done is not provided

        // Build the query object
        const query = {
            userId, // Filter by userId
        };

        // Handle special case for category "all"
        if (category.toLowerCase() === "all") {
            // No need to filter by category
        } else {
            // Regular category filter with case-insensitive regex match
            query.category = { $regex: category, $options: 'i' };
        }

        // Handle done filter interpretation
        if (done.toLowerCase() === "done") {
            query.done = true; // Filter for expenses marked as done (true)
        } else if (done.toLowerCase() === "undone") {
            query.done = false; // Filter for expenses marked as pending (false)
        }
        // Fetch expenses based on the constructed query
        const expenses = await Expense.find(query);

        // Check if expenses were found
        if (!expenses || expenses.length === 0) {
            return res.status(404).json({
                message: "No expenses found.",
                success: false
            });
        }

        // Return the found expenses
        return res.status(200).json({
            expenses,
            success: true
        });
    } catch (error) {
        console.log(error);
    }
};
export const markAsDoneOrUndone = async (req, res) => {
    try {
        const expenseId = req.params.id;
        const done = req.body;
        const expense = await Expense.findByIdAndUpdate(expenseId, done, { new: true });
        if (!expense) {
            return res.status(404).json({
                message: "Expense not found.",
                success: false
            })
        };
        return res.status(200).json({
            message: `Expense marked as ${expense.done ? 'done' : 'undone'}.`,
            success: true
        });
    } catch (error) {
        console.log(error);
    }
}
export const removeExpense = async (req, res) => {
    try {
        const expenseId = req.params.id;
        await Expense.findByIdAndDelete(expenseId);
        return res.status(200).json({
            message: "Expense removed.",
            success: true
        });
    } catch (error) {
        console.log(error);
    }
}
export const updateExpense = async (req, res) => {
    try {
        const { description, amount, category } = req.body;

        const expenseId = req.params.id;
        const updateData = { description, amount, category };

        const expense = await Expense.findByIdAndUpdate(expenseId, updateData, { new: true });
        return res.status(200).json({
            message: "Expense Updated.",
            expense,
            success: true
        });

    } catch (error) {
        console.log(error);
    }
}