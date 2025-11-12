import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Cookies from "js-cookie";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [savedUsername, setSavedUsername] = useState("");
  const [savedUsernames, setSavedUsernames] = useState<string[]>([]);
  const [stats, setStats] = useState({
    credentialsSaved: false,
    successCount: 156,
    errorCount: 3,
  });

  // Protect route
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || !user) {
        navigate("/", { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Fetch all saved usernames from MongoDB
  useEffect(() => {
    const fetchSavedUsernames = async () => {
      try {
        console.log("🔥 Fetching saved usernames from database...");
        const response = await fetch("http://localhost:3000/api/auth/get-usernames", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setSavedUsernames(data.usernames || []);
          console.log("✅ Fetched usernames:", data.usernames);
        } else {
          console.warn("⚠️ Failed to fetch usernames");
        }
      } catch (error) {
        console.error("❌ Error fetching usernames:", error);
      }
    };

    if (isAuthenticated) {
      fetchSavedUsernames();
    }
  }, [isAuthenticated]);

  // Check if credentials are saved
  useEffect(() => {
    const checkCredentials = () => {
      try {
        const savedData = localStorage.getItem("threads_credentials");
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed.username && parsed.password) {
              setCredentialsSaved(true);
              setSavedUsername(parsed.username);
              setStats((prev) => ({
                ...prev,
                credentialsSaved: true,
              }));
              setCredentials({ username: "", password: "" });
              console.log("✅ Credentials found in localStorage:", parsed.username);
              return;
            }
          } catch (e) {
            console.error("Parse error:", e);
          }
        }

        const cookieUsername = Cookies.get("threads_username");
        const cookiePassword = Cookies.get("threads_password");

        if (cookieUsername && cookiePassword) {
          setCredentialsSaved(true);
          setSavedUsername(cookieUsername);
          setStats((prev) => ({
            ...prev,
            credentialsSaved: true,
          }));
          setCredentials({ username: "", password: "" });
          console.log("✅ Credentials found in cookies:", cookieUsername);

          localStorage.setItem(
            "threads_credentials",
            JSON.stringify({
              username: cookieUsername,
              password: cookiePassword,
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        setCredentialsSaved(false);
        setSavedUsername("");
        setCredentials({ username: "", password: "" });
      } catch (error) {
        console.error("Error checking credentials:", error);
      }
    };

    checkCredentials();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "threads_credentials") {
        console.log("📢 Credentials updated from another tab");
        checkCredentials();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!credentials.username || !credentials.password) {
        toast.error("❌ Please fill in both fields");
        setIsSaving(false);
        return;
      }

      if (credentials.username.length < 3) {
        toast.error("❌ Username must be at least 3 characters");
        setIsSaving(false);
        return;
      }

      if (credentials.password.length < 6) {
        toast.error("❌ Password must be at least 6 characters");
        setIsSaving(false);
        return;
      }

      console.log("💾 Saving credentials...");

      const response = await fetch("http://localhost:3000/api/auth/save-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to save credentials to server"
        );
      }

      const data = await response.json();
      console.log("✅ Server response:", data);

      const credentialsData = {
        username: credentials.username,
        password: credentials.password,
        timestamp: new Date().toISOString(),
        serverSaved: true,
      };
      localStorage.setItem("threads_credentials", JSON.stringify(credentialsData));

      try {
        Cookies.set("threads_username", credentials.username, { expires: 30 });
        Cookies.set("threads_password", credentials.password, { expires: 30 });
      } catch (cookieError) {
        console.warn("⚠️ Cookie error (non-fatal):", cookieError);
      }

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "threads_credentials",
          newValue: JSON.stringify(credentialsData),
        })
      );
      window.dispatchEvent(
        new CustomEvent("credentials-updated", {
          detail: credentialsData,
        })
      );

      toast.success("✅ Credentials saved successfully!");

      setCredentials({ username: "", password: "" });
      setCredentialsSaved(true);
      setSavedUsername(credentialsData.username);
      setStats((prev) => ({
        ...prev,
        credentialsSaved: true,
      }));

      const usernamesResponse = await fetch("http://localhost:3000/api/auth/get-usernames", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (usernamesResponse.ok) {
        const usernamesData = await usernamesResponse.json();
        setSavedUsernames(usernamesData.usernames || []);
      }

      console.log("✅ Complete! All storage methods updated");
    } catch (error: any) {
      console.error("❌ Error saving credentials:", error);
      toast.error("❌ Failed to save credentials: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCredentials = () => {
    console.log("🔄 Update credentials clicked");
    setCredentialsSaved(false);
    setCredentials({
      username: savedUsername,
      password: "",
    });
    setStats((prev) => ({
      ...prev,
      credentialsSaved: false,
    }));
    toast.info("📝 You can now update your credentials");
  };

  const handleDeleteCredentials = async () => {
    try {
      console.log("🗑️ Deleting credentials...");

      await fetch("http://localhost:3000/api/auth/delete-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: savedUsername,
        }),
      }).catch((err) => console.warn("⚠️ Server delete warning:", err.message));

      localStorage.removeItem("threads_credentials");
      Cookies.remove("threads_username");
      Cookies.remove("threads_password");

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "threads_credentials",
          newValue: null,
        })
      );

      setCredentials({ username: "", password: "" });
      setCredentialsSaved(false);
      setSavedUsername("");
      setStats((prev) => ({
        ...prev,
        credentialsSaved: false,
      }));

      const usernamesResponse = await fetch("http://localhost:3000/api/auth/get-usernames", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (usernamesResponse.ok) {
        const usernamesData = await usernamesResponse.json();
        setSavedUsernames(usernamesData.usernames || []);
      }

      toast.success("✅ Credentials deleted successfully");
    } catch (error: any) {
      console.error("Error deleting credentials:", error);
      toast.error("❌ Failed to delete credentials");
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("threads_credentials");
      Cookies.remove("threads_username");
      Cookies.remove("threads_password");
      logout();
      toast.success("✅ Logged out successfully");
      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.error("❌ Logout failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B4FFF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">System Active</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-gray-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="gap-2 text-gray-700 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your Threads automation credentials and tasks</p>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Credentials</h2>
              <p className="text-sm text-gray-600">Enter your Threads account credentials to enable automation</p>
            </div>

            <form onSubmit={handleSaveCredentials}>
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Username Field with Dropdown */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      Threads Username
                    </Label>
                    <div className="relative">
                      <Input
                        type="text"
                        list="saved-usernames"
                        value={credentialsSaved ? savedUsername : credentials.username}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            username: e.target.value,
                          }))
                        }
                        disabled={credentialsSaved}
                        placeholder="Enter your username"
                        className="w-full bg-gray-50 border-gray-200 text-gray-900 pr-10"
                      />
                      <datalist id="saved-usernames">
                        {savedUsernames.map((username, index) => (
                          <option key={index} value={username} />
                        ))}
                      </datalist>
                      {credentialsSaved && (
                        <button
                          type="button"
                          onClick={handleDeleteCredentials}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      Password *
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••"
                        value={credentials.password}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        disabled={credentialsSaved}
                        className="w-full bg-gray-50 border-gray-200 text-gray-900 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={credentialsSaved}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Recovery Email (Optional) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      Recovery Email
                    </Label>
                    <Input
                      type="email"
                      placeholder="recovery@email.com"
                      className="w-full bg-gray-50 border-gray-200 text-gray-400"
                      disabled
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Email Field (Mirrored from username) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      Email *
                    </Label>
                    <Input
                      type="text"
                      value={credentialsSaved ? savedUsername : credentials.username}
                      onChange={(e) => {
                        if (!credentialsSaved) {
                          setCredentials({ ...credentials, username: e.target.value });
                        }
                      }}
                      placeholder={credentialsSaved ? savedUsername : "ytmantra999@gmail.com"}
                      disabled={credentialsSaved}
                      readOnly={credentialsSaved}
                      className="w-full bg-gray-50 border-gray-200 text-gray-900"
                    />
                  </div>

                  {/* 2FA Code (Optional) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      2FA Code
                    </Label>
                    <Input
                      type="text"
                      placeholder="123456"
                      className="w-full bg-gray-50 border-gray-200 text-gray-400"
                      disabled
                    />
                  </div>

                  {/* Recovery Password (Optional) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 mb-2 block">
                      Recovery Password
                    </Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border-gray-200 text-gray-400"
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Success Message and Button */}
              {credentialsSaved && (
                <div className="mb-4 flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleUpdateCredentials}
                    variant="outline"
                    className="gap-2 border-[#5B4FFF] text-[#5B4FFF] hover:bg-[#F0EFFF] rounded-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Update Credentials
                  </Button>
                  <div className="flex items-center gap-2 bg-[#E8E7FF] text-[#5B4FFF] px-3 py-1.5 rounded-full text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">success</span>
                    <span className="ml-2">15.86s</span>
                  </div>
                </div>
              )}

              {credentialsSaved && (
                <p className="text-sm text-gray-600 mb-4">
                  Session restored successfully from database.
                </p>
              )}

              {/* Save Button */}
              <Button
                type="submit"
                disabled={isSaving || credentialsSaved}
                className="w-full bg-[#5B4FFF] hover:bg-[#4A3FEE] text-white py-6 text-base font-medium disabled:bg-[#8B85FF] rounded-lg"
              >
                {isSaving ? "Saving..." : "Save Credentials to Database"}
              </Button>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}