import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Heart, 
  MessageCircle, 
  Reply, 
  Activity, 
  Calendar,
  BarChart3,
  PieChart,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  Database,
  Download,
  RefreshCw
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CSVLog {
  Timestamp: string;
  Date: string;
  Time: string;
  'Action Type': string;
  Status: string;
  Username: string;
  Author: string;
  'Post Content': string;
  'Generated Text': string;
  'Post Link': string;
  Module: string;
  'Bot Type': string;
  'Error Message': string;
  'Duration (ms)': string;
  'Session ID': string;
}

interface AnalyticsData {
  totalActions: number;
  successRate: number;
  totalLikes: number;
  totalComments: number;
  totalReplies: number;
  totalPosts: number;
  byDay: Array<{ date: string; likes: number; comments: number; replies: number; posts: number }>;
  byHour: Array<{ hour: string; count: number }>;
  byStatus: Array<{ name: string; value: number }>;
  byAction: Array<{ name: string; value: number }>;
  recentActivity: CSVLog[];
  errorRate: number;
  avgResponseTime: number;
}

const COLORS = {
  likes: '#FF6B9D',
  comments: '#4F46E5',
  replies: '#10B981',
  posts: '#F59E0B',
  success: '#10B981',
  failed: '#EF4444',
  pending: '#F59E0B',
  skipped: '#6B7280'
};

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // Load username from threads_credentials
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

  useEffect(() => {
    if (currentUsername) {
      fetchAnalytics();
    }
  }, [dateRange, currentUsername]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get username from threads_credentials
      const username = currentUsername;
      const url = username
        ? `${API_URL}/api/logs/csv/data?username=${encodeURIComponent(username)}&limit=10000`
        : `${API_URL}/api/logs/csv/data?limit=10000`;
      
      // Fetch all CSV data
      const response = await axios.get(url, {
        headers: username ? { 'x-username': username } : {}
      });
      
      if (response.data.success && response.data.data) {
        const logs: CSVLog[] = response.data.data;
        const processedData = processAnalytics(logs);
        setAnalytics(processedData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalytics = (logs: CSVLog[]): AnalyticsData => {
    // Filter by date range
    const now = new Date();
    const daysMap: { [key: string]: number } = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 36500
    };
    const days = daysMap[dateRange] || 7;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filteredLogs = logs.filter(log => {
      const logDate = new Date(log.Timestamp);
      return logDate >= cutoffDate;
    });

    // Calculate basic stats
    const totalActions = filteredLogs.length;
    const successCount = filteredLogs.filter(log => log.Status === 'SUCCESS').length;
    const successRate = totalActions > 0 ? (successCount / totalActions) * 100 : 0;
    
    const totalLikes = filteredLogs.filter(log => log['Action Type'] === 'LIKE').length;
    const totalComments = filteredLogs.filter(log => log['Action Type'] === 'COMMENT').length;
    const totalReplies = filteredLogs.filter(log => log['Action Type'] === 'REPLY').length;
    // Count both POST and POST_CREATED as posts
    const totalPosts = filteredLogs.filter(log => 
      log['Action Type'] === 'POST' || log['Action Type'] === 'POST_CREATED'
    ).length;

    // Calculate error rate
    const failedCount = filteredLogs.filter(log => log.Status === 'FAILED').length;
    const errorRate = totalActions > 0 ? (failedCount / totalActions) * 100 : 0;

    // Calculate average response time
    const durationsValid = filteredLogs
      .map(log => parseInt(log['Duration (ms)']) || 0)
      .filter(d => d > 0);
    const avgResponseTime = durationsValid.length > 0 
      ? durationsValid.reduce((a, b) => a + b, 0) / durationsValid.length 
      : 0;

    // Group by day - use Timestamp if Date is missing
    const byDayMap: { [key: string]: { likes: number; comments: number; replies: number; posts: number } } = {};
    let logsWithoutDate = 0;
    filteredLogs.forEach(log => {
      // Use Date field if available, otherwise extract from Timestamp
      let date = log.Date;
      if (!date && log.Timestamp) {
        try {
          const timestampDate = new Date(log.Timestamp);
          date = timestampDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          logsWithoutDate++;
        } catch (e) {
          console.warn('Could not parse date from timestamp:', log.Timestamp);
          return; // Skip this log if we can't determine the date
        }
      }
      
      if (!date) {
        console.warn('Log missing both Date and Timestamp:', log);
        return; // Skip logs without date
      }
      
      if (!byDayMap[date]) {
        byDayMap[date] = { likes: 0, comments: 0, replies: 0, posts: 0 };
      }
      if (log['Action Type'] === 'LIKE') byDayMap[date].likes++;
      if (log['Action Type'] === 'COMMENT') byDayMap[date].comments++;
      if (log['Action Type'] === 'REPLY') byDayMap[date].replies++;
      // Count both POST and POST_CREATED as posts
      if (log['Action Type'] === 'POST' || log['Action Type'] === 'POST_CREATED') byDayMap[date].posts++;
    });
    
    if (logsWithoutDate > 0) {
      console.warn(`⚠️ ${logsWithoutDate} logs were missing Date field and used Timestamp instead`);
    }
    
    const byDay = Object.entries(byDayMap)
      .map(([date, counts]) => ({ 
        date, 
        likes: counts.likes, 
        comments: counts.comments, 
        replies: counts.replies, 
        posts: counts.posts,
        // Calculate total for each day (for debugging)
        total: counts.likes + counts.comments + counts.replies + counts.posts
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Debug: Log max total to verify calculation
    const maxTotal = Math.max(...byDay.map(d => d.total), 0);
    const maxDay = byDay.find(d => d.total === maxTotal);
    console.log('📊 Activity Over Time - Max daily total:', maxTotal);
    console.log('📊 Activity Over Time - Day with max:', maxDay);
    console.log('📊 Activity Over Time - All daily totals:', byDay.map(d => ({ date: d.date, total: d.total, breakdown: { likes: d.likes, comments: d.comments, replies: d.replies, posts: d.posts } })));

    // Group by hour
    const byHourMap: { [key: string]: number } = {};
    filteredLogs.forEach(log => {
      const hour = log.Time.split(':')[0];
      byHourMap[hour] = (byHourMap[hour] || 0) + 1;
    });
    
    const byHour = Object.entries(byHourMap)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // Group by status
    const statusMap: { [key: string]: number } = {};
    filteredLogs.forEach(log => {
      statusMap[log.Status] = (statusMap[log.Status] || 0) + 1;
    });
    
    const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Group by action type - normalize POST and POST_CREATED to just "POST"
    const actionMap: { [key: string]: number } = {};
    filteredLogs.forEach(log => {
      if (log['Action Type'] && log['Action Type'] !== 'AUTOMATION_COMPLETE') {
        // Normalize POST_CREATED to POST to merge them
        const normalizedAction = log['Action Type'] === 'POST_CREATED' ? 'POST' : log['Action Type'];
        actionMap[normalizedAction] = (actionMap[normalizedAction] || 0) + 1;
      }
    });
    
    const byAction = Object.entries(actionMap).map(([name, value]) => ({ name, value }));

    // Recent activity (last 10)
    const recentActivity = filteredLogs.slice(-10).reverse();

    return {
      totalActions,
      successRate,
      totalLikes,
      totalComments,
      totalReplies,
      totalPosts,
      byDay,
      byHour,
      byStatus,
      byAction,
      recentActivity,
      errorRate,
      avgResponseTime
    };
  };

  const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}-500`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground">
            <span className={`text-${trend > 0 ? 'green' : 'red'}-500`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span> from last period
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
          <p className="text-center text-muted-foreground">No analytics data available</p>
          <Button onClick={fetchAnalytics} className="mt-4 w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights from your automation activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <StatCard
          title="Total Actions"
          value={analytics.totalActions}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Success Rate"
          value={`${analytics.successRate.toFixed(1)}%`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Total Likes"
          value={analytics.totalLikes}
          icon={Heart}
          color="pink"
        />
        <StatCard
          title="Total Comments"
          value={analytics.totalComments}
          icon={MessageCircle}
          color="blue"
        />
        <StatCard
          title="Total Replies"
          value={analytics.totalReplies}
          icon={Reply}
          color="green"
        />
        <StatCard
          title="Total Posts"
          value={analytics.totalPosts}
          icon={PieChart}
          color="orange"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Activity Over Time */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Activity Over Time</CardTitle>
                <CardDescription>
                  Daily breakdown of interactions
                  <span className="ml-4 text-xs text-muted-foreground">
                    (Sum: {analytics.byDay.reduce((sum, day) => sum + day.likes + day.comments + day.replies + day.posts, 0)} actions | 
                    Expected: {analytics.totalActions} actions)
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.byDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      domain={[0, 'dataMax']}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        // Show both individual value and percentage
                        const total = analytics.byDay.reduce((sum, day) => sum + day.likes + day.comments + day.replies + day.posts, 0);
                        const percentage = total > 0 ? ((value as number) / total * 100).toFixed(1) : '0';
                        return [`${value} (${percentage}%)`, name];
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="likes" stackId="1" stroke={COLORS.likes} fill={COLORS.likes} name={`Likes (Total: ${analytics.byDay.reduce((sum, day) => sum + day.likes, 0)})`} />
                    <Area type="monotone" dataKey="comments" stackId="1" stroke={COLORS.comments} fill={COLORS.comments} name={`Comments (Total: ${analytics.byDay.reduce((sum, day) => sum + day.comments, 0)})`} />
                    <Area type="monotone" dataKey="replies" stackId="1" stroke={COLORS.replies} fill={COLORS.replies} name={`Replies (Total: ${analytics.byDay.reduce((sum, day) => sum + day.replies, 0)})`} />
                    <Area type="monotone" dataKey="posts" stackId="1" stroke={COLORS.posts} fill={COLORS.posts} name={`Posts (Total: ${analytics.byDay.reduce((sum, day) => sum + day.posts, 0)})`} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Verification summary */}
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <div>Chart Totals: Likes: {analytics.byDay.reduce((sum, day) => sum + day.likes, 0)} | Comments: {analytics.byDay.reduce((sum, day) => sum + day.comments, 0)} | Replies: {analytics.byDay.reduce((sum, day) => sum + day.replies, 0)} | Posts: {analytics.byDay.reduce((sum, day) => sum + day.posts, 0)}</div>
                  <div>Stats Cards: Likes: {analytics.totalLikes} | Comments: {analytics.totalComments} | Replies: {analytics.totalReplies} | Posts: {analytics.totalPosts}</div>
                  {analytics.byDay.reduce((sum, day) => sum + day.likes, 0) !== analytics.totalLikes || 
                   analytics.byDay.reduce((sum, day) => sum + day.comments, 0) !== analytics.totalComments ||
                   analytics.byDay.reduce((sum, day) => sum + day.replies, 0) !== analytics.totalReplies ||
                   analytics.byDay.reduce((sum, day) => sum + day.posts, 0) !== analytics.totalPosts ? (
                    <div className="text-red-500 font-semibold">⚠️ Mismatch detected! Chart totals don't match stats cards.</div>
                  ) : (
                    <div className="text-green-500">✅ Totals match</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Action Distribution</CardTitle>
                <CardDescription>Breakdown by action type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={analytics.byAction}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.byAction.map((entry, index) => {
                        // Map action types to specific colors
                        const getColor = (actionName: string) => {
                          const normalized = actionName.toUpperCase();
                          if (normalized === 'LIKE' || normalized === 'LIKES') return COLORS.likes;
                          if (normalized === 'COMMENT' || normalized === 'COMMENT') return COLORS.comments;
                          if (normalized === 'REPLY' || normalized === 'REPLIES') return COLORS.replies;
                          if (normalized === 'POST' || normalized === 'POST_CREATED') return COLORS.posts;
                          // Default color rotation for other actions
                          return Object.values(COLORS)[index % Object.values(COLORS).length];
                        };
                        return <Cell key={`cell-${index}`} fill={getColor(entry.name)} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>Success vs failure rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {analytics.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || '#8884d8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Activity by Hour */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Activity by Hour</CardTitle>
                <CardDescription>When are you most active?</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.byHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS.comments} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 10 actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.recentActivity.map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {log['Action Type'] === 'LIKE' && <Heart className="h-4 w-4 text-pink-500" />}
                        {log['Action Type'] === 'COMMENT' && <MessageCircle className="h-4 w-4 text-blue-500" />}
                        {log['Action Type'] === 'REPLY' && <Reply className="h-4 w-4 text-green-500" />}
                        {(log['Action Type'] === 'POST' || log['Action Type'] === 'POST_CREATED') && <PieChart className="h-4 w-4 text-orange-500" />}
                        <div>
                          <p className="text-sm font-medium">
                            {log['Action Type'] === 'POST_CREATED' ? 'POST' : log['Action Type']}
                          </p>
                          <p className="text-xs text-muted-foreground">@{log.Author || log.Username || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.Status === 'SUCCESS' ? 'default' : 'destructive'}>
                          {log.Status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.Time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.errorRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Failed actions / total actions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgResponseTime.toFixed(0)}ms</div>
                <p className="text-xs text-muted-foreground">
                  Average action duration
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <Target className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((analytics.totalComments + analytics.totalReplies) / analytics.totalActions * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Comments + Replies / Total
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Detailed performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="text-sm text-muted-foreground">{analytics.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${analytics.successRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Like Ratio</span>
                    <span className="text-sm text-muted-foreground">
                      {((analytics.totalLikes / analytics.totalActions) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-pink-500 h-2 rounded-full" 
                      style={{ width: `${(analytics.totalLikes / analytics.totalActions) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Comment Ratio</span>
                    <span className="text-sm text-muted-foreground">
                      {((analytics.totalComments / analytics.totalActions) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(analytics.totalComments / analytics.totalActions) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Reply Ratio</span>
                    <span className="text-sm text-muted-foreground">
                      {((analytics.totalReplies / analytics.totalActions) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(analytics.totalReplies / analytics.totalActions) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Post Ratio</span>
                    <span className="text-sm text-muted-foreground">
                      {((analytics.totalPosts / analytics.totalActions) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ width: `${(analytics.totalPosts / analytics.totalActions) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>AI-powered recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Strong Performance</p>
                    <p className="text-sm text-muted-foreground">
                      Your success rate of {analytics.successRate.toFixed(1)}% is excellent
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Peak Activity Hours</p>
                    <p className="text-sm text-muted-foreground">
                      Most active between {analytics.byHour[0]?.hour || 'N/A'} and{' '}
                      {analytics.byHour[analytics.byHour.length - 1]?.hour || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Engagement Focus</p>
                    <p className="text-sm text-muted-foreground">
                      {analytics.totalLikes > analytics.totalComments 
                        ? 'Likes dominate your interactions - consider more comments'
                        : 'Good balance between likes and comments'}
                    </p>
                  </div>
                </div>

                {analytics.errorRate > 10 && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">High Error Rate</p>
                      <p className="text-sm text-muted-foreground">
                        Error rate of {analytics.errorRate.toFixed(1)}% needs attention
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Improve your automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">📈 Optimize Timing</p>
                  <p className="text-xs text-muted-foreground">
                    Schedule more activities during your peak hours for better engagement
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">💬 Balance Actions</p>
                  <p className="text-xs text-muted-foreground">
                    Mix likes, comments, and replies for more natural interaction patterns
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">🎯 Quality Over Quantity</p>
                  <p className="text-xs text-muted-foreground">
                    Focus on meaningful interactions rather than high volume
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">🔍 Monitor Errors</p>
                  <p className="text-xs text-muted-foreground">
                    Review failed actions to identify and fix common issues
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}