

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, Smartphone, Bell, User, Shield, LogIn, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const pageAccessConfig = {
  // Demo/Public Pages - Login should NOT show in navigation
  DemoHome: { roles: ["demo", "public"], category: "Demo", title: "🏠 Home" },
  BusinessRegistration: { roles: ["demo", "public"], category: "Public", title: "🏢 Business Registration" },
  PrivacyPolicy: { roles: ["demo", "public", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "🔒 Privacy Policy" },
  TermsOfService: { roles: ["demo", "public", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "📄 Terms of Service" },
  DataSecurity: { roles: ["demo", "public", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "🛡️ Data Security" },
  PublicTracking: { roles: ["public", "demo", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "📦 Track Package" },
  CustomerReturnsPortal: { roles: ["public", "demo", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "📤 Return Package" },
  InsuranceClaimsPortal: { roles: ["public", "demo", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "🛡️ File Insurance Claim" },
  HelpCenter: { roles: ["demo", "customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "Public", title: "❓ Help Center" },
  
  // Customer Pages
  CustomerPortal: { roles: ["customer", "admin"], category: "Customer", title: "🏠 My Deliveries" },
  CustomerSelfService: { roles: ["customer", "admin"], category: "Customer", title: "⚙️ My Preferences" },
  CreateShippingLabel: { roles: ["customer", "business_sender", "admin"], category: "Customer", title: "🏷️ Create Label" },
  
  // Driver Pages
  DriverMobile: { roles: ["driver", "admin"], category: "Driver", title: "📱 Driver Mobile" },
  RecordMyRoute: { roles: ["driver", "admin"], category: "Driver", title: "🎙️ Record My Route" },
  FollowRecordedRoute: { roles: ["driver", "admin"], category: "Driver", title: "🧭 Follow GPS Route" },
  DriverExpenses: { roles: ["driver", "admin"], category: "Driver", title: "💰 My Expenses" },
  DriverNavigation: { roles: ["driver", "admin"], category: "Driver", title: "🗺️ Navigation" },
  DriverCertifications: { roles: ["driver", "manager", "admin"], category: "Driver", title: "🎖️ My Certifications" },
  CarrierDashboard: { roles: ["driver", "admin"], category: "Driver", title: "🏠 Carrier Dashboard" },
  
  // Dispatch Pages
  DispatchDashboard: { roles: ["dispatcher", "manager", "admin"], category: "Dispatch", title: "🎛️ Dispatch Control" },
  FleetMap: { roles: ["dispatcher", "manager", "admin"], category: "Dispatch", title: "📍 Live Fleet Map" },
  RoutePlanning: { roles: ["dispatcher", "manager", "admin"], category: "Dispatch", title: "🗺️ Route Planning" },
  BatchPackageEntry: { roles: ["dispatcher", "admin"], category: "Dispatch", title: "📦 Batch Entry" },
  PackageManagement: { roles: ["dispatcher", "manager", "admin"], category: "Dispatch", title: "📦 Package Management" },
  CustomerMessageDashboard: { roles: ["dispatcher", "manager", "admin"], category: "Dispatch", title: "💬 Customer Messages" },
  
  // Management Pages
  DriverManagement: { roles: ["manager", "admin"], category: "Management", title: "👥 Driver Management" },
  PaymentCenter: { roles: ["manager", "admin"], category: "Management", title: "💰 Payment Center" },
  ReportsHub: { roles: ["manager", "admin"], category: "Management", title: "📊 Reports Hub" },
  AnalyticsDashboard: { roles: ["manager", "admin"], category: "Management", title: "📈 Analytics" },
  IncidentManagement: { roles: ["manager", "admin"], category: "Management", title: "🚨 Incident Management" },
  EmergencyResponseCenter: { roles: ["dispatcher", "manager", "admin"], category: "Management", title: "🚨 Emergency Response" },
  FleetMaintenance: { roles: ["manager", "admin"], category: "Management", title: "🔧 Fleet Maintenance" },
  
  // Business Sender Pages
  BusinessSenderDashboard: { roles: ["business_sender", "admin"], category: "Business", title: "📊 Business Dashboard" },
  LabelDesigner: { roles: ["business_sender", "admin"], category: "Business", title: "🎨 Label Designer" },
  
  // Admin Pages
  AdminControl: { roles: ["admin"], category: "Admin", title: "🔧 Admin Control" },
  SystemSettings: { roles: ["admin"], category: "Admin", title: "⚙️ System Settings" },
  RoleManagement: { roles: ["admin"], category: "Admin", title: "👤 Role Management" },
  USPSManagement: { roles: ["admin"], category: "Admin", title: "📮 USPS Management" },
  BulkOperations: { roles: ["admin"], category: "Admin", title: "⚙️ Bulk Operations" },
  AutomationHub: { roles: ["admin"], category: "Admin", title: "⚡ Automation Hub" },
  
  // Shared/Multi-Role Pages
  NotificationCenter: { roles: ["driver", "dispatcher", "manager", "admin"], category: "Shared", title: "🔔 Notifications" },
  DocumentVault: { roles: ["driver", "dispatcher", "manager", "admin"], category: "Shared", title: "📁 Documents" },
  TrainingPortal: { roles: ["driver", "dispatcher", "manager", "admin"], category: "Shared", title: "🎓 Training" },
  
  // Other specialized pages
  HOSManagement: { roles: ["driver", "manager", "admin"], category: "Compliance", title: "⏱️ HOS Management" },
  DOTCompliance: { roles: ["driver", "manager", "admin"], category: "Compliance", title: "✅ DOT Compliance" },
  LoadManagement: { roles: ["driver", "dispatcher", "admin"], category: "Operations", title: "📦 Load Management" },
  MailboxManagement: { roles: ["driver", "dispatcher", "admin"], category: "Operations", title: "📬 Mailbox Management" },
  CustomerCommunication: { roles: ["dispatcher", "manager", "admin"], category: "Operations", title: "💬 Customer Contact" },
  InventoryManagement: { roles: ["dispatcher", "manager", "admin"], category: "Operations", title: "📦 Inventory" },
  Home: { roles: ["customer", "driver", "dispatcher", "manager", "admin", "business_sender"], category: "General", title: "🏠 Dashboard" },
  BinManagementPage: { roles: ["driver", "dispatcher", "admin"], category: "Operations", title: "🗃️ Bin Management" },
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return user;
      } catch (error) {
        // User not logged in - return demo user
        return { role: "demo", full_name: "Guest User", email: "guest@demo.com" };
      }
    },
    initialData: { role: "demo", full_name: "Guest User", email: "guest@demo.com" }
  });

  const userRole = currentUser?.role || "demo";
  const secondaryRoles = currentUser?.secondary_roles || [];
  const isDemo = userRole === "demo";

  const normalizePath = (path) => path === "/" ? "/" : path.replace(/\/+$/, '').toLowerCase();

  // Filter navigation items based on user role
  const navigationItems = Object.entries(pageAccessConfig)
    .filter(([pageName, config]) => {
      // Check if user has access to this page
      const hasAccess = config.roles.includes(userRole) || 
                       config.roles.some(role => secondaryRoles.includes(role)) ||
                       config.roles.includes("public");
      return hasAccess;
    })
    .map(([pageName, config]) => ({
      title: config.title,
      url: createPageUrl(pageName),
      icon: Package,
      category: config.category
    }));

  // Group by category
  const groupedNav = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const handleLogin = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-blue-50 via-white to-green-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-600 to-green-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">CarrierConnect</h2>
                <p className="text-xs text-blue-100">Rural Carrier Platform</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {isDemo && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-500 to-green-500 rounded-xl text-white">
                <p className="text-sm font-semibold mb-2">👋 Welcome, Guest!</p>
                <p className="text-xs mb-3 text-white/90">Login to access all features</p>
                <Button
                  onClick={handleLogin}
                  className="w-full bg-white text-blue-600 hover:bg-gray-100 font-bold"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login Now
                </Button>
              </div>
            )}
            
            {Object.entries(groupedNav).map(([category, items]) => (
              <SidebarGroup key={category}>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-3 py-2">
                  {category}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                            className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl mb-1 ${
                            normalizePath(location.pathname) === normalizePath(item.url)
                              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white shadow-md'
                              : ''
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200 p-4 bg-gray-50">
            {isDemo ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-white" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Guest Mode</p>
                <p className="text-xs text-gray-600 mb-3">Limited access</p>
                <Button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700 font-semibold"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    userRole === 'admin' ? 'bg-red-600' :
                    userRole === 'manager' ? 'bg-orange-600' :
                    userRole === 'dispatcher' ? 'bg-purple-600' :
                    userRole === 'driver' ? 'bg-green-600' :
                    userRole === 'business_sender' ? 'bg-indigo-600' :
                    'bg-blue-600'
                  }`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{currentUser?.full_name || "User"}</p>
                    <p className="text-xs text-gray-600 capitalize">{userRole.replace('_', ' ')}</p>
                  </div>
                </div>
                {secondaryRoles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {secondaryRoles.map(role => (
                      <span key={role} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        +{role}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  onClick={() => base44.auth.logout()}
                  variant="outline"
                  className="w-full mt-3 border-red-300 text-red-700 hover:bg-red-50"
                  size="sm"
                >
                  Logout
                </Button>
              </>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4 md:hidden shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900">CarrierConnect</h1>
              {isDemo && (
                <Button
                  onClick={handleLogin}
                  size="sm"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <LogIn className="w-4 h-4 mr-1" />
                  Login
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

