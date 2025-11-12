// import { Card } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { useState } from "react";
// import { toast } from "sonner";
// import { Play, Square } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";
// import Cookies from "js-cookie";

// export default function SearchBot() {
//   const { session } = useAuth();
//   const [isRunning, setIsRunning] = useState(false);
//   const [stats, setStats] = useState({
//     threadsFound: 234,
//     interactions: 156,
//   });
//   const [config, setConfig] = useState({
//     searchQuery: "",
//     numPosts: 10,
//     searchDurationMinutes: 30,
//     likeProbability: 50,
//     commentProbability: 30,
//     replyProbability: 20,
//   });

//   const handleStart = async () => {
//     // Validate search query
//     if (!config.searchQuery) {
//       toast.error("Please enter a search query");
//       return;
//     }

//     // Get credentials from cookies
//     const username = Cookies.get("threads_username");
//     const password = Cookies.get("threads_password");

//     if (!username || !password) {
//       toast.error("Please save your Threads credentials in Dashboard first!");
//       return;
//     }

//     try {
//       setIsRunning(true);

//       const payload = {
//         username,
//         password,
//         searchQuery: config.searchQuery,
//         numPosts: config.numPosts,
//         searchDurationMinutes: config.searchDurationMinutes,
//         likeProbability: config.likeProbability / 100, // Convert to decimal
//         commentProbability: config.commentProbability / 100,
//         replyProbability: config.replyProbability / 100,
//       };

//       console.log("Starting search bot with payload:", payload);

//       const response = await fetch("http://localhost:3000/api/search/interact", {
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

//       toast.success("Search and interact bot started successfully!");
//     } catch (error: any) {
//       console.error("Error:", error);
//       setIsRunning(false);
//       toast.error("Failed to start search bot: " + error.message);
//     }
//   };

//   const handleStop = () => {
//     setIsRunning(false);
//     toast.info("Search bot stopped");
//   };

//   return (
//     <div className="space-y-6">
//       <div>
//         <h2 className="text-3xl font-bold tracking-tight">Search Bot</h2>
//         <p className="text-muted-foreground">
//           Automate searching and engaging with threads based on keywords
//         </p>
//       </div>

//       {/* Main Layout */}
//       <div className="flex gap-8">
//         {/* Left - Configuration */}
//         <div className="flex-1 space-y-6">
//           <Card className="p-6">
//             <h3 className="text-lg font-semibold mb-6">Configuration</h3>

//             <div className="space-y-6">
//               {/* Search Query */}
//               <div>
//                 <Label htmlFor="searchQuery" className="text-sm font-medium">
//                   Search Query *
//                 </Label>
//                 <Input
//                   id="searchQuery"
//                   type="text"
//                   placeholder="AI, technology, automation"
//                   value={config.searchQuery}
//                   onChange={(e) =>
//                     setConfig({ ...config, searchQuery: e.target.value })
//                   }
//                   className="mt-2"
//                 />
//                 <p className="text-xs text-muted-foreground mt-2">
//                   Keywords to search for on Threads
//                 </p>
//               </div>

//               {/* Number of Posts and Duration */}
//               <div className="grid gap-4 md:grid-cols-2">
//                 <div>
//                   <Label htmlFor="numPosts" className="text-sm font-medium">
//                     Number of Posts to Process
//                   </Label>
//                   <Input
//                     id="numPosts"
//                     type="number"
//                     value={config.numPosts}
//                     onChange={(e) =>
//                       setConfig({ ...config, numPosts: parseInt(e.target.value) })
//                     }
//                     min="1"
//                     max="100"
//                     className="mt-2"
//                   />
//                 </div>

//                 <div>
//                   <Label htmlFor="duration" className="text-sm font-medium">
//                     Search Duration (minutes)
//                   </Label>
//                   <Input
//                     id="duration"
//                     type="number"
//                     value={config.searchDurationMinutes}
//                     onChange={(e) =>
//                       setConfig({
//                         ...config,
//                         searchDurationMinutes: parseInt(e.target.value),
//                       })
//                     }
//                     min="1"
//                     max="180"
//                     className="mt-2"
//                   />
//                 </div>
//               </div>

//               {/* Interaction Probabilities */}
//               <div className="border-t pt-6">
//                 <h4 className="font-medium mb-6 text-sm">Interaction Probabilities</h4>

//                 <div className="grid gap-4 md:grid-cols-3">
//                   <div>
//                     <Label htmlFor="like" className="text-sm font-medium">
//                       Like %
//                     </Label>
//                     <Input
//                       id="like"
//                       type="number"
//                       value={config.likeProbability}
//                       onChange={(e) =>
//                         setConfig({
//                           ...config,
//                           likeProbability: parseInt(e.target.value),
//                         })
//                       }
//                       min="0"
//                       max="100"
//                       className="mt-2"
//                     />
//                   </div>

//                   <div>
//                     <Label htmlFor="comment" className="text-sm font-medium">
//                       Comment %
//                     </Label>
//                     <Input
//                       id="comment"
//                       type="number"
//                       value={config.commentProbability}
//                       onChange={(e) =>
//                         setConfig({
//                           ...config,
//                           commentProbability: parseInt(e.target.value),
//                         })
//                       }
//                       min="0"
//                       max="100"
//                       className="mt-2"
//                     />
//                   </div>

//                   <div>
//                     <Label htmlFor="reply" className="text-sm font-medium">
//                       Reply %
//                     </Label>
//                     <Input
//                       id="reply"
//                       type="number"
//                       value={config.replyProbability}
//                       onChange={(e) =>
//                         setConfig({
//                           ...config,
//                           replyProbability: parseInt(e.target.value),
//                         })
//                       }
//                       min="0"
//                       max="100"
//                       className="mt-2"
//                     />
//                   </div>
//                 </div>
//               </div>

//               {/* Action Buttons */}
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
//                       onClick={handleStop}
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
