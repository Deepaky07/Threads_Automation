import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, BarChart, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Import your existing components
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import CSVLogsViewer from '@/components/CSVLogsViewer';
import ProfilePosts from '@/components/ProfilePosts';

export default function Analytics() { 
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // Load username from threads_credentials (same as Automation page)
  useEffect(() => {
    const loadUsername = () => {
      try {
        const savedData = localStorage.getItem('threads_credentials');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.username) {
            setCurrentUsername(parsed.username);
            console.log('✅ Loaded username from threads_credentials:', parsed.username);
          }
        }
      } catch (error) {
        console.error('❌ Error loading credentials:', error);
      }
    };

    loadUsername();

    // Listen for credential changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'threads_credentials') {
        loadUsername();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('credentials-updated', loadUsername);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('credentials-updated', loadUsername);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-2">
            View detailed analytics, logs, and insights for all bot activities
          </p>
          {currentUsername && (
            <div className="mt-3 p-3 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                📊 Viewing data for: <span className="font-bold">{currentUsername}</span>
              </p>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="csv-logs" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              CSV Logs
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              My Posts
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <AnalyticsDashboard key={currentUsername || 'default'} />
          </TabsContent>

          {/* CSV Logs Tab */}
          <TabsContent value="csv-logs">
            <CSVLogsViewer key={currentUsername || 'default'} />
          </TabsContent>

          {/* My Posts Tab */}
          <TabsContent value="posts">
            <ProfilePosts key={currentUsername || 'default'} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
