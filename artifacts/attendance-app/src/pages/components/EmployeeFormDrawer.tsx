import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useGetEmployee,
  getListEmployeesQueryKey,
  getGetEmployeeQueryKey,
  useBiometricRegisterBegin,
  useBiometricRegisterFinish,
  useBiometricStatus,
  getBiometricStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, CheckCircle2, Loader2 } from "lucide-react";

const employeeSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  fullName: z.string().min(1, "Full name is required"),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  phone: z.string().optional(),
});

type EmployeeFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number | null;
};

export default function EmployeeFormDrawer({ open, onOpenChange, employeeId }: EmployeeFormDrawerProps) {
  const isEditing = !!employeeId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [savedEmployeeStringId, setSavedEmployeeStringId] = useState<string | null>(null);
  const [biometricWorking, setBiometricWorking] = useState(false);
  const [biometricJustRegistered, setBiometricJustRegistered] = useState(false);

  const { data: employeeData, isFetching } = useGetEmployee(employeeId as number, {
    query: { enabled: open && isEditing, queryKey: getGetEmployeeQueryKey(employeeId as number) }
  });

  const activeEmployeeStringId = isEditing
    ? (employeeData?.employeeId ?? "")
    : (savedEmployeeStringId ?? "");

  const showBiometricSection = (isEditing && !!employeeData) || !!savedEmployeeStringId;

  const { data: biometricStatus, refetch: refetchBiometricStatus } = useBiometricStatus(
    activeEmployeeStringId,
    { query: { enabled: showBiometricSection && !!activeEmployeeStringId, queryKey: getBiometricStatusQueryKey(activeEmployeeStringId) } }
  );

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const registerBeginMutation = useBiometricRegisterBegin();
  const registerFinishMutation = useBiometricRegisterFinish();

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employeeId: "", fullName: "", department: "", position: "", phone: "" },
  });

  useEffect(() => {
    if (open && !isEditing) {
      form.reset({ employeeId: "", fullName: "", department: "", position: "", phone: "" });
      setSavedEmployeeStringId(null);
      setBiometricJustRegistered(false);
    } else if (open && isEditing && employeeData) {
      form.reset({
        employeeId: employeeData.employeeId,
        fullName: employeeData.fullName,
        department: employeeData.department,
        position: employeeData.position,
        phone: employeeData.phone || "",
      });
    }
  }, [open, isEditing, employeeData, form]);

  const onSubmit = (values: z.infer<typeof employeeSchema>) => {
    if (isEditing && employeeId) {
      updateMutation.mutate(
        { id: employeeId, data: values },
        {
          onSuccess: () => {
            toast({ title: "Employee updated" });
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
          },
          onError: (err: any) => {
            toast({ title: "Failed to update", description: err.message, variant: "destructive" });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: (data) => {
            toast({ title: "Employee created", description: "You can now register their biometric below." });
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setSavedEmployeeStringId(data.employeeId);
          },
          onError: (err: any) => {
            toast({ title: "Failed to create", description: err.message, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleRegisterBiometric = async () => {
    if (!activeEmployeeStringId) return;
    setBiometricWorking(true);
    setBiometricJustRegistered(false);
    try {
      const options = await new Promise<Record<string, unknown>>((resolve, reject) => {
        registerBeginMutation.mutate(
          { data: { employeeId: activeEmployeeStringId } },
          { onSuccess: (d) => resolve(d as unknown as Record<string, unknown>), onError: reject }
        );
      });

      const credential = await startRegistration({
        optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]["optionsJSON"],
      });

      await new Promise<void>((resolve, reject) => {
        registerFinishMutation.mutate(
          { data: { employeeId: activeEmployeeStringId, credential: credential as unknown as Record<string, unknown> } },
          { onSuccess: () => resolve(), onError: reject }
        );
      });

      setBiometricJustRegistered(true);
      refetchBiometricStatus();
      toast({ title: "Biometric registered", description: "Employee can now use biometric on the terminal." });
    } catch (err: any) {
      const msg = err?.message || "Biometric registration failed";
      if (!msg.includes("cancelled") && !msg.includes("abort")) {
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
      }
    } finally {
      setBiometricWorking(false);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const employeeSaved = isEditing || !!savedEmployeeStringId;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>{isEditing ? "Edit Employee" : "Add Employee"}</DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Update employee details below." : "Enter details for the new employee."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 pb-0 space-y-4">
            {isFetching ? (
              <div className="animate-pulse space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
              </div>
            ) : (
              <Form {...form}>
                <form id="employee-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input placeholder="EMP-001" disabled={isEditing || !!savedEmployeeStringId} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" disabled={!!savedEmployeeStringId} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="Engineering" disabled={!!savedEmployeeStringId} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input placeholder="Software Engineer" disabled={!!savedEmployeeStringId} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 8900" disabled={!!savedEmployeeStringId} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {showBiometricSection && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Biometric Authentication</span>
                </div>

                {(biometricStatus?.registered || biometricJustRegistered) ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Biometric registered</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegisterBiometric}
                      disabled={biometricWorking}
                    >
                      {biometricWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-register"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Register this employee's fingerprint or Face ID so they can clock in using biometric on the terminal.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      variant="outline"
                      onClick={handleRegisterBiometric}
                      disabled={biometricWorking}
                    >
                      {biometricWorking ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Waiting for biometric…
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4 mr-2" />
                          Register Biometric
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DrawerFooter>
            {!employeeSaved ? (
              <Button type="submit" form="employee-form" disabled={isPending || isFetching}>
                {isPending ? "Saving..." : "Save Employee"}
              </Button>
            ) : isEditing ? (
              <Button type="submit" form="employee-form" disabled={isPending || isFetching}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
