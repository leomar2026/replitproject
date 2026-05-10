import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLookupEmployee, useTimeIn, useTimeOut, useGetTodayAttendance, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Search, CheckCircle2, User, CalendarDays } from "lucide-react";
import logoSrc from "@assets/Logo_1778392979899.png";

const searchSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required")
});

export default function Terminal() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { location, loading: geoLoading, error: geoError, retry: retryGeo } = useGeolocation();
  const queryClient = useQueryClient();
  
  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: { employeeId: "" }
  });

  const [activeEmployeeId, setActiveEmployeeId] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const { data: employee, isFetching: lookupLoading, isError: isLookupError } = useLookupEmployee(activeEmployeeId, {
    query: { enabled: !!activeEmployeeId, retry: false }
  });

  const { data: todayAttendance, isFetching: attendanceLoading } = useGetTodayAttendance(activeEmployeeId, {
    query: { enabled: !!employee, queryKey: getGetTodayAttendanceQueryKey(activeEmployeeId) }
  });

  const timeInMutation = useTimeIn();
  const timeOutMutation = useTimeOut();

  const handleSearch = (values: z.infer<typeof searchSchema>) => {
    setLookupError("");
    setSuccessMessage("");
    setActiveEmployeeId(values.employeeId);
  };

  useEffect(() => {
    if (isLookupError && activeEmployeeId) {
      setLookupError("Employee not found. Please check your ID.");
      setActiveEmployeeId("");
    }
  }, [isLookupError, activeEmployeeId]);

  const handleTimeIn = () => {
    if (!employee) return;
    timeInMutation.mutate({
      data: {
        employeeId: employee.employeeId,
        latitude: location?.latitude,
        longitude: location?.longitude
      }
    }, {
      onSuccess: () => {
        setSuccessMessage(`Successfully timed in at ${new Date().toLocaleTimeString()}`);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey(employee.employeeId) });
        setTimeout(() => resetTerminal(), 5000);
      }
    });
  };

  const handleTimeOut = () => {
    if (!employee || !todayAttendance?.record) return;
    timeOutMutation.mutate({
      id: todayAttendance.record.id,
      data: {
        latitude: location?.latitude,
        longitude: location?.longitude
      }
    }, {
      onSuccess: () => {
        setSuccessMessage(`Successfully timed out at ${new Date().toLocaleTimeString()}`);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey(employee.employeeId) });
        setTimeout(() => resetTerminal(), 5000);
      }
    });
  };

  const resetTerminal = () => {
    setActiveEmployeeId("");
    setSuccessMessage("");
    form.reset();
  };

  const isWorking = timeInMutation.isPending || timeOutMutation.isPending;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <img src={logoSrc} alt="Electro Power" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-6 shadow-md" />
          <h1 className="text-6xl font-bold tracking-tight text-foreground font-mono tabular-nums">
            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
          </h1>
          <p className="text-xl text-muted-foreground mt-4 font-medium flex items-center justify-center gap-2">
            <CalendarDays className="w-5 h-5" />
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="border-primary/10 shadow-lg bg-card">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                Terminal Access
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {geoLoading ? (
                  <span className="text-muted-foreground">Acquiring GPS...</span>
                ) : geoError ? (
                  <span className="text-destructive font-medium">{geoError}</span>
                ) : location ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Location Acquired
                  </span>
                ) : null}
              </div>
            </div>

            {successMessage ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Success</h3>
                <p className="text-lg text-muted-foreground">{successMessage}</p>
                <Button variant="outline" className="mt-8" onClick={resetTerminal}>
                  Back to Terminal
                </Button>
              </div>
            ) : !employee ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                            <Input 
                              placeholder="Enter Employee ID..." 
                              className="pl-14 h-16 text-xl tracking-wider font-mono bg-muted/50 border-muted" 
                              autoFocus
                              autoComplete="off"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        {lookupError && <p className="text-sm font-medium text-destructive mt-2">{lookupError}</p>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="lg" className="w-full h-16 text-lg" disabled={lookupLoading}>
                    {lookupLoading ? "Looking up..." : "Continue"}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-6 mb-8 p-4 rounded-xl bg-muted/30 border border-border">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">{employee.fullName}</h3>
                    <p className="text-muted-foreground">{employee.department} • {employee.position}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={resetTerminal}>
                    Cancel
                  </Button>
                </div>

                {attendanceLoading ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">Checking status...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      size="lg" 
                      className="h-24 text-xl"
                      disabled={!!todayAttendance?.record?.timeIn || isWorking}
                      onClick={handleTimeIn}
                    >
                      Time In
                      {todayAttendance?.record?.timeIn && (
                        <span className="block text-sm opacity-70 mt-1 font-normal">
                          Already clocked in
                        </span>
                      )}
                    </Button>
                    <Button 
                      size="lg" 
                      variant={!todayAttendance?.record?.timeIn || todayAttendance?.record?.timeOut ? "secondary" : "default"}
                      className={`h-24 text-xl ${(!todayAttendance?.record?.timeIn || todayAttendance?.record?.timeOut) ? "opacity-50" : ""}`}
                      disabled={!todayAttendance?.record?.timeIn || !!todayAttendance?.record?.timeOut || isWorking}
                      onClick={handleTimeOut}
                    >
                      Time Out
                      {todayAttendance?.record?.timeOut && (
                        <span className="block text-sm opacity-70 mt-1 font-normal">
                          Already clocked out
                        </span>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}