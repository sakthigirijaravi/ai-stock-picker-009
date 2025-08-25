/**
 * Session Management Utilities
 * Handles user session state, location tracking, and authentication flow
 */

export interface SessionState {
  lastLocation: string | null;
  timestamp: number;
  userId?: string;
}

class SessionManager {
  private static instance: SessionManager;
  private readonly STORAGE_KEY = 'passiveWealth_session';
  private readonly LOCATION_KEY = 'passiveWealth_lastLocation';
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Store user's current location for session restoration
   */
  storeLocation(path: string): void {
    try {
      if (typeof window === 'undefined') return;
      
      // Don't store auth callback or root paths
      if (path === '/auth/callback' || path === '/') return;
      
      const sessionState: SessionState = {
        lastLocation: path,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.LOCATION_KEY, JSON.stringify(sessionState));
      console.log('Stored location:', path);
    } catch (error) {
      console.error('Error storing location:', error);
    }
  }

  /**
   * Retrieve stored location for session restoration
   */
  getStoredLocation(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const stored = localStorage.getItem(this.LOCATION_KEY);
      if (!stored) return null;
      
      const sessionState: SessionState = JSON.parse(stored);
      
      // Check if session is expired
      if (Date.now() - sessionState.timestamp > this.SESSION_TIMEOUT) {
        this.clearStoredLocation();
        return null;
      }
      
      return sessionState.lastLocation;
    } catch (error) {
      console.error('Error retrieving stored location:', error);
      return null;
    }
  }

  /**
   * Clear stored location
   */
  clearStoredLocation(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(this.LOCATION_KEY);
      console.log('Cleared stored location');
    } catch (error) {
      console.error('Error clearing stored location:', error);
    }
  }

  /**
   * Store session metadata
   */
  storeSessionMetadata(userId: string, metadata: Record<string, any>): void {
    try {
      if (typeof window === 'undefined') return;
      
      const sessionData = {
        userId,
        metadata,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error storing session metadata:', error);
    }
  }

  /**
   * Retrieve session metadata
   */
  getSessionMetadata(): { userId: string; metadata: Record<string, any> } | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      
      const sessionData = JSON.parse(stored);
      
      // Check if session is expired
      if (Date.now() - sessionData.timestamp > this.SESSION_TIMEOUT) {
        this.clearSessionMetadata();
        return null;
      }
      
      return {
        userId: sessionData.userId,
        metadata: sessionData.metadata
      };
    } catch (error) {
      console.error('Error retrieving session metadata:', error);
      return null;
    }
  }

  /**
   * Clear session metadata
   */
  clearSessionMetadata(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing session metadata:', error);
    }
  }

  /**
   * Clear all session data
   */
  clearAll(): void {
    this.clearStoredLocation();
    this.clearSessionMetadata();
  }

  /**
   * Check if current path should be stored for restoration
   */
  shouldStorePath(path: string): boolean {
    const excludedPaths = [
      '/auth/callback',
      '/',
      '/login',
      '/signup'
    ];
    
    return !excludedPaths.includes(path) && !path.startsWith('/auth/');
  }

  /**
   * Get default redirect path after login
   */
  getDefaultRedirectPath(): string {
    return '/momentum';
  }

  /**
   * Determine redirect path after successful authentication
   */
  getRedirectPath(): string {
    const storedLocation = this.getStoredLocation();
    return storedLocation || this.getDefaultRedirectPath();
  }
}

export const sessionManager = SessionManager.getInstance();