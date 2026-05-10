import { useGetDashboardStats, useGetDepartmentBreakdown, useGetWeeklyAttendance, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, UserX, Activity } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: deptStats, isLoading: deptLoading } = useGetDepartmentBreakdown();
  const { data: weeklyStats, isLoading: weeklyLoading } = useGetWeeklyAttendance();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity();

  if (statsLoading || deptLoading || weeklyLoading || activityLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-80 bg-muted rounded-xl" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Today's attendance summary</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={stats?.totalEmployees || 0} icon={Users} />
        <StatCard title="Present Today" value={stats?.presentToday || 0} icon={UserCheck} className="text-green-600" />
        <StatCard title="Late Today" value={stats?.lateToday || 0} icon={Clock} className="text-yellow-600" />
        <StatCard title="Absent Today" value={stats?.absentToday || 0} icon={UserX} className="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStats || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lateCount" name="Late" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Activity className="text-muted-foreground w-4 h-4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity?.slice(0, 5).map(record => (
                <div key={record.id} className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium">{record.employeeName}</div>
                    <div className="text-sm text-muted-foreground">{record.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</div>
                    <Badge variant={record.status === 'present' ? 'default' : record.status === 'late' ? 'secondary' : 'destructive'} className="mt-1">
                      {record.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!recentActivity || recentActivity.length === 0) && (
                <div className="text-center text-muted-foreground py-8">No activity today</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, className = "" }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center ${className}`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}