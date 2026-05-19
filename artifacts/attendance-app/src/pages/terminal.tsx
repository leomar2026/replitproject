import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useLookupEmployee,
  getLookupEmployeeQueryKey,
  useTimeIn,
  useTimeOut,
  useGetTodayAttendance,
  getGetTodayAttendanceQueryKey,
  useBiometricRegisterBegin,
  useBiometricRegisterFinish,
  useBiometricDiscoverBegin,
  useBiometricDiscoverFinish,
  useBiometricStatus,
  getBiometricStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Search, CheckCircle2, User, CalendarDays, Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { useCompany } from "@/hooks/use-company";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/types";

const searchSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required")
});

type GeoState = { latitude?: number; longitude?: number } | null;

function useOnDemandGeo() {
  const [location, setLocation] = useState<GeoState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback((): Promise<GeoState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation not supported");
        resolve(null);
        return;
      }
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, []);

  return { location, loading, error, capture };
}

export default function Terminal() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();

  const timeInGeo = useOnDemandGeo();
  const timeOutGeo = useOnDemandGeo();

  useEffect(() => {
    // Pre-fetch location for time-in on load
    timeInGeo.capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [biometricError, setBiometricError] = useState("");
  const [biometricWorking, setBiometricWorking] = useState(false);
  const [registerWorking, setRegisterWorking] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const { data: employee, isFetching: lookupLoading, isError: isLookupError } = useLookupEmployee(
    activeEmployeeId,
    { query: { enabled: !!activeEmployeeId, retry: false, queryKey: getLookupEmployeeQueryKey(activeEmployeeId) } }
  );

  const { data: todayAttendance, isFetching: attendanceLoading } = useGetTodayAttendance(
    activeEmployeeId,
    { query: { enabled: !!employee, queryKey: getGetTodayAttendanceQueryKey(activeEmployeeId) } }
  );

  const { data: biometricStatus } = useBiometricStatus(
    activeEmployeeId,
    { query: { enabled: !!employee, queryKey: getBiometricStatusQueryKey(activeEmployeeId) } }
  );

  const timeInMutation = useTimeIn();
  const timeOutMutation = useTimeOut();
  const registerBeginMutation = useBiometricRegisterBegin();
  const registerFinishMutation = useBiometricRegisterFinish();
  const discoverBeginMutation = useBiometricDiscoverBegin();
  const discoverFinishMutation = useBiometricDiscoverFinish();

  useEffect(() => {
    if (isLookupError && activeEmployeeId) {
      setLookupError("Employee not found. Please check your ID.");
      setActiveEmployeeId("");
    }
  }, [isLookupError, activeEmployeeId]);

  const handleSearch = (values: z.infer<typeof searchSchema>) => {
    setLookupError("");
    setSuccessMessage("");
    setBiometricError("");
    setRegisterSuccess(false);
    setActiveEmployeeId(values.employeeId);
  };

  const handleTimeIn = async () => {
    if (!employee) return;
    const coords = await timeInGeo.capture();
    timeInMutation.mutate({
      data: {
        employeeId: employee.employeeId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }
    }, {
      onSuccess: () => {
        setSuccessMessage(`Successfully timed in at ${new Date().toLocaleTimeString()}`);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey(employee.employeeId) });
        setTimeout(() => resetTerminal(), 5000);
      }
    });
  };

  const handleTimeOut = async () => {
    if (!employee || !todayAttendance?.record) return;
    const coords = await timeOutGeo.capture();
    timeOutMutation.mutate({
      id: todayAttendance.record.id,
      data: {
        timeOutLatitude: coords?.latitude,
        timeOutLongitude: coords?.longitude,
      }
    }, {
      onSuccess: () => {
        setSuccessMessage(`Successfully timed out at ${new Date().toLocaleTimeString()}`);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey(employee.employeeId) });
        setTimeout(() => resetTerminal(), 5000);
      }
    });
  };

  const handleBiometricRegister = async () => {
    if (!employee) return;
    setRegisterWorking(true);
    setBiometricError("");
    try {
      const options = await new Promise<Record<string, unknown>>((resolve, reject) => {
        registerBeginMutation.mutate(
          { data: { employeeId: employee.employeeId } },
          {
            onSuccess: (data) => resolve(data as Record<string, unknown>),
            onError: (err) => reject(err),
          }
        );
      });

      const credential = await startRegistration({ optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]["optionsJSON"] });

      await new Promise<void>((resolve, reject) => {
        registerFinishMutation.mutate(
          { data: { employeeId: employee.employeeId, credential: credential as unknown as Record<string, unknown> } },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });

      setRegisterSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["biometricStatus", employee.employeeId] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      if (!msg.includes("cancelled") && !msg.includes("abort")) {
        setBiometricError(msg);
      }
    } finally {
      setRegisterWorking(false);
    }
  };

  const handleBiometricAuth = async () => {
    setBiometricWorking(true);
    setBiometricError("");
    try {
      const options = await new Promise<Record<string, unknown>>((resolve, reject) => {
        discoverBeginMutation.mutate(undefined, {
          onSuccess: (data) => resolve(data as Record<string, unknown>),
          onError: (err) => reject(err),
        });
      });

      const { discoverKey, ...authOptions } = options as { discoverKey: string } & Record<string, unknown>;

      const credential = await startAuthentication({
        optionsJSON: authOptions as unknown as Parameters<typeof startAuthentication>[0]["optionsJSON"],
      });

      const emp = await new Promise<{ employeeId: string }>((resolve, reject) => {
        discoverFinishMutation.mutate(
          { data: { discoverKey, credential: credential as unknown as Record<string, unknown> } },
          {
            onSuccess: (data) => resolve(data as { employeeId: string }),
            onError: (err) => reject(err),
          }
        );
      });

      setActiveEmployeeId(emp.employeeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Biometric authentication failed";
      if (!msg.includes("cancelled") && !msg.includes("abort")) {
        setBiometricError(msg);
      }
    } finally {
      setBiometricWorking(false);
    }
  };

  const resetTerminal = () => {
    setActiveEmployeeId("");
    setSuccessMessage("");
    setBiometricError("");
    setRegisterSuccess(false);
    form.reset();
  };

  const isWorking = timeInMutation.isPending || timeOutMutation.isPending;

  const timeInLocation = timeInGeo.location;
  const timeOutLocation = timeOutGeo.location;
  const company = useCompany();

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <img src={company.logo} alt={company.name} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-6 shadow-md" />
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
              <h2 className="text-lg font-semibold tracking-tight">Terminal Access</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {timeInGeo.loading ? (
                  <span>Acquiring GPS...</span>
                ) : timeInGeo.error ? (
                  <span className="text-destructive text-xs">Location off</span>
                ) : timeInLocation ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> GPS Ready
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
              <div className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-4">
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
                    <Button type="submit" size="lg" className="w-full h-14 text-lg" disabled={lookupLoading}>
                      {lookupLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                      {lookupLoading ? "Looking up..." : "Continue"}
                    </Button>
                  </form>
                </Form>

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-sm text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {biometricError && (
                  <p className="text-sm font-medium text-destructive text-center">{biometricError}</p>
                )}

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Use your registered biometric to identify yourself
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-14 text-lg gap-3 border-primary/30 text-primary hover:bg-primary/5"
                    disabled={biometricWorking}
                    onClick={handleBiometricAuth}
                  >
                    {biometricWorking ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-6 h-6" />
                    )}
                    {biometricWorking ? "Verifying..." : "Use Biometric"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-6 p-4 rounded-xl bg-muted/30 border border-border">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                    <User className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold tracking-tight">{employee.fullName}</h3>
                    <p className="text-muted-foreground">{employee.department} • {employee.position}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={resetTerminal}>
                    Cancel
                  </Button>
                </div>

                {attendanceLoading ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking status...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        size="lg"
                        className="h-24 text-xl flex-col gap-1"
                        disabled={!!todayAttendance?.record?.timeIn || isWorking}
                        onClick={handleTimeIn}
                      >
                        {(timeInMutation.isPending || timeInGeo.loading) ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <span>Time In</span>
                            {todayAttendance?.record?.timeIn ? (
                              <span className="text-xs opacity-70 font-normal">Already clocked in</span>
                            ) : (
                              <span className="text-xs opacity-70 font-normal flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {timeInLocation ? "Location ready" : "No location"}
                              </span>
                            )}
                          </>
                        )}
                      </Button>

                      <Button
                        size="lg"
                        variant={!todayAttendance?.record?.timeIn || todayAttendance?.record?.timeOut ? "secondary" : "default"}
                        className={`h-24 text-xl flex-col gap-1 ${(!todayAttendance?.record?.timeIn || todayAttendance?.record?.timeOut) ? "opacity-50" : ""}`}
                        disabled={!todayAttendance?.record?.timeIn || !!todayAttendance?.record?.timeOut || isWorking}
                        onClick={handleTimeOut}
                      >
                        {(timeOutMutation.isPending || timeOutGeo.loading) ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <span>Time Out</span>
                            {todayAttendance?.record?.timeOut ? (
                              <span className="text-xs opacity-70 font-normal">Already clocked out</span>
                            ) : todayAttendance?.record?.timeIn ? (
                              <span className="text-xs opacity-70 font-normal flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {timeOutLocation ? "Location ready" : "Will capture location"}
                              </span>
                            ) : null}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border-t border-border pt-4">
                      {registerSuccess ? (
                        <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium py-2">
                          <ShieldCheck className="w-5 h-5" />
                          Biometric registered successfully!
                        </div>
                      ) : biometricStatus?.registered ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
                          <Fingerprint className="w-4 h-4 text-primary" />
                          <span>Biometric registered on this account</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground text-center">
                            No biometric registered — set one up for faster sign-in next time
                          </p>
                          {biometricError && (
                            <p className="text-xs text-destructive text-center">{biometricError}</p>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
                            disabled={registerWorking}
                            onClick={handleBiometricRegister}
                          >
                            {registerWorking ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Fingerprint className="w-4 h-4" />
                            )}
                            {registerWorking ? "Follow device prompt..." : "Register Biometric (Fingerprint / Face ID)"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
