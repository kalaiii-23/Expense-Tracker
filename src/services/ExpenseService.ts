import { db, auth } from "../firebaseConfig";
import { ref, push, set, get, child } from "firebase/database";

// Save a new expense
export const addExpense = async (amount: number, category: string, description: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const expenseRef = push(ref(db, `users/${user.uid}/expenses`));
  await set(expenseRef, {
    amount,
    category,
    description,
    date: new Date().toISOString()
  });
};

// Fetch all expenses for a given month (year, monthIndex)
export const getExpensesForMonth = async (year: number, month: number) => {
  const user = auth.currentUser;
  if (!user) return [];

  const snapshot = await get(child(ref(db), `users/${user.uid}/expenses`));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(exp => {
        const date = new Date(exp.date);
        return date.getFullYear() === year && date.getMonth() === month;
      });
  } else {
    return [];
  }
};
