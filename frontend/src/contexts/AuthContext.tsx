import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextType {
  user: any;
  loading: boolean;
  session: any;
  login: (credentials: any) => Promise<any>;
  signIn: (username: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  checkSavedSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state once on mount
  useEffect(() => {
    if (isInitialized) return;

    const initializeAuth = () => {
      console.log("🔍 Initializing auth state...");
      try {
        const storedUser = localStorage.getItem("user");
        const storedSession = localStorage.getItem("session");

        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          console.log("✅ User restored from localStorage:", userData);
        }

        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          setSession(sessionData);
          console.log("✅ Session restored from localStorage");
        }
      } catch (e) {
        console.error("❌ Error parsing stored auth data:", e);
        localStorage.removeItem("user");
        localStorage.removeItem("session");
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [isInitialized]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user" && e.newValue) {
        try {
          const userData = JSON.parse(e.newValue);
          setUser(userData);
          console.log("✅ User synced from another tab");
        } catch (err) {
          console.error("❌ Error syncing user from storage:", err);
        }
      } else if (e.key === "user" && !e.newValue) {
        setUser(null);
        setSession(null);
        console.log("🚪 Logged out - synced from another tab");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Check if saved session exists on component mount
  const checkSavedSession = async () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return;

      const userData = JSON.parse(storedUser);
      const username = userData.username;

      const response = await fetch("http://localhost:3000/api/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      if (data.hasValidSession) {
        console.log("✅ Valid session found in database");
        setUser(userData);
        setSession(data);
      }
    } catch (error) {
      console.error("Error checking saved session:", error);
    }
  };

  // Login function
  const login = async (credentials: any) => {
    try {
      console.log("🔐 Logging in with credentials:", credentials);
      const userData = {
        ...credentials,
        id: credentials.id || Date.now().toString(),
        loggedIn: true,
        loginTime: new Date().toISOString(),
      };

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));

      const sessionData = {
        user: userData,
        createdAt: new Date().toISOString(),
      };

      setSession(sessionData);
      localStorage.setItem("session", JSON.stringify(sessionData));

      console.log("✅ Login successful:", userData);
      return { user: userData, session: sessionData };
    } catch (error: any) {
      console.error("❌ Login error:", error);
      return { error: { message: error.message } };
    }
  };

  // Threads sign in via backend with session management
  const signIn = async (username: string, password: string) => {
    try {
      console.log("🔐 Checking for saved session...");

      // First check if session exists in backend
      const sessionCheckResponse = await fetch("http://localhost:3000/api/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username })
      });

      const sessionData = await sessionCheckResponse.json();

      if (sessionData.hasValidSession) {
        console.log("✅ Valid session found - auto logging in");
        const userData = {
          username,
          email: username,
          id: Date.now().toString(),
          loggedIn: true,
          loginTime: new Date().toISOString(),
          fromSavedSession: true
        };

        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        setSession(sessionData);
        localStorage.setItem("session", JSON.stringify(sessionData));

        return { user: userData, session: sessionData, restored: true };
      }

      // Otherwise proceed with normal login
      console.log("🔐 No valid session found. Attempting fresh login...");
      const response = await fetch("http://localhost:3000/api/auth/threads-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        const userData = {
          username,
          email: username,
          id: Date.now().toString(),
          loggedIn: true,
          loginTime: new Date().toISOString(),
          sessionSaved: data.sessionSaved
        };

        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));

        const newSession = {
          user: userData,
          redirectUrl: data.redirectUrl,
          createdAt: new Date().toISOString(),
        };

        setSession(newSession);
        localStorage.setItem("session", JSON.stringify(newSession));

        console.log("✅ Sign in successful:", userData);
        return { user: userData, session: newSession, restored: false };
      } else {
        const errorMessage = data.message || "Sign in failed - Invalid credentials";
        console.error("❌ Sign in failed:", errorMessage);
        return {
          error: {
            message: errorMessage,
          },
        };
      }
    } catch (error: any) {
      console.error("❌ Sign in error:", error);
      return { error: { message: error.message || "Network error" } };
    }
  };

  // Sign up
  const signUp = async (email: string, password: string) => {
    try {
      console.log("🔐 Signing up...");
      const userData = {
        email,
        id: Date.now().toString(),
        loggedIn: true,
        signupTime: new Date().toISOString(),
      };

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));

      const sessionData = {
        user: userData,
        createdAt: new Date().toISOString(),
      };

      setSession(sessionData);
      localStorage.setItem("session", JSON.stringify(sessionData));

      console.log("✅ Sign up successful:", userData);
      return { user: userData, session: sessionData };
    } catch (error: any) {
      console.error("❌ Sign up error:", error);
      return { error: { message: error.message } };
    }
  };

  // Logout with session invalidation
  const logout = async () => {
    try {
      console.log("🚪 Logging out...");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (user.username) {
        // Invalidate session in database
        await fetch("http://localhost:3000/api/invalidate-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: user.username })
        }).catch(err => console.warn("Session invalidation error:", err));
      }

      setUser(null);
      setSession(null);
      localStorage.removeItem("user");
      localStorage.removeItem("session");
      console.log("✅ Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isAuthenticated = !!user && user.loggedIn === true;

  const value: AuthContextType = {
    user,
    loading,
    session,
    login,
    signIn,
    signUp,
    logout,
    isAuthenticated,
    checkSavedSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
