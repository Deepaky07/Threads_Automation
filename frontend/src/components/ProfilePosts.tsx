import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Heart, 
  MessageCircle, 
  Share2,
  Calendar,
  ExternalLink,
  AlertCircle,
  Eye,
  Repeat2,
  ThumbsUp
} from "lucide-react";
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Post {
  index: number;
  username: string;
  postContent: string;
  timestamp: string;
  postLink: string;
  postId: string;
  mediaUrls: string[];
  likes: string;
  replies: string;
  reposts?: string;
  shares?: string;
  insights?: {
    views: string;
    totalInteractions: string;
    likes: string;
    quotes: string;
    replies: string;
    reposts: string;
    profileFollows: string;
  };
}

export default function ProfilePosts() {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [hasFetched, setHasFetched] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [fetchingInsights, setFetchingInsights] = useState<Record<number, boolean>>({});
  const [insightsFetched, setInsightsFetched] = useState(false);

  // Load username from localStorage
  useEffect(() => {
    const loadUsername = () => {
      try {
        const savedData = localStorage.getItem('threads_credentials');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.username) {
            setCurrentUsername(parsed.username);
          }
        }
      } catch (error) {
        console.error('Error loading credentials:', error);
      }
    };

    loadUsername();
    window.addEventListener('storage', loadUsername);
    window.addEventListener('credentials-updated', loadUsername);

    return () => {
      window.removeEventListener('storage', loadUsername);
      window.removeEventListener('credentials-updated', loadUsername);
    };
  }, []);

  const fetchPosts = async (shouldFetchInsights = false) => {
    if (!currentUsername) {
      setError('Username not found. Please set your credentials first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get password from localStorage
      const savedData = localStorage.getItem('threads_credentials');
      let password = '';
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        password = parsed.password || '';
      }

      if (!password) {
        setError('Password not found. Please set your credentials first.');
        setLoading(false);
        return;
      }

      console.log(`📄 Fetching posts - shouldFetchInsights: ${shouldFetchInsights}`);
      
      const response = await axios.post(
        `${API_URL}/api/profile/posts`,
        {
          username: currentUsername,
          password: password,
          fetchInsights: shouldFetchInsights, // CRITICAL: This determines if insights are fetched
          maxInsightsPosts: 20
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: shouldFetchInsights ? 300000 : 30000, // 5 min with insights, 30s without
        }
      );

      if (response.data.success && response.data.data) {
        const postsData = response.data.data;
        console.log('📊 Posts received:', postsData.length);
        console.log('📊 Fetched insights:', response.data.fetchedInsights);
        
        // Log insights for first few posts
        postsData.slice(0, 3).forEach((post: Post, index: number) => {
          if (post.insights) {
            console.log(`📊 Post ${index + 1} insights:`, {
              views: post.insights.views,
              likes: post.insights.likes,
              replies: post.insights.replies,
              reposts: post.insights.reposts
            });
          } else {
            console.log(`⚠️ Post ${index + 1} has no insights`);
          }
        });
        
        setPosts(postsData);
        setHasFetched(true);
        setIsFromCache(false);
        setInsightsFetched(shouldFetchInsights && response.data.fetchedInsights);
        
        // Save to localStorage for persistence (only if insights were fetched)
        if (shouldFetchInsights) {
          try {
            const cacheKey = `profile_posts_${currentUsername}`;
            const cacheData = {
              posts: response.data.data,
              cacheTime: Date.now(),
              username: currentUsername,
              hasInsights: true
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`💾 Saved ${response.data.data.length} posts with insights to cache`);
          } catch (e) {
            console.error('Error saving posts to cache:', e);
          }
        }
        
        console.log(`✅ Loaded ${response.data.data.length} posts`);
      } else {
        setError('No posts found or failed to fetch posts');
        setHasFetched(true);
        setIsFromCache(false);
      }
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      setError(
        error.response?.data?.error || 
        error.message || 
        'Failed to fetch posts. Please try again.'
      );
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle username changes - clear old cache and load new one
  useEffect(() => {
    if (currentUsername) {
      // Check if we have cached posts for this username
      const cacheKey = `profile_posts_${currentUsername}`;
      const cachedPosts = localStorage.getItem(cacheKey);
      
      if (cachedPosts) {
        try {
          const parsedPosts = JSON.parse(cachedPosts);
          const cacheTime = parsedPosts.cacheTime || 0;
          const oneHour = 60 * 60 * 1000;
          
          if (Date.now() - cacheTime < oneHour && parsedPosts.posts) {
            // Load from cache
            setPosts(parsedPosts.posts);
            setHasFetched(true);
            setIsFromCache(true);
            setInsightsFetched(parsedPosts.hasInsights || false);
            console.log(`✅ Loaded ${parsedPosts.posts.length} cached posts for @${currentUsername} (hasInsights: ${parsedPosts.hasInsights})`);
          } else {
            // Cache expired
            localStorage.removeItem(cacheKey);
            setHasFetched(false);
            setIsFromCache(false);
            setInsightsFetched(false);
          }
        } catch (e) {
          console.error('Error loading cached posts:', e);
          setHasFetched(false);
          setIsFromCache(false);
          setInsightsFetched(false);
        }
      } else {
        // No cache, reset state
        setHasFetched(false);
        setIsFromCache(false);
        setInsightsFetched(false);
      }
    }
  }, [currentUsername]);

  useEffect(() => {
    // Auto-fetch posts WITH insights when username is available
    if (currentUsername && !hasFetched && !loading && posts.length === 0) {
      console.log('🔄 Auto-fetching posts with insights on initial load');
      fetchPosts(true); // ✅ Always fetch insights on initial load
    }
  }, [currentUsername, hasFetched, posts.length]);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      // Try parsing ISO datetime
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Otherwise return as-is (e.g., "39m", "3d")
      return timestamp;
    } catch {
      return timestamp;
    }
  };

  const getPostUrl = (postLink: string, postId: string) => {
    if (postLink) {
      return postLink.startsWith('http') ? postLink : `https://www.threads.net${postLink}`;
    }
    if (postId && currentUsername) {
      return `https://www.threads.net/@${currentUsername}/post/${postId}`;
    }
    return '#';
  };

  const fetchPostInsights = async (postIndex: number, post: Post) => {
    if (!currentUsername || (!post.postId && !post.postLink)) {
      return;
    }

    // Don't fetch if already fetching or if insights already exist
    if (fetchingInsights[postIndex] || post.insights) {
      return;
    }

    setFetchingInsights(prev => ({ ...prev, [postIndex]: true }));

    try {
      const savedData = localStorage.getItem('threads_credentials');
      let password = '';
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        password = parsed.password || '';
      }

      if (!password) {
        setError('Password not found. Please set your credentials first.');
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/profile/post-insights`,
        {
          username: currentUsername,
          password: password,
          postId: post.postId,
          postLink: post.postLink
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 1 minute timeout
        }
      );

      if (response.data.success && response.data.insights) {
        console.log('✅ Insights fetched successfully:', response.data.insights);
        // Update the post with new insights
        setPosts(prevPosts => {
          const updated = [...prevPosts];
          updated[postIndex] = {
            ...updated[postIndex],
            insights: response.data.insights
          };
          return updated;
        });
      } else {
        console.warn('⚠️ No insights data in response:', response.data);
      }
    } catch (error: any) {
      console.error('❌ Error fetching post insights:', error);
      if (error.response) {
        console.error('Response error:', error.response.data);
      }
      setError(error.response?.data?.error || 'Failed to fetch insights. Please try again.');
    } finally {
      setFetchingInsights(prev => ({ ...prev, [postIndex]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Posts</CardTitle>
              <CardDescription>
                View all your posts from your Threads profile with engagement metrics
                {currentUsername && (
                  <span className="ml-2 font-semibold text-primary">@{currentUsername}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isFromCache && posts.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {insightsFetched ? 'Cached with Insights' : 'Cached'}
                </Badge>
              )}
              {insightsFetched && (
                <Badge variant="default" className="text-xs bg-green-500">
                  Insights Loaded
                </Badge>
              )}
              <Button 
                onClick={() => {
                  console.log('🔄 Refresh Posts button clicked - will fetch insights');
                  // Clear cache and fetch fresh data WITH insights
                  if (currentUsername) {
                    const cacheKey = `profile_posts_${currentUsername}`;
                    localStorage.removeItem(cacheKey);
                  }
                  setHasFetched(false);
                  setPosts([]);
                  setIsFromCache(false);
                  setInsightsFetched(false);
                  fetchPosts(true); // Always fetch insights on manual refresh
                }} 
                disabled={loading || !currentUsername}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading Insights...' : 'Refresh Posts'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!currentUsername && (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Please set your Threads credentials first to view your posts.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Fetching posts with engagement metrics...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 1-2 minutes to extract metrics from profile page
                </p>
              </div>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Found <span className="font-semibold text-foreground">{posts.length}</span> posts
                  {insightsFetched && (
                    <span className="ml-2 text-green-600 font-medium">✓ with engagement metrics</span>
                  )}
                </p>
              </div>

              <div className="grid gap-4">
                {posts.map((post, index) => {
                  const postUrl = getPostUrl(post.postLink, post.postId);
                  const isClickable = postUrl !== '#';
                  
                  // Use insights if available, otherwise fall back to direct metrics
                  const likes = post.insights?.likes || post.likes || '0';
                  const replies = post.insights?.replies || post.replies || '0';
                  const reposts = post.insights?.reposts || post.reposts || '0';
                  const shares = post.insights?.shares || post.shares || '0';
                  
                  return (
                    <Card 
                      key={post.postId || index} 
                      className={`hover:shadow-md transition-shadow ${isClickable ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (isClickable) {
                          window.open(postUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                {post.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">@{post.username}</p>
                                {post.timestamp && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatTimestamp(post.timestamp)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {post.postLink && (
                              <a
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>

                          {/* Post Content */}
                          {post.postContent && (
                            <div className="prose prose-sm max-w-none">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {post.postContent}
                              </p>
                            </div>
                          )}

                          {/* Engagement Metrics - Threads Style */}
                          <div className="flex items-center gap-2 pt-3 border-t mt-3">
                            {/* Like */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!insightsFetched && (post.postId || post.postLink) && !fetchingInsights[index]) {
                                  fetchPostInsights(index, post);
                                }
                              }}
                              disabled={fetchingInsights[index]}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={insightsFetched ? "Metrics loaded" : "Click to fetch individual metrics"}
                            >
                              <Heart className={`w-[18px] h-[18px] ${parseInt(likes) > 0 ? 'text-red-500 fill-red-500' : 'text-gray-700'}`} />
                              <span className="text-sm text-gray-700 font-medium">
                                {fetchingInsights[index] ? '...' : likes}
                              </span>
                            </button>

                            {/* Reply */}
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <MessageCircle className="w-[18px] h-[18px] text-gray-700" />
                              <span className="text-sm text-gray-700 font-medium">
                                {replies}
                              </span>
                            </button>

                            {/* Repost */}
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <Repeat2 className="w-[18px] h-[18px] text-gray-700" />
                              <span className="text-sm text-gray-700 font-medium">
                                {reposts}
                              </span>
                            </button>

                            {/* Share */}
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <Share2 className="w-[18px] h-[18px] text-gray-700" />
                              <span className="text-sm text-gray-700 font-medium">
                                {shares}
                              </span>
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && posts.length === 0 && currentUsername && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts found. Click refresh to load posts.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}