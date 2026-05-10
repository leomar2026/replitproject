import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateEmployee, useUpdateEmployee, useGetEmployee, getListEmployeesQueryKey, getGetEmployeeQueryKey } from "@workspace/api-client-react";
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

const employeeSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  fullName: z.string().min(1, "Full name is required"),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  phone: z.string().optional(),
  biometricId: z.string().optional(),
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

  const { data: employeeData, isFetching } = useGetEmployee(employeeId as number, {
    query: { enabled: open && isEditing, queryKey: getGetEmployeeQueryKey(employeeId as number) }
  });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeId: "",
      fullName: "",
      department: "",
      position: "",
      phone: "",
      biometricId: "",
    }
  });

  useEffect(() => {
    if (open && !isEditing) {
      form.reset({
        employeeId: "",
        fullName: "",
        department: "",
        position: "",
        phone: "",
        biometricId: "",
      });
    } else if (open && isEditing && employeeData) {
      form.reset({
        employeeId: employeeData.employeeId,
        fullName: employeeData.fullName,
        department: employeeData.department,
        position: employeeData.position,
        phone: employeeData.phone || "",
        biometricId: employeeData.biometricId || "",
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
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({ title: "Failed to update", description: err.message, variant: "destructive" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => {
            toast({ title: "Employee created" });
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({ title: "Failed to create", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
          
          <div className="p-4 pb-0">
            {isFetching ? (
               <div className="animate-pulse space-y-4">
                 {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded"></div>)}
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
                          <Input placeholder="EMP-001" disabled={isEditing} {...field} />
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
                          <Input placeholder="John Doe" {...field} />
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
                          <Input placeholder="Engineering" {...field} />
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
                          <Input placeholder="Software Engineer" {...field} />
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
                          <Input placeholder="+1 234 567 8900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="biometricId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biometric ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Hardware ID mapping" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}
          </div>
          
          <DrawerFooter>
            <Button type="submit" form="employee-form" disabled={isPending || isFetching}>
              {isPending ? "Saving..." : "Save Employee"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}