import {
  LayoutDashboard,
  BarChart3,
  Zap,
  FileText,
  ArrowRight,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Automation", url: "/automation", icon: Zap },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const otherItems = [
  // Spreadsheet removed, otherItems now empty
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar>
      <SidebarContent>
        {/* Logo Section */}
        <div className="px-4 py-6 border-b">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Threads Bot
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Automation Hub
              </p>
            </div>
          )}
          {collapsed && <div className="text-2xl">🧵</div>}
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink to={item.url}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        className={`flex items-center gap-3 ${
                          isActive
                            ? "bg-sidebar-accent text-purple-600 font-semibold"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Info Card */}
        {!collapsed && (
          <div className="mx-4 mt-auto mb-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
            <div className="text-sm font-semibold text-purple-900 mb-2">
              💡 Pro Tip
            </div>
            <p className="text-xs text-purple-700 mb-3">
              All automation bots are now in the Automation section for easy management
            </p>
            <NavLink
              to="/automation"
              className="flex items-center gap-2 text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              Go to Automation
              <ArrowRight className="h-3 w-3" />
            </NavLink>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
