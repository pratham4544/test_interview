import { STORAGE_KEYS } from '../utils/constants';

class StorageService {
  // Get item from localStorage
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }

  // Set item in localStorage
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  // Remove item from localStorage
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  // Clear all app data
  clear() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  // Get interview state
  getInterviewState() {
    return this.get(STORAGE_KEYS.INTERVIEW_STATE);
  }

  // Save interview state
  saveInterviewState(state) {
    return this.set(STORAGE_KEYS.INTERVIEW_STATE, state);
  }

  // Get user preferences
  getUserPreferences() {
    return this.get(STORAGE_KEYS.USER_PREFERENCES) || {
      speakQuestions: true,
      autoMode: true,
      audioEnabled: true,
      videoEnabled: true
    };
  }

  // Save user preferences
  saveUserPreferences(preferences) {
    return this.set(STORAGE_KEYS.USER_PREFERENCES, preferences);
  }
}

const storageService = new StorageService();
export default storageService;