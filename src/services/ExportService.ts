import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { expenseService, Expense } from "./ExpenseService";
import { userService } from "./UserService";
import { categoryService } from "./CategoryService";
import { budgetService } from "./BudgetService";
import { goalsService } from "./GoalsService";
import { format } from 'date-fns';

export interface ExportOptions {
  includeExpenses: boolean;
  includeBudgets: boolean;
  includeGoals: boolean;
  includeCategories: boolean;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  format: 'pdf' | 'json' | 'csv';
}

class ExportService {
  // Export expenses to PDF
  async exportExpensesToPDF(
    expenses: Expense[],
    options: {
      title?: string;
      dateRange?: { startDate: Date; endDate: Date };
      includeCharts?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const user = await userService.getUserProfile();
      const categories = await categoryService.getCategories();
      
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      // Group expenses by category
      const categoryTotals: { [category: string]: number } = {};
      expenses.forEach(expense => {
        const category = expense.category || 'Others';
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
      });

      const html = this.generateExpenseReportHTML({
        expenses,
        user,
        categories,
        totalAmount,
        categoryTotals,
        ...options
      });

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Expense Report'
        });
      }
    } catch (error) {
      throw new Error(`Failed to export PDF: ${error}`);
    }
  }

  // Generate HTML for expense report
  private generateExpenseReportHTML(data: any): string {
    const {
      expenses,
      user,
      totalAmount,
      categoryTotals,
      title = 'Expense Report',
      dateRange
    } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f8f9fa;
          color: #333;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #0066FF, #4ECDC4);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 30px;
        }
        .summary {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-item h3 {
          margin: 0 0 5px 0;
          font-size: 24px;
          color: #0066FF;
          font-weight: 700;
        }
        .summary-item p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          border-bottom: 2px solid #0066FF;
          padding-bottom: 10px;
          margin-bottom: 20px;
          color: #0066FF;
          font-size: 20px;
        }
        .expense-list {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          overflow: hidden;
        }
        .expense-item {
          padding: 15px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .expense-item:last-child {
          border-bottom: none;
        }
        .expense-item:nth-child(even) {
          background-color: #f8f9fa;
        }
        .expense-details h4 {
          margin: 0 0 5px 0;
          font-size: 16px;
          color: #333;
        }
        .expense-details p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }
        .expense-amount {
          font-size: 16px;
          font-weight: 700;
          color: #dc3545;
        }
        .category-breakdown {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        .category-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #0066FF;
        }
        .category-item h4 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 16px;
        }
        .category-item p {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0066FF;
        }
        .footer {
          text-align: center;
          padding: 20px;
          background: #f8f9fa;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
          ${dateRange ? `<p>${format(dateRange.startDate, 'MMM dd')} - ${format(dateRange.endDate, 'MMM dd, yyyy')}</p>` : ''}
        </div>
        
        <div class="content">
          <div class="summary">
            <div class="summary-item">
              <h3>${user?.currency || '₹'}${totalAmount.toFixed(2)}</h3>
              <p>Total Spent</p>
            </div>
            <div class="summary-item">
              <h3>${expenses.length}</h3>
              <p>Total Expenses</p>
            </div>
            <div class="summary-item">
              <h3>${user?.currency || '₹'}${expenses.length > 0 ? (totalAmount / expenses.length).toFixed(2) : '0.00'}</h3>
              <p>Average per Expense</p>
            </div>
          </div>

          <div class="section">
            <h2>Category Breakdown</h2>
            <div class="category-breakdown">
              ${Object.entries(categoryTotals)
                .sort(([,a], [,b]) => b - a)
                .map(([category, amount]) => `
                  <div class="category-item">
                    <h4>${category}</h4>
                    <p>${user?.currency || '₹'}${amount.toFixed(2)}</p>
                  </div>
                `).join('')}
            </div>
          </div>

          <div class="section">
            <h2>Expense Details</h2>
            <div class="expense-list">
              ${expenses.map(expense => `
                <div class="expense-item">
                  <div class="expense-details">
                    <h4>${expense.category || 'Others'}</h4>
                    <p>${expense.description || 'No description'}</p>
                    <p style="font-size: 12px; color: #999;">${format(expense.date, 'MMM dd, yyyy')}</p>
                  </div>
                  <div class="expense-amount">
                    -${user?.currency || '₹'}${expense.amount.toFixed(2)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Generated by Expense Tracker App</p>
          <p>User: ${user?.name || 'Unknown'} (${user?.email || 'No email'})</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  // Export all user data as JSON backup
  async exportDataBackup(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      // Collect all user data
      const userProfile = await userService.getUserProfile();
      const expenses = await expenseService.getExpenses();
      const categories = await categoryService.getCategories();
      const goals = await goalsService.getGoals();
      
      // Get budgets for last 12 months
      const budgets = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const budget = await budgetService.getBudgetForMonth(date.getFullYear(), date.getMonth());
        if (budget) budgets.push(budget);
      }

      const backupData = {
        exportedAt: new Date().toISOString(),
        userId: user.uid,
        userProfile,
        expenses,
        categories,
        goals,
        budgets,
        version: '2.0.0'
      };

      // Create JSON file
      const jsonString = JSON.stringify(backupData, null, 2);
      const fileName = `expense-tracker-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, jsonString);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Data Backup'
        });
      }
    } catch (error) {
      throw new Error(`Failed to export backup: ${error}`);
    }
  }

  // Export expenses to CSV
  async exportExpensesToCSV(expenses: Expense[]): Promise<void> {
    try {
      const user = await userService.getUserProfile();
      
      // Create CSV header
      const headers = ['Date', 'Category', 'Amount', 'Description', 'Created At'];
      
      // Create CSV rows
      const rows = expenses.map(expense => [
        format(expense.date, 'yyyy-MM-dd'),
        expense.category || 'Others',
        expense.amount.toString(),
        expense.description || '',
        format(expense.createdAt, 'yyyy-MM-dd HH:mm:ss')
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const fileName = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Expenses CSV'
        });
      }
    } catch (error) {
      throw new Error(`Failed to export CSV: ${error}`);
    }
  }

  // Generate budget report PDF
  async exportBudgetReportPDF(year: number, month: number): Promise<void> {
    try {
      const analysis = await budgetService.analyzeBudget(year, month);
      const user = await userService.getUserProfile();
      const monthName = format(new Date(year, month), 'MMMM yyyy');

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Budget Report - ${monthName}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
          }
          .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .category-analysis {
            padding: 30px;
          }
          .category-item {
            background: #f8f9fa;
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #0066FF;
          }
          .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
          }
          .progress-fill {
            height: 100%;
            background: #28a745;
            transition: width 0.3s ease;
          }
          .exceeded {
            border-left-color: #dc3545;
          }
          .exceeded .progress-fill {
            background: #dc3545;
          }
          .warning {
            border-left-color: #ffc107;
          }
          .warning .progress-fill {
            background: #ffc107;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Budget Report</h1>
            <p>${monthName}</p>
          </div>

          <div class="summary">
            <div class="summary-card">
              <h3>${user?.currency || '₹'}${analysis.totalBudget.toFixed(2)}</h3>
              <p>Total Budget</p>
            </div>
            <div class="summary-card">
              <h3>${user?.currency || '₹'}${analysis.totalSpent.toFixed(2)}</h3>
              <p>Total Spent</p>
            </div>
            <div class="summary-card">
              <h3>${user?.currency || '₹'}${analysis.remainingBudget.toFixed(2)}</h3>
              <p>Remaining</p>
            </div>
            <div class="summary-card">
              <h3>${analysis.percentageUsed.toFixed(1)}%</h3>
              <p>Budget Used</p>
            </div>
          </div>

          <div class="category-analysis">
            <h2>Category Breakdown</h2>
            ${Object.entries(analysis.categoryAnalysis).map(([category, data]) => `
              <div class="category-item ${data.status}">
                <h4>${category}</h4>
                <p>Budgeted: ${user?.currency || '₹'}${data.budgeted.toFixed(2)} | 
                   Spent: ${user?.currency || '₹'}${data.spent.toFixed(2)} | 
                   Remaining: ${user?.currency || '₹'}${data.remaining.toFixed(2)}</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(100, data.percentageUsed)}%"></div>
                </div>
                <p style="font-size: 12px; margin: 5px 0 0 0;">${data.percentageUsed.toFixed(1)}% used</p>
              </div>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Budget Report'
        });
      }
    } catch (error) {
      throw new Error(`Failed to export budget report: ${error}`);
    }
  }

  // Get export file size estimate
  async getExportSizeEstimate(): Promise<{ expenses: number; total: number }> {
    try {
      const expenses = await expenseService.getExpenses();
      const expenseSize = JSON.stringify(expenses).length;
      
      // Estimate total size (rough calculation)
      const totalSize = expenseSize * 3; // Factor in other data
      
      return {
        expenses: Math.round(expenseSize / 1024), // KB
        total: Math.round(totalSize / 1024) // KB
      };
    } catch (error) {
      throw new Error(`Failed to estimate export size: ${error}`);
    }
  }
}

export const exportService = new ExportService();