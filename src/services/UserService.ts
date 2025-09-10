import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  Timestamp 
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  User
} from "firebase/auth";
import { auth, db, DEFAULT_CATEGORIES } from "../firebaseConfig";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  monthlyIncome?: number;
  monthlyBudget?: number;
  currency: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
  };
}

class UserService {
  // Register new user
  async registerUser(
    email: string, 
    password: string, 
    name: string, 
    monthlyIncome?: number
  ): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update auth profile
      await updateProfile(user, { displayName: name });

      // Create user profile in Firestore
      const userProfile: Omit<UserProfile, 'uid'> = {
        name,
        email: user.email!,
        monthlyIncome: monthlyIncome || 0,
        monthlyBudget: monthlyIncome ? monthlyIncome * 0.8 : 0, // Default 80% of income
        currency: '₹',
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          notifications: true,
          theme: 'light',
          language: 'en'
        }
      };

      await this.createUserProfile(user.uid, userProfile);
      
      // Initialize default categories
      await this.initializeDefaultCategories(user.uid);

      return user;
    } catch (error: any) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  // Login user
  async loginUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Logout user
  async logoutUser(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  // Create user profile in Firestore
  private async createUserProfile(uid: string, profile: Omit<UserProfile, 'uid'>): Promise<void> {
    try {
      await setDoc(doc(db, 'users', uid), {
        ...profile,
        uid,
        createdAt: Timestamp.fromDate(profile.createdAt),
        updatedAt: Timestamp.fromDate(profile.updatedAt)
      });
    } catch (error) {
      throw new Error(`Failed to create user profile: ${error}`);
    }
  }

  // Initialize default categories for new user
  private async initializeDefaultCategories(uid: string): Promise<void> {
    try {
      const categoriesRef = doc(db, 'users', uid);
      await setDoc(categoriesRef, {
        categories: DEFAULT_CATEGORIES
      }, { merge: true });
    } catch (error) {
      throw new Error(`Failed to initialize categories: ${error}`);
    }
  }

  // Get user profile
  async getUserProfile(uid?: string): Promise<UserProfile | null> {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as UserProfile;
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error}`);
    }
  }

  // Update user profile
  async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Update Firestore document
      await updateDoc(doc(db, 'users', user.uid), updateData);

      // Update auth profile if name changed
      if (updates.name) {
        await updateProfile(user, { displayName: updates.name });
      }
    } catch (error) {
      throw new Error(`Failed to update profile: ${error}`);
    }
  }

  // Change password
  async changePassword(newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      await updatePassword(user, newPassword);
    } catch (error: any) {
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  // Update user preferences
  async updatePreferences(preferences: Partial<UserProfile['preferences']>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const currentProfile = await this.getUserProfile();
      if (!currentProfile) throw new Error('User profile not found');

      const updatedPreferences = {
        ...currentProfile.preferences,
        ...preferences
      };

      await updateDoc(doc(db, 'users', user.uid), {
        preferences: updatedPreferences,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      throw new Error(`Failed to update preferences: ${error}`);
    }
  }

  // Get current user's basic info
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }
}

export const userService = new UserService();