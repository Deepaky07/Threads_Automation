// import { useEffect, useState, useCallback } from "react";
// import { useAuth } from "@/contexts/AuthContext";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Slider } from "@/components/ui/slider";
// import { toast } from "sonner";
// import { Play, Square, Heart, MessageCircle, Reply } from "lucide-react";
// import Cookies from "js-cookie";

// const DEFAULT_SETTINGS = {
//   posts_to_process: 10,
//   like_percentage: 50,
//   comment_percentage: 30,
//   reply_percentage: 20,
// };

// const STORAGE_KEY = "automation_settings";

// function AutomationSettings() {
//   const { user, session } = useAuth();
//   const [settings, setSettings] = useState(DEFAULT_SETTINGS);
//   const [loading, setLoading] = useState(true);
//   const [isRunning, setIsRunning] = useState(false);
//   const [stats, setStats] = useState({
//     postsProcessed: 156,
//     interactions: 89,
//   });

//   const loadSettings = useCallback(async () => {
//     try {
//       setLoading(false);
//       const stored = localStorage.getItem(STORAGE_KEY);
//       if (stored) {
//         setSettings(JSON.parse(stored));
//       }
//     } catch (error: any) {
//       toast.error("Failed to load settings: " + error.message);
//     }
//   }, []);

//   useEffect(() => {
//     loadSettings();
//   }, [loadSettings]);

//   const startAutomation = async () => {
//     try {
//       // Get credentials from cookies
//       const username = Cookies.get("threads_username");
//       const password = Cookies.get("threads_password");

//       if (!username || !password) {
//         toast.error("Please save your Threads credentials in Dashboard first!");
//         return;
//       }

//       setIsRunning(true);

//       const payload = {
//         username,
//         password,
//         posts_to_process: settings.posts_to_process,
//         like_percentage: settings.like_percentage / 100,
//         comment_percentage: settings.comment_percentage / 100,
//         reply_percentage: settings.reply_percentage / 100,
//       };

//       console.log("Starting automation with payload:", payload);

//       const response = await fetch("http://localhost:3000/api/automation/start", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Automation started:", data);
//       toast.success("Automation started! Bot will scroll, like, comment, and reply on Threads.");
//     } catch (error: any) {
//       console.error("Error starting automation:", error);
//       setIsRunning(false);
//       toast.error("Failed to start automation: " + error.message);
//     }
//   };

//   const stopAutomation = () => {
//     setIsRunning(false);
//     toast.info("Automation stopped");
//   };

//   if (loading) {
//     return <div className="flex items-center justify-center h-screen">Loading...</div>;
//   }

//   return (
//     <div className="space-y-6">
//       <div>
//         <h2 className="text-3xl font-bold tracking-tight">Like, Comment & Reply</h2>
//         <p className="text-muted-foreground">
//           Automate liking, commenting, and replying on Threads
//         </p>
//       </div>

//       <div className="flex gap-8">
//         <div className="flex-1 space-y-6">
//           <Card className="p-6">
//             <h3 className="text-lg font-semibold mb-6">Configuration</h3>

//             <div className="space-y-6">
//               <div>
//                 <Label htmlFor="posts" className="text-sm font-medium">
//                   Number of Posts to Process *
//                 </Label>
//                 <Input
//                   id="posts"
//                   type="number"
//                   value={settings.posts_to_process}
//                   onChange={(e) =>
//                     setSettings({
//                       ...settings,
//                       posts_to_process: parseInt(e.target.value),
//                     })
//                   }
//                   min="1"
//                   max="100"
//                   className="mt-2"
//                 />
//                 <p className="text-xs text-muted-foreground mt-2">
//                   How many posts the automation will process per run
//                 </p>
//               </div>

//               <div className="border-t pt-6">
//                 <h4 className="font-medium mb-6 text-sm">Interaction Probabilities</h4>

//                 <div className="space-y-4">
//                   <div>
//                     <div className="flex items-center justify-between mb-3">
//                       <Label className="text-sm font-medium">Like %</Label>
//                       <span className="text-sm font-medium text-purple-600">
//                         {settings.like_percentage}%
//                       </span>
//                     </div>
//                     <Slider
//                       value={[settings.like_percentage]}
//                       onValueChange={(value) =>
//                         setSettings({
//                           ...settings,
//                           like_percentage: value[0],
//                         })
//                       }
//                       min={0}
//                       max={100}
//                       step={1}
//                       className="w-full"
//                     />
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Percentage of posts that will receive a like
//                     </p>
//                   </div>

//                   <div>
//                     <div className="flex items-center justify-between mb-3">
//                       <Label className="text-sm font-medium">Comment %</Label>
//                       <span className="text-sm font-medium text-purple-600">
//                         {settings.comment_percentage}%
//                       </span>
//                     </div>
//                     <Slider
//                       value={[settings.comment_percentage]}
//                       onValueChange={(value) =>
//                         setSettings({
//                           ...settings,
//                           comment_percentage: value[0],
//                         })
//                       }
//                       min={0}
//                       max={100}
//                       step={1}
//                       className="w-full"
//                     />
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Percentage of posts that will receive a comment
//                     </p>
//                   </div>

//                   <div>
//                     <div className="flex items-center justify-between mb-3">
//                       <Label className="text-sm font-medium">Reply %</Label>
//                       <span className="text-sm font-medium text-purple-600">
//                         {settings.reply_percentage}%
//                       </span>
//                     </div>
//                     <Slider
//                       value={[settings.reply_percentage]}
//                       onValueChange={(value) =>
//                         setSettings({
//                           ...settings,
//                           reply_percentage: value[0],
//                         })
//                       }
//                       min={0}
//                       max={100}
//                       step={1}
//                       className="w-full"
//                     />
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Percentage of comments that will receive a reply
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               <div className="flex gap-3 pt-4">
//                 {!isRunning ? (
//                   <>
//                     <Button
//                       onClick={startAutomation}
//                       className="bg-purple-600 hover:bg-purple-700 text-white"
//                     >
//                       <Play className="mr-2 h-4 w-4" />
//                       Start Bot
//                     </Button>
//                     <Button variant="outline" disabled>
//                       <Square className="mr-2 h-4 w-4" />
//                       Stop Bot
//                     </Button>
//                   </>
//                 ) : (
//                   <>
//                     <Button
//                       disabled
//                       className="bg-purple-600 hover:bg-purple-700 text-white"
//                     >
//                       <Play className="mr-2 h-4 w-4" />
//                       Start Bot
//                     </Button>
//                     <Button
//                       onClick={stopAutomation}
//                       variant="outline"
//                       className="text-gray-600"
//                     >
//                       <Square className="mr-2 h-4 w-4" />
//                       Stop Bot
//                     </Button>
//                   </>
//                 )}
//               </div>
//             </div>
//           </Card>
//         </div>

//         <div className="w-80">
//           <Card className="p-6 sticky top-6">
//             <h3 className="text-lg font-semibold mb-6">Status</h3>

//             <div className="space-y-4">
//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
//                 <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
//                 <span className={`text-sm font-medium ${isRunning ? 'text-green-600' : 'text-gray-600'}`}>
//                   {isRunning ? 'Running' : 'Stopped'}
//                 </span>
//               </div>

//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4">
//                 <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Posts Processed</p>
//                 <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.postsProcessed}</p>
//               </div>

//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4">
//                 <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Interactions</p>
//                 <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.interactions}</p>
//               </div>

//               <div className="border-t pt-6 mt-6 space-y-3">
//                 <div className="flex items-center gap-3">
//                   <Heart className="h-5 w-5 text-red-500" />
//                   <div>
//                     <p className="text-xs text-gray-600 dark:text-gray-400">Likes Sent</p>
//                     <p className="font-semibold">42</p>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <MessageCircle className="h-5 w-5 text-blue-500" />
//                   <div>
//                     <p className="text-xs text-gray-600 dark:text-gray-400">Comments Sent</p>
//                     <p className="font-semibold">28</p>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <Reply className="h-5 w-5 text-green-500" />
//                   <div>
//                     <p className="text-xs text-gray-600 dark:text-gray-400">Replies Sent</p>
//                     <p className="font-semibold">19</p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default AutomationSettings;
