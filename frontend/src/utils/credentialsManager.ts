// utils/credentialsManager.ts
import Cookies from "js-cookie";

/**
 * Credential Manager - Centralized way to handle credentials across all components
 * This utility provides a single source of truth for managing Threads credentials
 */

export const CredentialsManager = {
  /**
   * Save credentials to secure HTTPOnly cookies and localStorage
   * @param username - Threads username
   * @param password - Threads password
   * @returns Success status and error message if applicable
   */
  saveCredentials: (username: string, password: string) => {
    try {
      if (!username || !password) {
        throw new Error("Username and password are required");
      }

      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      Cookies.set("threads_username", username, {
        expires: 30,
        secure: window.location.protocol === "https:",
        sameSite: "Strict",
      });

      Cookies.set("threads_password", password, {
        expires: 30,
        secure: window.location.protocol === "https:",
        sameSite: "Strict",
      });

      localStorage.setItem(
        "credentials_saved",
        JSON.stringify({
          username,
          timestamp: new Date().toISOString(),
        })
      );

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "credentials_saved",
          newValue: JSON.stringify({ username }),
        })
      );

      console.log("✅ Credentials saved successfully");
      return { success: true };
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get credentials from cookies
   * @returns Object with username, password, and found flag
   */
  getCredentials: () => {
    try {
      const username = Cookies.get("threads_username");
      const password = Cookies.get("threads_password");

      if (username && password) {
        console.log("✅ Credentials found");
        return { username, password, found: true };
      }

      console.warn("⚠️ No credentials found");
      return { username: "", password: "", found: false };
    } catch (error) {
      console.error("Error getting credentials:", error);
      return { username: "", password: "", found: false };
    }
  },

  /**
   * Get username only (safe to display)
   * @returns Username string or empty string if not found
   */
  getUsername: () => {
    try {
      const username = Cookies.get("threads_username");
      return username || "";
    } catch (error) {
      console.error("Error getting username:", error);
      return "";
    }
  },

  /**
   * Check if credentials are saved and valid
   * @returns Boolean indicating if credentials exist
   */
  hasCredentials: (): boolean => {
    try {
      const username = Cookies.get("threads_username");
      const password = Cookies.get("threads_password");
      return !!(username && password);
    } catch (error) {
      console.error("Error checking credentials:", error);
      return false;
    }
  },

  /**
   * Delete credentials completely
   * @returns Success status and error message if applicable
   */
  deleteCredentials: () => {
    try {
      Cookies.remove("threads_username");
      Cookies.remove("threads_password");
      localStorage.removeItem("credentials_saved");

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "credentials_saved",
          newValue: null,
        })
      );

      console.log("🗑️  Credentials deleted");
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting credentials:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Listen for credential changes (for cross-tab sync)
   * @param callback - Function to call when credentials change
   * @returns Unsubscribe function to remove listener
   */
  onCredentialsChange: (callback: (hasCredentials: boolean) => void) => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "credentials_saved") {
        const hasCredentials = !!e.newValue;
        console.log("📢 Credentials changed:", hasCredentials);
        callback(hasCredentials);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  },

  /**
   * Validate credentials by trying a test call to backend
   * @returns Boolean indicating if credentials are valid on backend
   */
  validateCredentials: async (): Promise<boolean> => {
    try {
      const { username, password } = CredentialsManager.getCredentials();

      if (!username || !password) {
        return false;
      }

      const response = await fetch("http://localhost:3000/api/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasValidSession === true;
      }

      return false;
    } catch (error) {
      console.error("Error validating credentials:", error);
      return false;
    }
  },

  /**
   * Clear and reset all credential data
   * Useful for debugging or manual reset
   */
  resetAll: () => {
    try {
      Cookies.remove("threads_username");
      Cookies.remove("threads_password");
      localStorage.clear();
      console.log("🔄 All credentials and storage cleared");
      return { success: true };
    } catch (error: any) {
      console.error("Error resetting credentials:", error);
      return { success: false, error: error.message };
    }
  },
};

export default CredentialsManager;
