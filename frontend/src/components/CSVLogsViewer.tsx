import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Trash2, Filter, Database, TrendingUp, Calendar, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

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

interface CSVStats {
  totalEntries: number;
  fileSize: string;
  lastModified: string;
  byActionType: Record<string, number>;
  byStatus: Record<string, number>;
  byModule: Record<string, number>;
  byUser: Record<string, number>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function CSVLogsViewer() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CSVLog[]>([]);
  const [stats, setStats] = useState<CSVStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    actionType: 'all',
    status: 'all',
    username: '',
    module: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedLog, setSelectedLog] = useState<CSVLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const { toast } = useToast();

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

  // Fetch stats on mount and when username changes
  useEffect(() => {
    if (currentUsername) {
      fetchStats();
    }
  }, [currentUsername]);

  // Fetch logs when filters, page, or username changes
  useEffect(() => {
    if (currentUsername) {
      fetchLogs();
    }
  }, [filters, currentPage, itemsPerPage, currentUsername]);

  const fetchStats = async () => {
    try {
      const username = currentUsername;
      const url = username 
        ? `${API_URL}/api/logs/csv/stats?username=${encodeURIComponent(username)}`
        : `${API_URL}/api/logs/csv/stats`;
      
      const response = await axios.get(url, {
        headers: username ? { 'x-username': username } : {}
      });
      
      if (response.data.success && response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Get username from threads_credentials
      const username = currentUsername;
      
      console.log('🔍 CSVLogsViewer - Fetching logs for username:', username);
      
      const url = username
        ? `${API_URL}/api/logs/csv/data?username=${encodeURIComponent(username)}&limit=10000`
        : `${API_URL}/api/logs/csv/data?limit=10000`;
      
      console.log('📡 CSVLogsViewer - Fetching from URL:', url);
      
      // Fetch all logs without pagination from backend
      const response = await axios.get(url, {
        headers: username ? { 'x-username': username } : {}
      });
      
      console.log('📥 CSVLogsViewer - Response:', response.data);
      
      if (response.data.success && response.data.data) {
        let allLogs: CSVLog[] = response.data.data;
        console.log('✅ CSVLogsViewer - Total logs fetched:', allLogs.length);
        
        // Apply filters on frontend
        let filtered = allLogs;

        // Filter by action type (normalize POST_CREATED to POST)
        if (filters.actionType && filters.actionType !== 'all') {
          filtered = filtered.filter(log => {
            const normalizedAction = log['Action Type'] === 'POST_CREATED' ? 'POST' : log['Action Type'];
            return normalizedAction === filters.actionType;
          });
        }

        // Filter by status
        if (filters.status && filters.status !== 'all') {
          filtered = filtered.filter(log => log.Status === filters.status);
        }

        // Filter by username
        if (filters.username) {
          filtered = filtered.filter(log => 
            log.Username.toLowerCase().includes(filters.username.toLowerCase()) ||
            log.Author.toLowerCase().includes(filters.username.toLowerCase())
          );
        }

        // Filter by module
        if (filters.module && filters.module !== 'all') {
          filtered = filtered.filter(log => log.Module === filters.module);
        }

        // Search across all fields
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(log => 
            Object.values(log).some(val => 
              String(val).toLowerCase().includes(searchLower)
            )
          );
        }

        // Sort by timestamp (newest first)
        filtered.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

        console.log('✅ CSVLogsViewer - After filtering:', filtered.length, 'logs');
        setLogs(filtered);
      } else {
        console.log('⚠️ CSVLogsViewer - No data in response');
        setLogs([]);
      }
    } catch (error) {
      console.error('❌ CSVLogsViewer - Error fetching logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/logs/csv/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `posts_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast({
        title: "Error",
        description: "Failed to download CSV",
        variant: "destructive"
      });
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/logs/csv/clear`);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "CSV logs cleared successfully"
        });
        fetchLogs();
        fetchStats();
      }
    } catch (error) {
      console.error('Error clearing CSV:', error);
      toast({
        title: "Error",
        description: "Failed to clear CSV logs",
        variant: "destructive"
      });
    }
  };

  const handleBackup = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/logs/csv/backup`);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "CSV backup created successfully"
        });
      }
    } catch (error) {
      console.error('Error backing up CSV:', error);
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      actionType: 'all',
      status: 'all',
      username: '',
      module: 'all',
      search: ''
    });
    setCurrentPage(1);
  };

  const viewDetails = (log: CSVLog) => {
    setSelectedLog(log);
    setShowDetailDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUCCESS: "default",
      FAILED: "destructive",
      PENDING: "secondary",
      SKIPPED: "outline"
    };
    
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getActionBadge = (action: string) => {
    // Normalize POST_CREATED to POST for display
    const normalizedAction = action === 'POST_CREATED' ? 'POST' : action;
    
    const colors: Record<string, string> = {
      LIKE: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      COMMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      REPLY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      POST: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      POST_CREATED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", // Keep for backward compatibility
      AUTOMATION_COMPLETE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
    };
    
    return (
      <Badge className={colors[normalizedAction] || colors[action] || "bg-gray-100 text-gray-800"}>
        {normalizedAction}
      </Badge>
    );
  };

  // Pagination
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
              <p className="text-xs text-muted-foreground">
                File size: {stats.fileSize}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byStatus.SUCCESS && stats.totalEntries > 0
                  ? Math.round((stats.byStatus.SUCCESS / stats.totalEntries) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.byStatus.SUCCESS || 0} successful actions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actions Breakdown</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                {Object.entries(stats.byActionType).slice(0, 3).map(([action, count]) => (
                  <div key={action} className="flex justify-between">
                    <span className="text-muted-foreground">{action}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.lastModified 
                  ? new Date(stats.lastModified).toLocaleString()
                  : 'Never'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Logs Viewer</CardTitle>
          <CardDescription>
            View and manage all post interaction logs ({logs.length} records found)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all fields..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10"
              />
            </div>
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="grid gap-4 md:grid-cols-4">
            <Select 
              value={filters.actionType} 
              onValueChange={(value) => setFilters({...filters, actionType: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="LIKE">Like</SelectItem>
                <SelectItem value="COMMENT">Comment</SelectItem>
                <SelectItem value="REPLY">Reply</SelectItem>
                <SelectItem value="POST">Post</SelectItem>
                <SelectItem value="AUTOMATION_COMPLETE">Automation Complete</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters({...filters, status: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SKIPPED">Skipped</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.module} 
              onValueChange={(value) => setFilters({...filters, module: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="index.js">Automation</SelectItem>
                <SelectItem value="notification.js">Notifications</SelectItem>
                <SelectItem value="search.js">Search</SelectItem>
                <SelectItem value="post.js">Posts</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by username..."
              value={filters.username}
              onChange={(e) => setFilters({...filters, username: e.target.value})}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={handleBackup} variant="outline" size="sm">
              <Database className="h-4 w-4 mr-2" />
              Backup
            </Button>
            <Button onClick={handleClear} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Logs
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select 
                value={String(itemsPerPage)} 
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left whitespace-nowrap">Timestamp</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Username</th>
                    <th className="p-3 text-left">Author</th>
                    <th className="p-3 text-left min-w-[200px]">Post Content</th>
                    <th className="p-3 text-left min-w-[200px]">Generated Text</th>
                    <th className="p-3 text-left">Post Link</th>
                    <th className="p-3 text-left">Module</th>
                    <th className="p-3 text-left">Bot Type</th>
                    <th className="p-3 text-left">Error</th>
                    <th className="p-3 text-left">Duration</th>
                    <th className="p-3 text-left">Session ID</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading logs...
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-muted-foreground">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, index) => (
                      <tr key={index} className="border-t hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap">
                          <div className="text-xs">
                            <div className="font-medium">{log.Date}</div>
                            <div className="text-muted-foreground">{log.Time}</div>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {getActionBadge(log['Action Type'])}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {getStatusBadge(log.Status)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-medium">@{log.Username || '-'}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-muted-foreground">@{log.Author || '-'}</span>
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <div className="truncate text-xs" title={log['Post Content']}>
                            {log['Post Content'] || '-'}
                          </div>
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <div className="truncate text-xs" title={log['Generated Text']}>
                            {log['Generated Text'] || '-'}
                          </div>
                        </td>
                        <td className="p-3 max-w-[150px]">
                          {log['Post Link'] ? (
                            <a 
                              href={`https://www.threads.net${log['Post Link']}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-xs truncate block"
                            >
                              View Post
                            </a>
                          ) : '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">{log.Module}</Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">{log['Bot Type'] || '-'}</span>
                        </td>
                        <td className="p-3 max-w-[150px]">
                          {log['Error Message'] ? (
                            <span className="text-xs text-red-600 truncate block" title={log['Error Message']}>
                              {log['Error Message']}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-xs">{log['Duration (ms)']}ms</span>
                        </td>
                        <td className="p-3 max-w-[150px]">
                          <span className="text-xs text-muted-foreground truncate block" title={log['Session ID']}>
                            {log['Session ID'] ? log['Session ID'].substring(0, 15) + '...' : '-'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Button 
                            onClick={() => viewDetails(log)} 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, logs.length)} of {logs.length} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  First
                </Button>
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>
              Complete information for this log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="text-sm mt-1">{selectedLog.Timestamp}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                  <p className="text-sm mt-1">{selectedLog.Date} {selectedLog.Time}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action Type</label>
                  <div className="mt-1">{getActionBadge(selectedLog['Action Type'])}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.Status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="text-sm mt-1">@{selectedLog.Username || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Author</label>
                  <p className="text-sm mt-1">@{selectedLog.Author || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Module</label>
                  <p className="text-sm mt-1"><Badge variant="outline">{selectedLog.Module}</Badge></p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bot Type</label>
                  <p className="text-sm mt-1">{selectedLog['Bot Type'] || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <p className="text-sm mt-1">{selectedLog['Duration (ms)']}ms</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Post Link</label>
                  {selectedLog['Post Link'] ? (
                    <a 
                      href={`https://www.threads.net${selectedLog['Post Link']}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline block mt-1"
                    >
                      View on Threads
                    </a>
                  ) : (
                    <p className="text-sm mt-1">N/A</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Post Content</label>
                <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                  {selectedLog['Post Content'] || 'N/A'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Generated Text</label>
                <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                  {selectedLog['Generated Text'] || 'N/A'}
                </div>
              </div>

              {selectedLog['Error Message'] && (
                <div>
                  <label className="text-sm font-medium text-red-600">Error Message</label>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {selectedLog['Error Message']}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Session ID</label>
                <div className="mt-1 p-3 bg-muted rounded-lg text-xs font-mono">
                  {selectedLog['Session ID'] || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}