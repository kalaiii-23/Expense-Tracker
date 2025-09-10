import { 
  doc, 
  collection,
  addDoc,
  getDocs,
  getDoc, 
  updateDoc, 
  query,
  where,
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { expenseService } from "./ExpenseService";

export interface Budget {
  id?: string;
  userId: string;
  totalBudget: number;
  categoryBudgets: { [categoryId: string]: number };
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  id?: string;
  userId: string;
  budgetId: string;
  type: 'warning' | 'exceeded';
  category?: string;
  message: string;
  threshold: number; // percentage (e.g., 80 for 80%)
  currentSpent: number;
  budgetAmount: number;
  createdAt: Date;
  isRead: boolean;
}

export interface BudgetAnalysis {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  percentageUsed: number;
  categoryAnalysis: {
    [category: string]: {
      budgeted: number;
      spent: number;
      remaining: number;
      percentageUsed: number;
      status: 'safe' | 'warning' | 'exceeded';
    };
  };
  alerts: BudgetAlert[];
}

class BudgetService {
  private getBudgetsCollection() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, `users/${user.uid}/budgets`);
  }

  private getAlertsCollection() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, `users/${user.uid}/budgetAlerts`);
  }

  // Create or update budget for a specific month/year
  async setBudget(budgetData: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      // Check if budget already exists for this month/year
      const existingBudget = await this.getBudgetForMonth(budgetData.year, budgetData.month);
      
      if (existingBudget) {
        // Update existing budget
        await this.updateBudget(existingBudget.id!, {
          totalBudget: budgetData.totalBudget,
          categoryBudgets: budgetData.categoryBudgets
        });
        return existingBudget.id!;
      } else {
        // Create new budget
        const budget: Omit<Budget, 'id'> = {
          ...budgetData,
          userId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const docRef = await addDoc(this.getBudgetsCollection(), {
          ...budget,
          createdAt: Timestamp.fromDate(budget.createdAt),
          updatedAt: Timestamp.fromDate(budget.updatedAt)
        });

        return docRef.id;
      }
    } catch (error) {
      throw new Error(`Failed to set budget: ${error}`);
    }
  }

  // Get budget for specific month/year
  async getBudgetForMonth(year: number, month: number): Promise<Budget | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const q = query(
        this.getBudgetsCollection(),
        where('year', '==', year),
        where('month', '==', month)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as Budget;
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to get budget: ${error}`);
    }
  }

  // Update existing budget
  async updateBudget(budgetId: string, updates: Partial<Budget>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const budgetDoc = doc(db, `users/${user.uid}/budgets/${budgetId}`);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      await updateDoc(budgetDoc, updateData);
    } catch (error) {
      throw new Error(`Failed to update budget: ${error}`);
    }
  }

  // Get current month's budget
  async getCurrentMonthBudget(): Promise<Budget | null> {
    const now = new Date();
    return this.getBudgetForMonth(now.getFullYear(), now.getMonth());
  }

  // Analyze budget vs actual spending
  async analyzeBudget(year: number, month: number): Promise<BudgetAnalysis> {
    try {
      const budget = await this.getBudgetForMonth(year, month);
      const expenses = await expenseService.getExpensesForMonth(year, month);
      
      if (!budget) {
        throw new Error('No budget found for this month');
      }

      const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const remainingBudget = budget.totalBudget - totalSpent;
      const percentageUsed = budget.totalBudget > 0 ? (totalSpent / budget.totalBudget) * 100 : 0;

      // Analyze category spending
      const categorySpending: { [category: string]: number } = {};
      expenses.forEach(expense => {
        const category = expense.category || 'Others';
        categorySpending[category] = (categorySpending[category] || 0) + expense.amount;
      });

      const categoryAnalysis: BudgetAnalysis['categoryAnalysis'] = {};
      Object.entries(budget.categoryBudgets).forEach(([category, budgeted]) => {
        const spent = categorySpending[category] || 0;
        const remaining = budgeted - spent;
        const percentageUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
        
        let status: 'safe' | 'warning' | 'exceeded' = 'safe';
        if (percentageUsed >= 100) status = 'exceeded';
        else if (percentageUsed >= 80) status = 'warning';

        categoryAnalysis[category] = {
          budgeted,
          spent,
          remaining,
          percentageUsed,
          status
        };
      });

      // Get alerts for this budget
      const alerts = await this.getBudgetAlerts(budget.id!);

      return {
        totalBudget: budget.totalBudget,
        totalSpent,
        remainingBudget,
        percentageUsed,
        categoryAnalysis,
        alerts
      };
    } catch (error) {
      throw new Error(`Failed to analyze budget: ${error}`);
    }
  }

  // Check for budget alerts and create them
  async checkBudgetAlerts(year: number, month: number): Promise<BudgetAlert[]> {
    try {
      const analysis = await this.analyzeBudget(year, month);
      const budget = await this.getBudgetForMonth(year, month);
      const alerts: BudgetAlert[] = [];

      if (!budget) return alerts;

      // Check total budget
      if (analysis.percentageUsed >= 100) {
        alerts.push(await this.createAlert({
          budgetId: budget.id!,
          type: 'exceeded',
          message: `You have exceeded your monthly budget by ₹${Math.abs(analysis.remainingBudget).toFixed(2)}`,
          threshold: 100,
          currentSpent: analysis.totalSpent,
          budgetAmount: analysis.totalBudget
        }));
      } else if (analysis.percentageUsed >= 80) {
        alerts.push(await this.createAlert({
          budgetId: budget.id!,
          type: 'warning',
          message: `You have used ${analysis.percentageUsed.toFixed(1)}% of your monthly budget`,
          threshold: 80,
          currentSpent: analysis.totalSpent,
          budgetAmount: analysis.totalBudget
        }));
      }

      // Check category budgets
      Object.entries(analysis.categoryAnalysis).forEach(async ([category, data]) => {
        if (data.percentageUsed >= 100) {
          alerts.push(await this.createAlert({
            budgetId: budget.id!,
            type: 'exceeded',
            category,
            message: `You have exceeded your ${category} budget by ₹${Math.abs(data.remaining).toFixed(2)}`,
            threshold: 100,
            currentSpent: data.spent,
            budgetAmount: data.budgeted
          }));
        } else if (data.percentageUsed >= 80) {
          alerts.push(await this.createAlert({
            budgetId: budget.id!,
            type: 'warning',
            category,
            message: `You have used ${data.percentageUsed.toFixed(1)}% of your ${category} budget`,
            threshold: 80,
            currentSpent: data.spent,
            budgetAmount: data.budgeted
          }));
        }
      });

      return alerts;
    } catch (error) {
      throw new Error(`Failed to check budget alerts: ${error}`);
    }
  }

  // Create a budget alert
  private async createAlert(alertData: Omit<BudgetAlert, 'id' | 'userId' | 'createdAt' | 'isRead'>): Promise<BudgetAlert> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const alert: Omit<BudgetAlert, 'id'> = {
        ...alertData,
        userId: user.uid,
        createdAt: new Date(),
        isRead: false
      };

      const docRef = await addDoc(this.getAlertsCollection(), {
        ...alert,
        createdAt: Timestamp.fromDate(alert.createdAt)
      });

      return { id: docRef.id, ...alert };
    } catch (error) {
      throw new Error(`Failed to create alert: ${error}`);
    }
  }

  // Get budget alerts
  async getBudgetAlerts(budgetId?: string): Promise<BudgetAlert[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      let q = query(
        this.getAlertsCollection(),
        orderBy('createdAt', 'desc')
      );

      if (budgetId) {
        q = query(
          this.getAlertsCollection(),
          where('budgetId', '==', budgetId),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const alerts: BudgetAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate()
        } as BudgetAlert);
      });

      return alerts;
    } catch (error) {
      throw new Error(`Failed to get budget alerts: ${error}`);
    }
  }

  // Mark alert as read
  async markAlertAsRead(alertId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const alertDoc = doc(db, `users/${user.uid}/budgetAlerts/${alertId}`);
      await updateDoc(alertDoc, { isRead: true });
    } catch (error) {
      throw new Error(`Failed to mark alert as read: ${error}`);
    }
  }

  // Get budget suggestions based on spending patterns
  async getBudgetSuggestions(year: number, month: number): Promise<{ [category: string]: number }> {
    try {
      // Get last 3 months of expenses
      const suggestions: { [category: string]: number } = {};
      const months = [];
      
      for (let i = 1; i <= 3; i++) {
        const date = new Date(year, month - i);
        months.push({ year: date.getFullYear(), month: date.getMonth() });
      }

      const allExpenses = await Promise.all(
        months.map(m => expenseService.getExpensesForMonth(m.year, m.month))
      );

      const categoryTotals: { [category: string]: number[] } = {};

      allExpenses.forEach(expenses => {
        const categorySpending: { [category: string]: number } = {};
        expenses.forEach(expense => {
          const category = expense.category || 'Others';
          categorySpending[category] = (categorySpending[category] || 0) + expense.amount;
        });

        Object.entries(categorySpending).forEach(([category, amount]) => {
          if (!categoryTotals[category]) categoryTotals[category] = [];
          categoryTotals[category].push(amount);
        });
      });

      // Calculate average and add 20% buffer
      Object.entries(categoryTotals).forEach(([category, amounts]) => {
        const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        suggestions[category] = Math.round(average * 1.2); // 20% buffer
      });

      return suggestions;
    } catch (error) {
      throw new Error(`Failed to get budget suggestions: ${error}`);
    }
  }
}

export const budgetService = new BudgetService();