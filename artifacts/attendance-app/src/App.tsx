import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Terminal from "@/pages/terminal";
import Attendance from "@/pages/attendance";
import Employees from "@/pages/employees";
import EmployeeDetail from "@/pages/employee-detail";
import Settings from "@/pages/settings";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { getAuthToken, useAuthInit } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const token = getAuthToken();
  if (!token) return <Redirect to="/login" />;

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function AppRoutes() {
  useAuthInit();

  return (
    <Switch>
      <Route path="/" component={Terminal} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/attendance"><ProtectedRoute component={Attendance} /></Route>
      <Route path="/employees"><ProtectedRoute component={Employees} /></Route>
      <Route path="/employees/:id"><ProtectedRoute component={EmployeeDetail} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="mt-2 text-muted-foreground">Page not found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="attendance-theme">
        <AppRoutes />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
