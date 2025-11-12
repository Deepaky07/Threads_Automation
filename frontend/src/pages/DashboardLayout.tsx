import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [threadsLoggedIn, setThreadsLoggedIn] = useState(false);
  const [stats, setStats] = useState({
    credentialsSaved: false,
    threadsConnected: false,
    successCount: 0,
    errorCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState([
    {
      id: 1,
      action: "Credentials saved successfully",
      time: "Just now",
      status: "success",
    },
    {
      id: 2,
      action: "Connected to Threads",
      time: "2 minutes ago",
      status: "success",
    },
    {
      id: 3,
      action: "Auto-reply sent",
      time: "5 minutes ago",
      status: "success",
    },
  ]);

  // Protect route
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || !user) {
        navigate("/", { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Check if credentials are already saved on mount
  useEffect(() => {
    checkCredentialsStatus();
  }, []);

  // Check credentials status from backend
  const checkCredentialsStatus = async () => {
    try {
      setIsChecking(true);
      const response = await fetch(
        "http://localhost:3000/api/get-credentials",
        {
          method: "GET",
          credentials: "include", // Important: sends cookies
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.credentials?.hasSavedCredentials) {
          setCredentialsSaved(true);
          setThreadsLoggedIn(data.credentials?.threadsLoggedIn || false);
          setStats((prev) => ({
            ...prev,
            credentialsSaved: true,
            threadsConnected: data.credentials?.threadsLoggedIn || false,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to check credentials status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // Save credentials to backend (HTTPOnly cookies)
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!credentials.username || !credentials.password) {
        toast.error("Please fill in both fields");
        setIsSaving(false);
        return;
      }

      // Send credentials to backend to store in HTTPOnly cookies
      const response = await fetch(
        "http://localhost:3000/api/save-credentials",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Important: allows cookies to be set
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Credentials saved successfully! ✅");

        // Optionally login to Threads and get access tokens
        await performThreadsLogin(credentials.username, credentials.password);

        setCredentials({ username: "", password: "" });
        setCredentialsSaved(true);
        setStats((prev) => ({ ...prev, credentialsSaved: true }));

        // Add to activity log
        addActivity("Credentials saved successfully", "success");
      } else {
        toast.error(data.message || "Failed to save credentials");
        addActivity("Failed to save credentials", "error");
      }
    } catch (error) {
      toast.error("Failed to save credentials");
      console.error("Save credentials error:", error);
      addActivity("Error saving credentials", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Perform Threads login and get access tokens
  const performThreadsLogin = async (username: string, password: string) => {
    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/threads-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Connected to Threads! 🎉");
        setThreadsLoggedIn(true);
        setStats((prev) => ({ ...prev, threadsConnected: true }));
        addActivity("Connected to Threads successfully", "success");
        console.log("✅ Threads cookies stored");
      } else {
        toast.warning("Credentials saved but Threads login failed");
        addActivity("Threads login failed", "error");
      }
    } catch (error) {
      console.error("Threads login error:", error);
      toast.warning("Credentials saved but couldn't login to Threads");
      addActivity("Threads login error", "error");
    }
  };

  // Delete credentials
  const handleDeleteCredentials = async () => {
    if (!window.confirm("Are you sure? This will delete your saved credentials.")) {
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3000/api/delete-credentials",
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (data.success) {
        setCredentialsSaved(false);
        setThreadsLoggedIn(false);
        setStats((prev) => ({
          ...prev,
          credentialsSaved: false,
          threadsConnected: false,
        }));
        toast.success("Credentials deleted successfully");
        addActivity("Credentials deleted", "warning");
      } else {
        toast.error("Failed to delete credentials");
      }
    } catch (error) {
      toast.error("Failed to delete credentials");
      console.error("Delete error:", error);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      // Delete credentials from backend
      await fetch("http://localhost:3000/api/delete-credentials", {
        method: "DELETE",
        credentials: "include",
      });

      logout();
      toast.success("Logged out successfully");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Logout failed");
      console.error("Logout error:", error);
    }
  };

  // Add to activity log
  const addActivity = (action: string, status: "success" | "error" | "warning") => {
    const newActivity = {
      id: Date.now(),
      action,
      time: "Just now",
      status,
    };
    setRecentActivity((prev) => [newActivity, ...prev.slice(0, 4)]);
  };

  // Refresh credentials status
  const handleRefresh = async () => {
    await checkCredentialsStatus();
    toast.success("Status refreshed");
  };

  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 mx-auto mb-2" />
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome, <span className="font-semibold">{user?.username || user?.email}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Credentials Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Credentials Section */}
            {!credentialsSaved ? (
              <Card className="p-6 border-2 border-blue-200 dark:border-blue-800">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Save Threads Credentials</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Save your Threads credentials securely. We'll store them as
                    HTTPOnly cookies and use them to authenticate all automation
                    tasks.
                  </p>
                </div>

                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <div>
                    <Label htmlFor="username" className="font-medium">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      value={credentials.username}
                      onChange={(e) =>
                        setCredentials({ ...credentials, username: e.target.value })
                      }
                      placeholder="Enter your Threads username"
                      disabled={isSaving}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="font-medium">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={credentials.password}
                      onChange={(e) =>
                        setCredentials({ ...credentials, password: e.target.value })
                      }
                      placeholder="Enter your Threads password"
                      disabled={isSaving}
                      className="mt-1"
                    />
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                    <p>
                      🔒 Your credentials are encrypted and stored securely. We never
                      share them with third parties.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full h-10 font-medium"
                  >
                    {isSaving ? (
                      <>
                        <Loader className="animate-spin mr-2 h-4 w-4" />
                        Saving...
                      </>
                    ) : (
                      "Save Credentials"
                    )}
                  </Button>
                </form>
              </Card>
            ) : (
              <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-600 dark:text-green-400 mt-0.5 h-6 w-6 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100">
                        ✅ Credentials Saved
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Your credentials are securely stored and ready to use. All
                        automation tasks will use these saved credentials.
                      </p>
                      {threadsLoggedIn && (
                        <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                          🎉 Successfully connected to Threads!
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteCredentials}
                    className="text-red-600 hover:text-red-700 border-red-200"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      {item.status === "warning" && (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="text-sm font-medium">{item.action}</span>
                    </div>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-4">
            {/* Credentials Status */}
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Credentials
              </h4>
              <div className="flex items-center gap-2">
                {credentialsSaved ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Saved</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Not Set</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {credentialsSaved ? "Ready to use" : "Configure to proceed"}
              </p>
            </Card>

            {/* Threads Connection */}
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Threads Connect
              </h4>
              <div className="flex items-center gap-2">
                {threadsLoggedIn ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Offline</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {threadsLoggedIn ? "Access tokens active" : "Save credentials first"}
              </p>
            </Card>

            {/* Success Count */}
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Successful
              </h4>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {stats.successCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total interactions</p>
            </Card>

            {/* Error Count */}
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Failed
              </h4>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {stats.errorCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Error count</p>
            </Card>

            {/* Tips Section */}
            <Card className="p-5 bg-blue-50 dark:bg-blue-900/20">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                💡 Tips
              </h4>
              <ul className="text-xs space-y-2 text-blue-800 dark:text-blue-200">
                <li>✓ Save credentials first</li>
                <li>✓ Connect to Threads</li>
                <li>✓ Start automation</li>
                <li>✓ Monitor activities</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
