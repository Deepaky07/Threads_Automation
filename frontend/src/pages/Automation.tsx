import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  Play,
  Square,
  Bell,
  Search,
  FileText,
  Sparkles,
  Send,
  Heart,
  AlertCircle,
  Workflow,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import Cookies from "js-cookie";

export default function Automation() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, logout } = useAuth();

  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(true);
  const [savedUsername, setSavedUsername] = useState("");
  const [savedPassword, setSavedPassword] = useState("");

  const [likeCommentRunning, setLikeCommentRunning] = useState(false);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [likeCommentStats, setLikeCommentStats] = useState({
    postsProcessed: 0,
    interactions: 0,
    likesSent: 0,
    commentsSent: 0,
    repliesSent: 0,
  });
  const [likeCommentSettings, setLikeCommentSettings] = useState({
    postsToProcess: "",
    likePercentage: "",
    commentPercentage: "",
    replyPercentage: "",
  });

  const [notificationsRunning, setNotificationsRunning] = useState(false);
  const [notificationStats, setNotificationStats] = useState({
    threadsFound: 0,
    interactions: 0,
  });
  const [notificationConfig, setNotificationConfig] = useState({
    checkInterval: 5,
    autoReply: true,
    replyTemplate: "Thank you for your engagement!",
  });

  const [searchRunning, setSearchRunning] = useState(false);
  const [searchStats, setSearchStats] = useState({
    postsProcessed: 0,
    interactions: 0,
    likesSent: 0,
    commentsSent: 0,
    repliesSent: 0,
  });
  const [searchConfig, setSearchConfig] = useState({
    keyword: "",
    searchInterval: 10,
    resultLimit: 50,
    upvotePercentage: "",
    commentPercentage: "",
    replyPercentage: "",
  });

  const [postContent, setPostContent] = useState("");
  const [postTopic, setPostTopic] = useState("");
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postStats, setPostStats] = useState({
    postsCreated: 0,
    scheduled: 0,
  });
  const [generationOptions, setGenerationOptions] = useState({
    tone: "casual",
    length: "medium",
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Flow Bot State
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowUploadedImage, setFlowUploadedImage] = useState<string | null>(null);
  const [flowStats, setFlowStats] = useState({
    postsProcessed: 0,
    likes: 0,
    comments: 0,
    replies: 0,
    notificationsFound: 0,
    postsCreated: 0,
  });
  const [flowConfig, setFlowConfig] = useState({
    searchKeyword: "",
    maxPosts: "30",
    likeProbability: "40",
    commentProbability: "15",
    replyProbability: "15",
    notificationCheckInterval: "2",
    postScheduleTime: "",
    postTopic: "",
    durationMinutes: "120",
  });

  // Fetch CSV stats for the current user
  const fetchCSVStats = async () => {
    try {
      // Only fetch if we have a username
      if (!savedUsername) {
        console.log("No username available, skipping CSV stats fetch");
        return;
      }
      
      // Fetch full CSV data to filter by module for accurate stats
      const response = await fetch(`http://localhost:3000/api/logs/csv/data?username=${encodeURIComponent(savedUsername)}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const allEntries = data.data;
        
        // Filter by module for each card
        const indexJsData = allEntries.filter((entry: any) => entry.Module === 'index.js');
        const notificationData = allEntries.filter((entry: any) => entry.Module === 'notification.js');
        const searchData = allEntries.filter((entry: any) => entry.Module === 'search.js');
        const postJsData = allEntries.filter((entry: any) => entry.Module === 'post.js');
        const flowJsData = allEntries.filter((entry: any) => entry.Module === 'flow.js');
        
        // Update Like/Comment/Reply card (index.js) - count only index.js actions
        const indexLikes = indexJsData.filter((e: any) => e['Action Type'] === 'LIKE').length;
        const indexComments = indexJsData.filter((e: any) => e['Action Type'] === 'COMMENT').length;
        const indexReplies = indexJsData.filter((e: any) => e['Action Type'] === 'REPLY').length;
        const indexPostsProcessed = indexJsData.filter((e: any) => e['Action Type'] === 'AUTOMATION_COMPLETE').length;
        
        setLikeCommentStats({
          postsProcessed: indexJsData.length > 0 ? indexJsData.length : 0,
          interactions: indexLikes + indexComments + indexReplies,
          likesSent: indexLikes,
          commentsSent: indexComments,
          repliesSent: indexReplies,
        });
        
        // Update Notification card (notification.js) - count only notification.js actions
        const notificationReplies = notificationData.filter((e: any) => e['Action Type'] === 'REPLY').length;
        setNotificationStats({
          threadsFound: notificationData.length,
          interactions: notificationReplies,
        });
        
        // Update Search card (search.js) - count only search.js actions
        const searchLikes = searchData.filter((e: any) => e['Action Type'] === 'LIKE').length;
        const searchComments = searchData.filter((e: any) => e['Action Type'] === 'COMMENT').length;
        const searchReplies = searchData.filter((e: any) => e['Action Type'] === 'REPLY').length;
        setSearchStats({
          postsProcessed: searchData.length,
          interactions: searchLikes + searchComments + searchReplies,
          likesSent: searchLikes,
          commentsSent: searchComments,
          repliesSent: searchReplies,
        });
        
        // Update Post Creator card (post.js) - count only post.js POST_CREATED actions
        const postCreated = postJsData.filter((e: any) => e['Action Type'] === 'POST_CREATED').length;
        setPostStats({
          postsCreated: postCreated,
          scheduled: 0,
        });

        // Update Flow Bot card (flow.js) - count only flow.js module actions
        const flowLikes = flowJsData.filter((e: any) => e['Action Type'] === 'LIKE').length;
        const flowComments = flowJsData.filter((e: any) => e['Action Type'] === 'COMMENT').length;
        const flowReplies = flowJsData.filter((e: any) => e['Action Type'] === 'REPLY').length;
        const flowPosts = flowJsData.filter((e: any) => e['Action Type'] === 'POST_CREATED').length;
        
        setFlowStats({
          postsProcessed: flowJsData.length,
          likes: flowLikes,
          comments: flowComments,
          replies: flowReplies,
          notificationsFound: 0, // Notifications are handled separately
          postsCreated: flowPosts,
        });
      }
    } catch (error) {
      console.error("Error fetching CSV stats:", error);
    }
  };

  // Protect route
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || !user) {
        navigate("/", { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Fetch stats on mount and periodically (when username is available)
  useEffect(() => {
    if (isAuthenticated && savedUsername) {
      fetchCSVStats();
      const interval = setInterval(fetchCSVStats, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, savedUsername]);

  useEffect(() => {
    const loadCredentials = () => {
      try {
        console.log("🔍 [Automation] Checking for saved credentials...");

        const savedData = localStorage.getItem("threads_credentials");
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed.username && parsed.password) {
              console.log("✅ [Automation] Credentials found in localStorage:", parsed.username);
              setCredentialsLoaded(true);
              setSavedUsername(parsed.username);
              setSavedPassword(parsed.password);
              setIsCheckingCredentials(false);
              return;
            }
          } catch (e) {
            console.error("❌ localStorage parse error:", e);
          }
        }

        const cookieUsername = Cookies.get("threads_username");
        const cookiePassword = Cookies.get("threads_password");
        if (cookieUsername && cookiePassword) {
          console.log("✅ [Automation] Credentials found in cookies:", cookieUsername);
          setCredentialsLoaded(true);
          setSavedUsername(cookieUsername);
          setSavedPassword(cookiePassword);
          setIsCheckingCredentials(false);
          return;
        }

        console.log("⚠️ [Automation] No credentials found");
        setCredentialsLoaded(false);
        setIsCheckingCredentials(false);
      } catch (error: any) {
        console.error("❌ Error:", error);
        setCredentialsLoaded(false);
        setIsCheckingCredentials(false);
      }
    };

    loadCredentials();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "threads_credentials") {
        console.log("🔄 Storage changed - reloading credentials");
        loadCredentials();
      }
    };

    const handleCredentialsUpdated = () => {
      console.log("🔄 Custom event - reloading credentials");
      loadCredentials();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("credentials-updated", handleCredentialsUpdated);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("credentials-updated", handleCredentialsUpdated);
    };
  }, []);

  const getCredentials = () => {
    if (savedUsername && savedPassword) {
      return { username: savedUsername, password: savedPassword };
    }
    try {
      const savedData = localStorage.getItem("threads_credentials");
      if (savedData) {
        const parsed = JSON.parse(savedData);
        return { username: parsed.username, password: parsed.password };
      }
    } catch (e) {
      console.error("Error:", e);
    }
    return null;
  };

  const addActivityLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const handleLikeCommentStart = async () => {
    const creds = getCredentials();
    if (!creds) {
      toast.error("❌ Credentials not found!");
      navigate("/dashboard");
      return;
    }

    setLikeCommentRunning(true);
    setShowLogs(true);
    addActivityLog("🤖 Starting automation bot...");
    const postsToProcess = parseInt(likeCommentSettings.postsToProcess) || 1;

    try {
      addActivityLog(
        `📊 Config: ${postsToProcess} posts, ${likeCommentSettings.likePercentage}% likes, ${likeCommentSettings.commentPercentage}% comments`
      );

      const response = await fetch("http://localhost:3000/api/automation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          posts_to_process: postsToProcess,
          like_percentage: parseInt(likeCommentSettings.likePercentage) || 0,
          comment_percentage: parseInt(likeCommentSettings.commentPercentage) || 0,
          reply_percentage: parseInt(likeCommentSettings.replyPercentage) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to start automation");
      }

      addActivityLog("✅ Bot started successfully!");
      addActivityLog(`🎯 Bot ID: ${data.botId}`);
      addActivityLog(`⚙️ Target: ${data.config?.posts_to_process || postsToProcess} posts`);

      toast.success("✅ Automation started! Check activity logs below.");
      setLikeCommentStats((prev) => ({
        ...prev,
        postsProcessed: prev.postsProcessed + postsToProcess,
      }));

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:3000/api/bots/active`);
          const statusData = await statusResponse.json();

          if (!statusResponse.ok) {
            throw new Error(statusData.message || "Failed to fetch bot status");
          }

          if (!statusData.bots || statusData.bots.length === 0) {
            clearInterval(pollInterval);
            setLikeCommentRunning(false);
            addActivityLog("🏁 Bot completed all tasks!");
            toast.success("✅ Automation completed!");
          } else {
            const bot = statusData.bots.find((b: any) => b.type === "automation");
            if (bot) {
              addActivityLog(`⏱️ Running for ${bot.runningFor}s...`);
            }
          }
        } catch (error) {
          console.error("Poll error:", error);
        }
      }, 5000);

      (window as any).__automationPollInterval = pollInterval;
    } catch (error: any) {
      addActivityLog(`❌ Error: ${error.message}`);
      toast.error("Error: " + error.message);
      setLikeCommentRunning(false);
    }
  };

  const handleLikeCommentStop = async () => {
    try {
      if ((window as any).__automationPollInterval) {
        clearInterval((window as any).__automationPollInterval);
      }

      const activeBots = await fetch("http://localhost:3000/api/bots/active");
      const data = await activeBots.json();

      const automationBot = data.bots?.find((b: any) => b.type === "automation");
      if (automationBot) {
        await fetch(`http://localhost:3000/api/bots/stop/${automationBot.id}`, {
          method: "POST",
        });
        addActivityLog("🛑 Bot stopped by user");
      }

      setLikeCommentRunning(false);
      toast.success("✅ Stopped!");
    } catch (error) {
      console.error("Stop error:", error);
      setLikeCommentRunning(false);
      toast.success("✅ Stopped!");
    }
  };

  useEffect(() => {
    return () => {
      if ((window as any).__automationPollInterval) {
        clearInterval((window as any).__automationPollInterval);
      }
    };
  }, []);

  const handleNotificationsStart = async () => {
    const creds = getCredentials();
    if (!creds) {
      toast.error("❌ Credentials not found!");
      navigate("/dashboard");
      return;
    }

    setNotificationsRunning(true);

    try {
      const response = await fetch("http://localhost:3000/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          checkInterval: notificationConfig.checkInterval,
          autoReply: notificationConfig.autoReply,
          replyTemplate: notificationConfig.replyTemplate,
        }),
      });

      if (!response.ok) throw new Error("Failed");
      toast.success("✅ Notifications started!");
    } catch (error: any) {
      toast.error("Error: " + error.message);
      setNotificationsRunning(false);
    }
  };

  const handleNotificationsStop = () => {
    setNotificationsRunning(false);
    toast.success("✅ Stopped!");
  };

  const handleSearchStart = async () => {
    if (!searchConfig.keyword.trim()) {
      toast.error("Please enter a keyword");
      return;
    }

    const creds = getCredentials();
    if (!creds) {
      toast.error("❌ Credentials not found!");
      navigate("/dashboard");
      return;
    }

    setSearchRunning(true);

    try {
      const response = await fetch("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          keyword: searchConfig.keyword,
          searchInterval: searchConfig.searchInterval,
          resultLimit: searchConfig.resultLimit,
          upvotePercentage: searchConfig.upvotePercentage || 0,
          commentPercentage: searchConfig.commentPercentage || 0,
          replyPercentage: searchConfig.replyPercentage || 0,
        }),
      });

      if (!response.ok) throw new Error("Failed");
      toast.success("✅ Search started!");
    } catch (error: any) {
      toast.error("Error: " + error.message);
      setSearchRunning(false);
    }
  };

  const handleSearchStop = () => {
    setSearchRunning(false);
    toast.success("✅ Stopped!");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("❌ Image must be less than 5MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setImageFile(file);
        toast.success("✅ Image uploaded!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImageFile(null);
  };

  const handleFlowImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("❌ Image must be less than 5MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFlowUploadedImage(reader.result as string);
        toast.success("✅ Image uploaded for Flow Bot!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratePost = async () => {
    if (!postTopic.trim() && !uploadedImage) {
      toast.error("Please enter a topic or upload an image");
      return;
    }

    setIsGeneratingPost(true);

    try {
      const requestBody: any = {
        topic: postTopic,
        options: generationOptions,
      };

      if (uploadedImage) {
        requestBody.image = uploadedImage;
      }

      const response = await fetch("http://localhost:3000/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setPostContent(data.post?.text || "Generated content");
      toast.success("✅ Post generated!");
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      toast.error("Please enter content");
      return;
    }

    const creds = getCredentials();
    if (!creds) {
      toast.error("❌ Credentials not found!");
      navigate("/dashboard");
      return;
    }

    setIsCreatingPost(true);

    try {
      const response = await fetch("http://localhost:3000/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          content: postContent,
          image: uploadedImage || null,
        }),
      });

      if (!response.ok) throw new Error("Failed");
      toast.success("✅ Post created!");
      setPostContent("");
      setPostTopic("");
      setUploadedImage(null);
      setPostStats((prev) => ({ ...prev, postsCreated: prev.postsCreated + 1 }));
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setIsCreatingPost(false);
    }
  };

  // Flow Bot Handlers
  const handleFlowStart = async () => {
    const creds = getCredentials();
    if (!creds) {
      toast.error("❌ Credentials not found!");
      navigate("/dashboard");
      return;
    }

    setFlowRunning(true);
    setShowLogs(true);
    addActivityLog("🌊 Starting Comprehensive Flow Bot...");

    try {
      const response = await fetch("http://localhost:3000/api/flow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          searchKeyword: flowConfig.searchKeyword,
          maxPosts: parseInt(flowConfig.maxPosts) || 30,
          likeProbability: (parseInt(flowConfig.likeProbability) || 40) / 100,
          commentProbability: (parseInt(flowConfig.commentProbability) || 15) / 100,
          replyProbability: (parseInt(flowConfig.replyProbability) || 15) / 100,
          notificationCheckInterval: parseInt(flowConfig.notificationCheckInterval) || 2,
          postScheduleTime: flowConfig.postScheduleTime || null,
          postTopic: flowConfig.postTopic || '',
          postImage: flowUploadedImage || null,
          durationMinutes: parseInt(flowConfig.durationMinutes) || 120,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to start Flow Bot");
      }

      addActivityLog("✅ Flow Bot started successfully!");
      addActivityLog(`🎯 Bot ID: ${data.botId}`);
      toast.success("✅ Comprehensive Flow Bot started!");

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:3000/api/bots/active`);
          const statusData = await statusResponse.json();

          if (!statusResponse.ok) {
            throw new Error(statusData.message || "Failed to fetch bot status");
          }

          if (!statusData.bots || statusData.bots.length === 0) {
            clearInterval(pollInterval);
            setFlowRunning(false);
            addActivityLog("🏁 Flow Bot completed all tasks!");
            toast.success("✅ Flow Bot completed!");
          } else {
            const bot = statusData.bots.find((b: any) => b.type === "comprehensive_flow");
            if (bot) {
              addActivityLog(`⏱️ Flow Bot running for ${bot.runningFor}s...`);
            }
          }
        } catch (error) {
          console.error("Poll error:", error);
        }
      }, 5000);

      (window as any).__flowPollInterval = pollInterval;
    } catch (error: any) {
      addActivityLog(`❌ Error: ${error.message}`);
      toast.error("Error: " + error.message);
      setFlowRunning(false);
    }
  };

  const handleFlowStop = async () => {
    try {
      if ((window as any).__flowPollInterval) {
        clearInterval((window as any).__flowPollInterval);
      }

      const activeBots = await fetch("http://localhost:3000/api/bots/active");
      const data = await activeBots.json();

      if (data.bots && data.bots.length > 0) {
        const flowBot = data.bots.find((b: any) => b.type === "comprehensive_flow");
        if (flowBot) {
          await fetch(`http://localhost:3000/api/bots/stop/${flowBot.id}`, {
            method: "POST",
          });
        }
      }

      setFlowRunning(false);
      addActivityLog("🛑 Flow Bot stopped");
      toast.info("Flow Bot stopped");
    } catch (error: any) {
      toast.error("Error stopping bot: " + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("threads_credentials");
    Cookies.remove("threads_username");
    Cookies.remove("threads_password");
    logout();
    navigate("/", { replace: true });
  };

  const handleDebug = () => {
    const creds = getCredentials();
    console.log("🔍 DEBUG:", {
      username: creds?.username || "❌ Not found",
      password: creds?.password ? "✅ Found" : "❌ Not found",
      credentialsLoaded,
    });
    toast.info("Check console");
  };

  if (loading || isCheckingCredentials) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B4FFF] mx-auto"></div>
          <div className="text-lg font-semibold text-slate-900 mb-2 mt-4">Loading...</div>
          <div className="text-sm text-slate-600">Checking credentials...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Automation</h1>
            <p className="text-slate-600">Manage all Threads automations</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDebug} variant="outline" size="sm">
              🔍 Debug
            </Button>
            <Button onClick={handleLogout} variant="destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {!credentialsLoaded ? (
          <Card className="p-4 bg-orange-50 border border-orange-300 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">⚠️ Credentials Not Loaded</h3>
                <p className="text-orange-800 text-sm my-2">Go to Dashboard and save credentials first.</p>
                <Button onClick={() => navigate("/dashboard")} className="bg-orange-600 hover:bg-orange-700">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 bg-green-50 border border-green-300 mb-6">
            <p className="text-green-700 font-medium">✅ Credentials loaded - Ready! ({savedUsername})</p>
          </Card>
        )}

        {/* CARD 1: LIKE COMMENT REPLY */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-6 h-6 text-[#5B4FFF]" />
              Like, Comment & Reply
            </h2>
            <Button
              onClick={likeCommentRunning ? handleLikeCommentStop : handleLikeCommentStart}
              className={likeCommentRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-[#5B4FFF] hover:bg-[#4A3FEE]"}
              disabled={!credentialsLoaded}
            >
              {likeCommentRunning ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block">Posts to Process</Label>
              <Input
                type="number"
                placeholder="10"
                value={likeCommentSettings.postsToProcess}
                onChange={(e) => setLikeCommentSettings({ ...likeCommentSettings, postsToProcess: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Like %</Label>
              <Input
                type="number"
                placeholder="50"
                value={likeCommentSettings.likePercentage}
                onChange={(e) => setLikeCommentSettings({ ...likeCommentSettings, likePercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Comment %</Label>
              <Input
                type="number"
                placeholder="30"
                value={likeCommentSettings.commentPercentage}
                onChange={(e) => setLikeCommentSettings({ ...likeCommentSettings, commentPercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Reply %</Label>
              <Input
                type="number"
                placeholder="20"
                value={likeCommentSettings.replyPercentage}
                onChange={(e) => setLikeCommentSettings({ ...likeCommentSettings, replyPercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Posts</p>
              <p className="text-xl font-bold">{likeCommentStats.postsProcessed}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Interactions</p>
              <p className="text-xl font-bold">{likeCommentStats.interactions}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Likes</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{likeCommentStats.likesSent}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Comments</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{likeCommentStats.commentsSent}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Replies</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{likeCommentStats.repliesSent}</p>
            </div>
          </div>
        </Card>

        {showLogs && (
          <Card className="p-4 bg-slate-50 border border-slate-200 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">📋 Activity Logs</h3>
              <Button onClick={() => setActivityLogs([])} variant="outline" size="sm">
                Clear
              </Button>
            </div>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-48 overflow-y-auto">
              {activityLogs.length === 0 ? (
                <div className="text-slate-500 text-center">No activity yet...</div>
              ) : (
                activityLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* CARD 2: NOTIFICATIONS */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-[#5B4FFF]" />
              Notification Checker
            </h2>
            <Button
              onClick={notificationsRunning ? handleNotificationsStop : handleNotificationsStart}
              className={notificationsRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-[#5B4FFF] hover:bg-[#4A3FEE]"}
              disabled={!credentialsLoaded}
            >
              {notificationsRunning ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block">Check Interval (hr)</Label>
              <Input
                type="number"
                placeholder="5"
                value={notificationConfig.checkInterval}
                onChange={(e) => setNotificationConfig({ ...notificationConfig, checkInterval: parseInt(e.target.value) })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Auto Reply</Label>
              <input
                type="checkbox"
                checked={notificationConfig.autoReply}
                onChange={(e) => setNotificationConfig({ ...notificationConfig, autoReply: e.target.checked })}
                className="w-4 h-4 mt-2 accent-[#5B4FFF]"
                disabled={!credentialsLoaded}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-700 mb-2 block">Reply Template</Label>
              <Textarea
                placeholder="Template..."
                value={notificationConfig.replyTemplate}
                onChange={(e) => setNotificationConfig({ ...notificationConfig, replyTemplate: e.target.value })}
                disabled={!credentialsLoaded}
                rows={2}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>
        </Card>

        {/* CARD 3: SEARCH BOT */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-6 h-6 text-[#5B4FFF]" />
              Search Bot
            </h2>
            <Button
              onClick={searchRunning ? handleSearchStop : handleSearchStart}
              className={searchRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-[#5B4FFF] hover:bg-[#4A3FEE]"}
              disabled={!credentialsLoaded}
            >
              {searchRunning ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block">Keyword</Label>
              <Input
                type="text"
                placeholder="Search term..."
                value={searchConfig.keyword}
                onChange={(e) => setSearchConfig({ ...searchConfig, keyword: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Interval (min)</Label>
              <Input
                type="number"
                placeholder="10"
                value={searchConfig.searchInterval}
                onChange={(e) => setSearchConfig({ ...searchConfig, searchInterval: parseInt(e.target.value) })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Result Limit</Label>
              <Input
                type="number"
                placeholder="50"
                value={searchConfig.resultLimit}
                onChange={(e) => setSearchConfig({ ...searchConfig, resultLimit: parseInt(e.target.value) })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block">Upvote %</Label>
              <Input
                type="number"
                placeholder="40"
                value={searchConfig.upvotePercentage}
                onChange={(e) => setSearchConfig({ ...searchConfig, upvotePercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Comment %</Label>
              <Input
                type="number"
                placeholder="30"
                value={searchConfig.commentPercentage}
                onChange={(e) => setSearchConfig({ ...searchConfig, commentPercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Reply %</Label>
              <Input
                type="number"
                placeholder="20"
                value={searchConfig.replyPercentage}
                onChange={(e) => setSearchConfig({ ...searchConfig, replyPercentage: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Posts</p>
              <p className="text-xl font-bold">{searchStats.postsProcessed}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Interactions</p>
              <p className="text-xl font-bold">{searchStats.interactions}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Likes</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{searchStats.likesSent}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Comments</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{searchStats.commentsSent}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Replies</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{searchStats.repliesSent}</p>
            </div>
          </div>
        </Card>

        {/* CARD 4: POST CREATOR */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#5B4FFF]" />
              Post Creator
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block">Topic or Image</Label>
              <Input
                type="text"
                placeholder="e.g., Technology, Web Development..."
                value={postTopic}
                onChange={(e) => setPostTopic(e.target.value)}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
              
              <div className="mt-3">
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-[#5B4FFF] transition-colors text-center">
                    {uploadedImage ? (
                      <div className="relative">
                        <img src={uploadedImage} alt="Upload preview" className="max-h-32 mx-auto rounded" />
                        <Button
                          onClick={handleRemoveImage}
                          size="sm"
                          variant="destructive"
                          className="absolute top-0 right-0 m-1"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Click to upload image</p>
                        <p className="text-xs text-slate-400">Max 5MB</p>
                      </div>
                    )}
                  </div>
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              
              <Button
                onClick={handleGeneratePost}
                disabled={isGeneratingPost || (!postTopic.trim() && !uploadedImage)}
                className="w-full mt-3 bg-[#5B4FFF] hover:bg-[#4A3FEE]"
              >
                {isGeneratingPost ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>

            <div>
              <Label className="text-slate-700 mb-2 block">Options</Label>
              <Select value={generationOptions.tone} onValueChange={(value) => setGenerationOptions({ ...generationOptions, tone: value })}>
                <SelectTrigger className="bg-slate-50 border border-slate-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]">
                  <SelectValue placeholder="Tone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>

              <Select value={generationOptions.length} onValueChange={(value) => setGenerationOptions({ ...generationOptions, length: value })}>
                <SelectTrigger className="bg-slate-50 border border-slate-200 mt-2 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]">
                  <SelectValue placeholder="Length..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <Label className="text-slate-700 mb-2 block">Content</Label>
            <Textarea
              placeholder="Generated content appears here..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              rows={4}
              className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
            />
          </div>

          <Button
            onClick={handleCreatePost}
            disabled={!postContent.trim() || isCreatingPost || !credentialsLoaded}
            className="w-full bg-[#5B4FFF] hover:bg-[#4A3FEE]"
          >
            {isCreatingPost ? (
              <>
                <Send className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Post
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Posts Created</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{postStats.postsCreated}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Scheduled</p>
              <p className="text-xl font-bold">{postStats.scheduled}</p>
            </div>
          </div>
        </Card>

        {/* CARD 5: COMPREHENSIVE FLOW BOT */}
        <Card className="p-6 bg-white border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Workflow className="w-6 h-6 text-[#5B4FFF]" />
              Comprehensive Flow Bot
            </h2>
            <Button
              onClick={flowRunning ? handleFlowStop : handleFlowStart}
              className={flowRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-[#5B4FFF] hover:bg-[#4A3FEE]"}
              disabled={!credentialsLoaded}
            >
              {flowRunning ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Flow
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-slate-700 font-medium">
              🌊 All-in-One Bot: Checks notifications every 2 hours → Searches posts → Likes, Comments & Replies → Creates scheduled posts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-slate-700 mb-2 block">Search Keyword</Label>
              <Input
                type="text"
                placeholder="e.g., AI, Tech, Marketing"
                value={flowConfig.searchKeyword}
                onChange={(e) => setFlowConfig({ ...flowConfig, searchKeyword: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Max Posts</Label>
              <Input
                type="number"
                placeholder="30"
                value={flowConfig.maxPosts}
                onChange={(e) => setFlowConfig({ ...flowConfig, maxPosts: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Duration (minutes)</Label>
              <Input
                type="number"
                placeholder="120"
                value={flowConfig.durationMinutes}
                onChange={(e) => setFlowConfig({ ...flowConfig, durationMinutes: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-slate-700 mb-2 block">Like %</Label>
              <Input
                type="number"
                placeholder="40"
                value={flowConfig.likeProbability}
                onChange={(e) => setFlowConfig({ ...flowConfig, likeProbability: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Comment %</Label>
              <Input
                type="number"
                placeholder="15"
                value={flowConfig.commentProbability}
                onChange={(e) => setFlowConfig({ ...flowConfig, commentProbability: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Reply %</Label>
              <Input
                type="number"
                placeholder="15"
                value={flowConfig.replyProbability}
                onChange={(e) => setFlowConfig({ ...flowConfig, replyProbability: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 mb-2 block flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Post Schedule Time (HH:MM)
              </Label>
              <Input
                type="time"
                value={flowConfig.postScheduleTime}
                onChange={(e) => setFlowConfig({ ...flowConfig, postScheduleTime: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Post Topic</Label>
              <Input
                type="text"
                placeholder="e.g., AI trends"
                value={flowConfig.postTopic}
                onChange={(e) => setFlowConfig({ ...flowConfig, postTopic: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
              
              <div className="mt-2">
                <Label htmlFor="flow-image-upload" className="cursor-pointer">
                  <div className="border border-dashed border-slate-300 rounded p-2 hover:border-[#5B4FFF] transition-colors text-center text-xs">
                    {flowUploadedImage ? (
                      <div className="flex items-center justify-between">
                        <span className="text-green-600">✓ Image attached</span>
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            setFlowUploadedImage(null);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-500">+ Add Image</span>
                    )}
                  </div>
                </Label>
                <Input
                  id="flow-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFlowImageUpload}
                  className="hidden"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block">Notification Check (hours)</Label>
              <Input
                type="number"
                placeholder="2"
                value={flowConfig.notificationCheckInterval}
                onChange={(e) => setFlowConfig({ ...flowConfig, notificationCheckInterval: e.target.value })}
                disabled={!credentialsLoaded}
                className="border-gray-200 focus:border-[#5B4FFF] focus:ring-[#5B4FFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Posts</p>
              <p className="text-xl font-bold">{flowStats.postsProcessed}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Likes</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{flowStats.likes}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Comments</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{flowStats.comments}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Replies</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{flowStats.replies}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 text-xs">Notifications</p>
              <p className="text-xl font-bold">{flowStats.notificationsFound}</p>
            </div>
            <div className="p-3 bg-[#F0EFFF] border border-[#D0CFFF] rounded-lg">
              <p className="text-slate-600 text-xs">Posts Created</p>
              <p className="text-xl font-bold text-[#5B4FFF]">{flowStats.postsCreated}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}