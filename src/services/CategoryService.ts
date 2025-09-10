import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  Timestamp 
} from "firebase/firestore";
import { auth, db, DEFAULT_CATEGORIES } from "../firebaseConfig";
import { v4 as uuidv4 } from 'uuid';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class CategoryService {
  private getUserDocRef() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return doc(db, 'users', user.uid);
  }

  // Get all categories for current user
  async getCategories(): Promise<Category[]> {
    try {
      const userDoc = await getDoc(this.getUserDocRef());
      if (userDoc.exists()) {
        const data = userDoc.data();
        return data.categories || DEFAULT_CATEGORIES;
      }
      // If no categories exist, return default categories
      return DEFAULT_CATEGORIES;
    } catch (error) {
      throw new Error(`Failed to get categories: ${error}`);
    }
  }

  // Add a new category
  async addCategory(categoryData: Omit<Category, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newCategory: Category = {
        ...categoryData,
        id: uuidv4(),
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await updateDoc(this.getUserDocRef(), {
        categories: arrayUnion(newCategory),
        updatedAt: Timestamp.fromDate(new Date())
      });

      return newCategory.id;
    } catch (error) {
      throw new Error(`Failed to add category: ${error}`);
    }
  }

  // Update an existing category
  async updateCategory(categoryId: string, updates: Partial<Category>): Promise<void> {
    try {
      const categories = await this.getCategories();
      const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
      
      if (categoryIndex === -1) {
        throw new Error('Category not found');
      }

      // Check if it's a default category and prevent name changes
      if (categories[categoryIndex].isDefault && updates.name) {
        throw new Error('Cannot modify default category name');
      }

      const updatedCategory = {
        ...categories[categoryIndex],
        ...updates,
        updatedAt: new Date()
      };

      categories[categoryIndex] = updatedCategory;

      await updateDoc(this.getUserDocRef(), {
        categories: categories,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      throw new Error(`Failed to update category: ${error}`);
    }
  }

  // Delete a category (only non-default categories)
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const categories = await this.getCategories();
      const categoryToDelete = categories.find(cat => cat.id === categoryId);
      
      if (!categoryToDelete) {
        throw new Error('Category not found');
      }

      if (categoryToDelete.isDefault) {
        throw new Error('Cannot delete default category');
      }

      const updatedCategories = categories.filter(cat => cat.id !== categoryId);

      await updateDoc(this.getUserDocRef(), {
        categories: updatedCategories,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      throw new Error(`Failed to delete category: ${error}`);
    }
  }

  // Get category by ID
  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const categories = await this.getCategories();
      return categories.find(cat => cat.id === categoryId) || null;
    } catch (error) {
      throw new Error(`Failed to get category: ${error}`);
    }
  }

  // Get category by name
  async getCategoryByName(name: string): Promise<Category | null> {
    try {
      const categories = await this.getCategories();
      return categories.find(cat => cat.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (error) {
      throw new Error(`Failed to get category: ${error}`);
    }
  }

  // Reset to default categories
  async resetToDefaultCategories(): Promise<void> {
    try {
      await updateDoc(this.getUserDocRef(), {
        categories: DEFAULT_CATEGORIES,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      throw new Error(`Failed to reset categories: ${error}`);
    }
  }

  // Get available icons for categories
  getAvailableIcons(): string[] {
    return [
      'restaurant', 'car', 'game-controller', 'receipt', 'bag', 'medical',
      'home', 'airplane', 'book', 'barbell', 'gift', 'heart',
      'school', 'briefcase', 'card', 'phone', 'laptop', 'camera',
      'musical-notes', 'shirt', 'wine', 'cafe', 'bus', 'bicycle',
      'ellipsis-horizontal'
    ];
  }

  // Get available colors for categories
  getAvailableColors(): string[] {
    return [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#95A5A6', '#E17055', '#74B9FF', '#A29BFE',
      '#FD79A8', '#FDCB6E', '#6C5CE7', '#E84393', '#00B894',
      '#00CEC9', '#0984E3', '#B2BEC3', '#636E72', '#2D3436'
    ];
  }
}

export const categoryService = new CategoryService();