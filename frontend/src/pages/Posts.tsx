// import { Card } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { useState } from "react";
// import { toast } from "sonner";
// import { Send, FileText, Sparkles, Wand2, Clock } from "lucide-react";
// import Cookies from "js-cookie";

// export default function Posts() {
//   const [content, setContent] = useState("");
//   const [topic, setTopic] = useState("");
//   const [isGenerating, setIsGenerating] = useState(false);
//   const [isCreating, setIsCreating] = useState(false);
//   const [generatedPost, setGeneratedPost] = useState(null);
//   const [generationOptions, setGenerationOptions] = useState({
//     tone: "casual",
//     length: "medium",
//     includeQuestion: true,
//     includeEmojis: true,
//   });

//   const handleGeneratePost = async () => {
//     if (!topic.trim()) {
//       toast.error("Please enter a topic");
//       return;
//     }

//     try {
//       setIsGenerating(true);

//       const response = await fetch("http://localhost:3000/api/posts/generate", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           topic: topic.trim(),
//           options: generationOptions,
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(
//           errorData.message || `HTTP error! status: ${response.status}`
//         );
//       }

//       const data = await response.json();
//       setGeneratedPost(data.post);
//       setContent(data.post.text);
//       toast.success("Post generated successfully!");
//     } catch (error) {
//       console.error("Error:", error);
//       toast.error("Failed to generate post: " + error.message);
//     } finally {
//       setIsGenerating(false);
//     }
//   };

//   const handleCreatePost = async () => {
//     if (!content.trim()) {
//       toast.error("Please enter post content");
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
//       setIsCreating(true);

//       const response = await fetch("http://localhost:3000/api/posts/create", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           username,
//           password,
//           content: content.trim(),
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(
//           errorData.message || `HTTP error! status: ${response.status}`
//         );
//       }

//       const data = await response.json();
//       console.log("Success:", data);
//       toast.success("Post created successfully on Threads!");
//       setContent("");
//       setGeneratedPost(null);
//     } catch (error) {
//       console.error("Error:", error);
//       toast.error("Failed to create post: " + error.message);
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       <div>
//         <h2 className="text-3xl font-bold tracking-tight">Posts</h2>
//         <p className="text-muted-foreground">
//           Create and schedule automated posts to Threads
//         </p>
//       </div>

//       <div className="grid gap-6 lg:grid-cols-3">
//         {/* Main Content Area */}
//         <div className="lg:col-span-2 space-y-6">
//           {/* Generate Section */}
//           <Card className="p-6">
//             <h3 className="text-lg font-semibold mb-4">Generate Post</h3>

//             <div className="space-y-4">
//               <div>
//                 <Label htmlFor="topic" className="text-sm font-medium">
//                   Topic *
//                 </Label>
//                 <Input
//                   id="topic"
//                   type="text"
//                   placeholder="e.g., AI, Technology, Marketing"
//                   value={topic}
//                   onChange={(e) => setTopic(e.target.value)}
//                   className="mt-2"
//                 />
//               </div>

//               <div className="grid gap-4 md:grid-cols-2">
//                 <div>
//                   <Label htmlFor="tone" className="text-sm font-medium">
//                     Tone
//                   </Label>
//                   <Select
//                     value={generationOptions.tone}
//                     onValueChange={(value) =>
//                       setGenerationOptions({
//                         ...generationOptions,
//                         tone: value,
//                       })
//                     }
//                   >
//                     <SelectTrigger className="mt-2">
//                       <SelectValue />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="casual">Casual</SelectItem>
//                       <SelectItem value="formal">Formal</SelectItem>
//                       <SelectItem value="humorous">Humorous</SelectItem>
//                       <SelectItem value="inspirational">
//                         Inspirational
//                       </SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div>
//                   <Label htmlFor="length" className="text-sm font-medium">
//                     Length
//                   </Label>
//                   <Select
//                     value={generationOptions.length}
//                     onValueChange={(value) =>
//                       setGenerationOptions({
//                         ...generationOptions,
//                         length: value,
//                       })
//                     }
//                   >
//                     <SelectTrigger className="mt-2">
//                       <SelectValue />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="short">Short</SelectItem>
//                       <SelectItem value="medium">Medium</SelectItem>
//                       <SelectItem value="long">Long</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>
//               </div>

//               <div className="flex items-center gap-3">
//                 <input
//                   type="checkbox"
//                   id="question"
//                   checked={generationOptions.includeQuestion}
//                   onChange={(e) =>
//                     setGenerationOptions({
//                       ...generationOptions,
//                       includeQuestion: e.target.checked,
//                     })
//                   }
//                   className="rounded w-4 h-4"
//                 />
//                 <label
//                   htmlFor="question"
//                   className="text-sm font-medium cursor-pointer"
//                 >
//                   Include engaging question
//                 </label>
//               </div>

//               <div className="flex items-center gap-3">
//                 <input
//                   type="checkbox"
//                   id="emojis"
//                   checked={generationOptions.includeEmojis}
//                   onChange={(e) =>
//                     setGenerationOptions({
//                       ...generationOptions,
//                       includeEmojis: e.target.checked,
//                     })
//                   }
//                   className="rounded w-4 h-4"
//                 />
//                 <label
//                   htmlFor="emojis"
//                   className="text-sm font-medium cursor-pointer"
//                 >
//                   Include emojis
//                 </label>
//               </div>

//               <Button
//                 onClick={handleGeneratePost}
//                 disabled={isGenerating}
//                 className="w-full bg-purple-600 hover:bg-purple-700"
//               >
//                 <Sparkles className="mr-2 h-4 w-4" />
//                 {isGenerating ? "Generating..." : "Generate Post"}
//               </Button>
//             </div>
//           </Card>

//           {/* Generated Post Display */}
//           {generatedPost && (
//             <Card className="p-6 bg-blue-50 dark:bg-blue-950">
//               <h3 className="text-lg font-semibold mb-4">Generated Post</h3>

//               <div className="space-y-4">
//                 <div>
//                   <p className="text-sm text-muted-foreground mb-2">Content:</p>
//                   <p className="text-sm p-3 bg-white dark:bg-slate-800 rounded">
//                     {generatedPost.text}
//                   </p>
//                   <p className="text-xs text-muted-foreground mt-2">
//                     {generatedPost.characterCount} / 500 characters
//                   </p>
//                 </div>

//                 {generatedPost.hashtags && (
//                   <div>
//                     <p className="text-sm text-muted-foreground mb-2">
//                       Generated Hashtags:
//                     </p>
//                     <div className="flex flex-wrap gap-2">
//                       {generatedPost.hashtags.map((tag, index) => (
//                         <span
//                           key={index}
//                           className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-full text-xs"
//                         >
//                           {tag}
//                         </span>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </Card>
//           )}

//           {/* Content Editor */}
//           <Card className="p-6">
//             <h3 className="text-lg font-semibold mb-4">Edit Content</h3>

//             <div className="space-y-4">
//               <div>
//                 <Label htmlFor="content" className="text-sm font-medium">
//                   Post Content *
//                 </Label>
//                 <Textarea
//                   id="content"
//                   placeholder="Enter your post content here..."
//                   value={content}
//                   onChange={(e) => setContent(e.target.value)}
//                   rows={6}
//                   maxLength={500}
//                   className="mt-2"
//                 />
//                 <p className="text-xs text-muted-foreground mt-2">
//                   {content.length} / 500 characters
//                 </p>
//               </div>

//               <Button
//                 onClick={handleCreatePost}
//                 disabled={isCreating}
//                 className="w-full bg-green-600 hover:bg-green-700"
//               >
//                 <Send className="mr-2 h-4 w-4" />
//                 {isCreating ? "Creating..." : "Create Post on Threads"}
//               </Button>
//             </div>
//           </Card>
//         </div>

//         {/* Sidebar Stats */}
//         <div className="space-y-4">
//           <Card className="p-6">
//             <div className="space-y-4">
//               <div>
//                 <p className="text-sm text-muted-foreground mb-1">Total Posts</p>
//                 <p className="text-3xl font-bold">156</p>
//               </div>

//               <div className="border-t pt-4">
//                 <p className="text-sm text-muted-foreground mb-1">Scheduled</p>
//                 <p className="text-2xl font-bold">8</p>
//               </div>

//               <div className="border-t pt-4">
//                 <p className="text-sm text-muted-foreground mb-1">
//                   Avg. Engagement
//                 </p>
//                 <p className="text-2xl font-bold">94%</p>
//               </div>

//               <div className="border-t pt-4">
//                 <p className="text-sm text-muted-foreground mb-1">
//                   This Week
//                 </p>
//                 <p className="text-2xl font-bold">23</p>
//               </div>
//             </div>
//           </Card>

//           <Card className="p-6">
//             <h3 className="text-sm font-semibold mb-3">💡 Tips</h3>
//             <ul className="text-xs space-y-2 text-muted-foreground">
//               <li>✓ Add credentials in Dashboard first</li>
//               <li>✓ Keep posts under 500 characters</li>
//               <li>✓ Use questions to boost engagement</li>
//               <li>✓ Include relevant hashtags</li>
//               <li>✓ Post consistently for best results</li>
//             </ul>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }
