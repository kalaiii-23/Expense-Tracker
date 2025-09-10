import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export interface SavingsGoal {
  id?: string;
  userId: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  icon?: string;
  color?: string;
}

export interface GoalTransaction {
  id?: string;
  goalId: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description?: string;
  date: Date;
  createdAt: Date;
}

export interface GoalAnalysis {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalSavedAmount: number;
  averageProgress: number;
  upcomingDeadlines: SavingsGoal[];
  recommendations: string[];
}

class GoalsService {
  private getGoalsCollection() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, `users/${user.uid}/savingsGoals`);
  }

  private getTransactionsCollection() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, `users/${user.uid}/goalTransactions`);
  }

  // Create a new savings goal
  async createGoal(goalData: Omit<SavingsGoal, 'id' | 'userId' | 'currentAmount' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const goal: Omit<SavingsGoal, 'id'> = {
        ...goalData,
        userId: user.uid,
        currentAmount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(this.getGoalsCollection(), {
        ...goal,
        targetDate: Timestamp.fromDate(goal.targetDate),
        createdAt: Timestamp.fromDate(goal.createdAt),
        updatedAt: Timestamp.fromDate(goal.updatedAt)
      });

      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to create goal: ${error}`);
    }
  }

  // Get all goals for the current user
  async getGoals(status?: SavingsGoal['status']): Promise<SavingsGoal[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      let goalQuery = query(
        this.getGoalsCollection(),
        orderBy('createdAt', 'desc')
      );

      if (status) {
        goalQuery = query(
          this.getGoalsCollection(),
          where('status', '==', status),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(goalQuery);
      const goals: SavingsGoal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push({
          id: doc.id,
          ...data,
          targetDate: data.targetDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          completedAt: data.completedAt ? data.completedAt.toDate() : undefined
        } as SavingsGoal);
      });

      return goals;
    } catch (error) {
      throw new Error(`Failed to get goals: ${error}`);
    }
  }

  // Get a specific goal by ID
  async getGoalById(goalId: string): Promise<SavingsGoal | null> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const goalDoc = doc(db, `users/${user.uid}/savingsGoals/${goalId}`);
      const docSnap = await getDoc(goalDoc);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          targetDate: data.targetDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          completedAt: data.completedAt ? data.completedAt.toDate() : undefined
        } as SavingsGoal;
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get goal: ${error}`);
    }
  }

  // Update a goal
  async updateGoal(goalId: string, updates: Partial<SavingsGoal>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const goalDoc = doc(db, `users/${user.uid}/savingsGoals/${goalId}`);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (updates.targetDate) {
        updateData.targetDate = Timestamp.fromDate(updates.targetDate);
      }

      if (updates.status === 'completed' && !updates.completedAt) {
        updateData.completedAt = Timestamp.fromDate(new Date());
      }

      await updateDoc(goalDoc, updateData);
    } catch (error) {
      throw new Error(`Failed to update goal: ${error}`);
    }
  }

  // Delete a goal
  async deleteGoal(goalId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      // Delete all transactions for this goal
      const transactions = await this.getGoalTransactions(goalId);
      await Promise.all(
        transactions.map(transaction => 
          deleteDoc(doc(db, `users/${user.uid}/goalTransactions/${transaction.id}`))
        )
      );

      // Delete the goal
      const goalDoc = doc(db, `users/${user.uid}/savingsGoals/${goalId}`);
      await deleteDoc(goalDoc);
    } catch (error) {
      throw new Error(`Failed to delete goal: ${error}`);
    }
  }

  // Add money to a goal
  async addToGoal(goalId: string, amount: number, description?: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const goal = await this.getGoalById(goalId);
      if (!goal) throw new Error('Goal not found');

      // Add transaction
      await this.addGoalTransaction({
        goalId,
        amount,
        type: 'deposit',
        description,
        date: new Date()
      });

      // Update goal's current amount
      const newCurrentAmount = goal.currentAmount + amount;
      const updates: Partial<SavingsGoal> = {
        currentAmount: newCurrentAmount
      };

      // Check if goal is completed
      if (newCurrentAmount >= goal.targetAmount && goal.status === 'active') {
        updates.status = 'completed';
        updates.completedAt = new Date();
      }

      await this.updateGoal(goalId, updates);
    } catch (error) {
      throw new Error(`Failed to add to goal: ${error}`);
    }
  }

  // Withdraw money from a goal
  async withdrawFromGoal(goalId: string, amount: number, description?: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const goal = await this.getGoalById(goalId);
      if (!goal) throw new Error('Goal not found');

      if (goal.currentAmount < amount) {
        throw new Error('Insufficient funds in goal');
      }

      // Add transaction
      await this.addGoalTransaction({
        goalId,
        amount,
        type: 'withdrawal',
        description,
        date: new Date()
      });

      // Update goal's current amount
      const newCurrentAmount = goal.currentAmount - amount;
      const updates: Partial<SavingsGoal> = {
        currentAmount: newCurrentAmount
      };

      // If goal was completed but now isn't, change status back to active
      if (goal.status === 'completed' && newCurrentAmount < goal.targetAmount) {
        updates.status = 'active';
        updates.completedAt = undefined;
      }

      await this.updateGoal(goalId, updates);
    } catch (error) {
      throw new Error(`Failed to withdraw from goal: ${error}`);
    }
  }

  // Add a goal transaction
  private async addGoalTransaction(transactionData: Omit<GoalTransaction, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const transaction: Omit<GoalTransaction, 'id'> = {
        ...transactionData,
        userId: user.uid,
        createdAt: new Date()
      };

      const docRef = await addDoc(this.getTransactionsCollection(), {
        ...transaction,
        date: Timestamp.fromDate(transaction.date),
        createdAt: Timestamp.fromDate(transaction.createdAt)
      });

      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to add goal transaction: ${error}`);
    }
  }

  // Get transactions for a specific goal
  async getGoalTransactions(goalId: string): Promise<GoalTransaction[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const transactionQuery = query(
        this.getTransactionsCollection(),
        where('goalId', '==', goalId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(transactionQuery);
      const transactions: GoalTransaction[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate()
        } as GoalTransaction);
      });

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get goal transactions: ${error}`);
    }
  }

  // Get goal analysis
  async getGoalAnalysis(): Promise<GoalAnalysis> {
    try {
      const allGoals = await this.getGoals();
      const activeGoals = allGoals.filter(goal => goal.status === 'active');
      const completedGoals = allGoals.filter(goal => goal.status === 'completed');

      const totalTargetAmount = allGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
      const totalSavedAmount = allGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);

      const averageProgress = allGoals.length > 0 
        ? allGoals.reduce((sum, goal) => sum + (goal.currentAmount / goal.targetAmount * 100), 0) / allGoals.length
        : 0;

      // Get goals with deadlines in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const upcomingDeadlines = activeGoals.filter(goal => 
        goal.targetDate <= thirtyDaysFromNow
      ).sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

      // Generate recommendations
      const recommendations = this.generateRecommendations(allGoals, activeGoals, completedGoals);

      return {
        totalGoals: allGoals.length,
        activeGoals: activeGoals.length,
        completedGoals: completedGoals.length,
        totalTargetAmount,
        totalSavedAmount,
        averageProgress,
        upcomingDeadlines,
        recommendations
      };
    } catch (error) {
      throw new Error(`Failed to get goal analysis: ${error}`);
    }
  }

  // Generate recommendations based on goals
  private generateRecommendations(allGoals: SavingsGoal[], activeGoals: SavingsGoal[], completedGoals: SavingsGoal[]): string[] {
    const recommendations: string[] = [];

    if (activeGoals.length === 0 && allGoals.length === 0) {
      recommendations.push("Start by setting your first savings goal to begin your financial journey!");
    }

    if (activeGoals.length > 0) {
      const overdue = activeGoals.filter(goal => goal.targetDate < new Date());
      if (overdue.length > 0) {
        recommendations.push(`You have ${overdue.length} overdue goal(s). Consider extending deadlines or increasing contributions.`);
      }

      const lowProgress = activeGoals.filter(goal => (goal.currentAmount / goal.targetAmount) < 0.25);
      if (lowProgress.length > 0) {
        recommendations.push("Some goals have low progress. Consider setting up automatic transfers to stay on track.");
      }

      const highPriorityGoals = activeGoals.filter(goal => goal.priority === 'high');
      if (highPriorityGoals.length > 0) {
        recommendations.push("Focus on your high-priority goals first to maximize your financial impact.");
      }
    }

    if (completedGoals.length > 0) {
      recommendations.push(`Congratulations on completing ${completedGoals.length} goal(s)! Consider setting new challenging goals.`);
    }

    if (activeGoals.length > 5) {
      recommendations.push("You have many active goals. Consider consolidating or prioritizing to improve focus.");
    }

    return recommendations;
  }

  // Calculate required monthly savings for a goal
  calculateRequiredMonthlySavings(goal: SavingsGoal): number {
    const now = new Date();
    const monthsRemaining = Math.max(1, Math.ceil(
      (goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    ));
    
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    return Math.max(0, remainingAmount / monthsRemaining);
  }

  // Get progress percentage for a goal
  getGoalProgress(goal: SavingsGoal): number {
    return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
  }

  // Check if goal is on track
  isGoalOnTrack(goal: SavingsGoal): boolean {
    const now = new Date();
    const totalDays = (goal.targetDate.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysPassed = (now.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    const expectedProgress = Math.min(100, (daysPassed / totalDays) * 100);
    const actualProgress = this.getGoalProgress(goal);
    
    return actualProgress >= expectedProgress * 0.8; // 20% tolerance
  }

  // Get goal categories
  getGoalCategories(): string[] {
    return [
      'Emergency Fund',
      'Vacation',
      'Car',
      'House Down Payment',
      'Education',
      'Wedding',
      'Retirement',
      'Investment',
      'Electronics',
      'Health',
      'Other'
    ];
  }

  // Get goal icons
  getGoalIcons(): string[] {
    return [
      'shield-checkmark',
      'airplane',
      'car-sport',
      'home',
      'school',
      'heart',
      'trending-up',
      'wallet',
      'phone-portrait',
      'medical',
      'ellipsis-horizontal'
    ];
  }

  // Get goal colors
  getGoalColors(): string[] {
    return [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#95A5A6', '#E17055', '#74B9FF', '#A29BFE',
      '#FD79A8', '#FDCB6E', '#6C5CE7', '#E84393', '#00B894'
    ];
  }
}

export const goalsService = new GoalsService();