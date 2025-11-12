import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { Outlet } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Automation from "./pages/Automation";
import Analytics from "./pages/Analytics";
import Spreadsheet from "./pages/Spreadsheet";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const MainLayout = () => {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <SidebarTrigger />
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes with Sidebar */}
            <Route element={<MainLayout />}>
              {/* Main Pages */}
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* ✅ MERGED AUTOMATION PAGE - All 4 features in one */}
              <Route path="/automation" element={<Automation />} />
              
              {/* Other Pages */}
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/spreadsheet" element={<Spreadsheet />} />
            </Route>

            {/* 404 Page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
