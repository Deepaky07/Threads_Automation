// import { Card } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { useState } from "react";
// import { toast } from "sonner";
// import { Play, Square, Bell, CheckCircle } from "lucide-react";
// import Cookies from "js-cookie";

// export default function Notifications() {
//   const [isRunning, setIsRunning] = useState(false);
//   const [stats, setStats] = useState({
//     threadsFound: 234,
//     interactions: 156,
//   });
//   const [config, setConfig] = useState({
//     checkInterval: 5,
//     autoReply: true,
//     replyTemplate: "Thank you for your engagement!",
//   });

//   const handleStart = async () => {
//     try {
//       // Get credentials from cookies
//       const username = Cookies.get("threads_username");
//       const password = Cookies.get("threads_password");

//       if (!username || !password) {
//         toast.error("Please save your Threads credentials in Dashboard first!");
//         return;
//       }

//       setIsRunning(true);
//       toast.success("Notification checker started");

//       const payload = {
//         username,
//         password,
//         checkInterval: config.checkInterval,
//         autoReply: config.autoReply,
//         replyTemplate: config.replyTemplate,
//       };

//       const response = await fetch("http://localhost:3000/api/notifications", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Success:", data);

//       // Update stats
//       setStats({
//         threadsFound: (data.checked || 0) + stats.threadsFound,
//         interactions: (data.replied || 0) + stats.interactions,
//       });

//       toast.success(`Checked ${data.checked || 0} notifications`);
//     } catch (error: any) {
//       console.error("Error:", error);
//       setIsRunning(false);
//       toast.error("Failed to start notification checker: " + error.message);
//     }
//   };

//   const handleCheckOnce = async () => {
//     try {
//       // Get credentials from cookies
//       const username = Cookies.get("threads_username");
//       const password = Cookies.get("threads_password");

//       if (!username || !password) {
//         toast.error("Please save your Threads credentials in Dashboard first!");
//         return;
//       }

//       toast.info("Checking notifications...");

//       const payload = {
//         username,
//         password,
//         shouldReply: config.autoReply,
//         replyTemplate: config.replyTemplate,
//       };

//       const response = await fetch("http://localhost:3000/api/notifications/check", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Notification check results:", data);

//       // Update stats
//       setStats({
//         threadsFound: stats.threadsFound + (data.results?.checked || 0),
//         interactions: stats.interactions + (data.results?.replied || 0),
//       });

//       toast.success(
//         `Checked ${data.results?.checked || 0} notifications, replied to ${data.results?.replied || 0}`
//       );
//     } catch (error: any) {
//       console.error("Error:", error);
//       toast.error("Failed to check notifications: " + error.message);
//     }
//   };

//   const handleStop = () => {
//     setIsRunning(false);
//     toast.info("Notification checker stopped");
//   };

//   return (
//     <div className="space-y-6">
//       <div>
//         <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
//         <p className="text-muted-foreground">
//           Monitor and respond to notifications automatically
//         </p>
//       </div>

//       {/* Main Layout */}
//       <div className="flex gap-8">
//         {/* Left - Configuration */}
//         <div className="flex-1 space-y-6">
//           <Card className="p-6">
//             <h3 className="text-lg font-semibold mb-6">Configuration</h3>

//             <div className="space-y-6">
//               <div>
//                 <Label htmlFor="checkInterval" className="text-sm font-medium">
//                   Check Interval (minutes) *
//                 </Label>
//                 <Input
//                   id="checkInterval"
//                   type="number"
//                   value={config.checkInterval}
//                   onChange={(e) =>
//                     setConfig({ ...config, checkInterval: parseInt(e.target.value) })
//                   }
//                   min="1"
//                   className="mt-2"
//                 />
//               </div>

//               <div className="border-t pt-6">
//                 <div className="flex items-center gap-3 mb-4">
//                   <input
//                     type="checkbox"
//                     id="autoReply"
//                     checked={config.autoReply}
//                     onChange={(e) =>
//                       setConfig({ ...config, autoReply: e.target.checked })
//                     }
//                     className="rounded w-4 h-4 cursor-pointer"
//                   />
//                   <Label htmlFor="autoReply" className="text-sm font-medium cursor-pointer">
//                     Enable Auto-Reply
//                   </Label>
//                 </div>

//                 {config.autoReply && (
//                   <div>
//                     <Label htmlFor="replyTemplate" className="text-sm font-medium">
//                       Reply Template
//                     </Label>
//                     <Textarea
//                       id="replyTemplate"
//                       value={config.replyTemplate}
//                       onChange={(e) =>
//                         setConfig({ ...config, replyTemplate: e.target.value })
//                       }
//                       placeholder="Enter your reply template..."
//                       rows={3}
//                       className="mt-2"
//                     />
//                   </div>
//                 )}
//               </div>

//               <div className="flex gap-3 pt-4">
//                 {!isRunning ? (
//                   <>
//                     <Button
//                       onClick={handleStart}
//                       className="bg-purple-600 hover:bg-purple-700 text-white"
//                     >
//                       <Play className="mr-2 h-4 w-4" />
//                       Start Bot
//                     </Button>
//                     <Button onClick={handleCheckOnce} variant="outline">
//                       Check Once
//                     </Button>
//                   </>
//                 ) : (
//                   <Button
//                     onClick={handleStop}
//                     variant="outline"
//                     className="text-gray-600"
//                   >
//                     <Square className="mr-2 h-4 w-4" />
//                     Stop Bot
//                   </Button>
//                 )}
//               </div>
//             </div>
//           </Card>
//         </div>

//         {/* Right - Status Sidebar */}
//         <div className="w-80">
//           <Card className="p-6 sticky top-6">
//             <h3 className="text-lg font-semibold mb-6">Status</h3>

//             <div className="space-y-4">
//               {/* Status Row */}
//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
//                 <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
//                 <span className={`text-sm font-medium ${isRunning ? 'text-green-600' : 'text-gray-600'}`}>
//                   {isRunning ? 'Running' : 'Stopped'}
//                 </span>
//               </div>

//               {/* Threads Found */}
//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4">
//                 <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Threads Found</p>
//                 <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.threadsFound}</p>
//               </div>

//               {/* Interactions */}
//               <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4">
//                 <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Interactions</p>
//                 <p className="text-4xl font-bold text-gray-900 dark:text-white">{stats.interactions}</p>
//               </div>
//             </div>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }
