import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertTriangle, CalendarDays } from "lucide-react";

const dayField = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().min(1).max(24).nullable().optional()
);

const settingsSchema = z.object({
  officeStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be a valid time (HH:MM)"),
  lateThresholdMinutes: z.coerce.number().min(0, "Must be positive"),
  officeEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be a valid time (HH:MM)").optional().or(z.literal("")),
  workdayHours: z.coerce.number().min(1).max(24).optional().or(z.literal("")),
  mondayWorkdayHours: dayField,
  tuesdayWorkdayHours: dayField,
  wednesdayWorkdayHours: dayField,
  thursdayWorkdayHours: dayField,
  fridayWorkdayHours: dayField,
  saturdayWorkdayHours: dayField,
  sundayWorkdayHours: dayField,
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const DAY_FIELDS: { key: keyof SettingsFormValues; label: string }[] = [
  { key: "mondayWorkdayHours", label: "Monday" },
  { key: "tuesdayWorkdayHours", label: "Tuesday" },
  { key: "wednesdayWorkdayHours", label: "Wednesday" },
  { key: "thursdayWorkdayHours", label: "Thursday" },
  { key: "fridayWorkdayHours", label: "Friday" },
  { key: "saturdayWorkdayHours", label: "Saturday" },
  { key: "sundayWorkdayHours", label: "Sunday" },
];

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      officeStartTime: "09:00",
      lateThresholdMinutes: 15,
      officeEndTime: "17:00",
      workdayHours: 8,
      mondayWorkdayHours: null,
      tuesdayWorkdayHours: null,
      wednesdayWorkdayHours: null,
      thursdayWorkdayHours: null,
      fridayWorkdayHours: null,
      saturdayWorkdayHours: null,
      sundayWorkdayHours: null,
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        officeStartTime: settings.officeStartTime,
        lateThresholdMinutes: settings.lateThresholdMinutes,
        officeEndTime: settings.officeEndTime || "",
        workdayHours: settings.workdayHours || "",
        mondayWorkdayHours: settings.mondayWorkdayHours ?? null,
        tuesdayWorkdayHours: settings.tuesdayWorkdayHours ?? null,
        wednesdayWorkdayHours: settings.wednesdayWorkdayHours ?? null,
        thursdayWorkdayHours: settings.thursdayWorkdayHours ?? null,
        fridayWorkdayHours: settings.fridayWorkdayHours ?? null,
        saturdayWorkdayHours: settings.saturdayWorkdayHours ?? null,
        sundayWorkdayHours: settings.sundayWorkdayHours ?? null,
      });
    }
  }, [settings, form]);

  const defaultHours = form.watch("workdayHours");

  const onSubmit = (values: SettingsFormValues) => {
    updateMutation.mutate({
      data: {
        officeStartTime: values.officeStartTime,
        lateThresholdMinutes: values.lateThresholdMinutes,
        officeEndTime: values.officeEndTime || undefined,
        workdayHours: values.workdayHours ? Number(values.workdayHours) : undefined,
        mondayWorkdayHours: values.mondayWorkdayHours ?? null,
        tuesdayWorkdayHours: values.tuesdayWorkdayHours ?? null,
        wednesdayWorkdayHours: values.wednesdayWorkdayHours ?? null,
        thursdayWorkdayHours: values.thursdayWorkdayHours ?? null,
        fridayWorkdayHours: values.fridayWorkdayHours ?? null,
        saturdayWorkdayHours: values.saturdayWorkdayHours ?? null,
        sundayWorkdayHours: values.sundayWorkdayHours ?? null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="animate-pulse h-96 bg-muted rounded-xl"></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure organizational attendance rules.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Time Rules</CardTitle>
              <CardDescription>Default rules that apply to all days unless overridden below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="officeStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Office Start Time
                      </FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormDescription>Standard arrival time (e.g., 09:00 AM)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lateThresholdMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Late Threshold (Minutes)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>Grace period before being marked Late</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="officeEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Office End Time
                      </FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormDescription>Standard departure time</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workdayHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Default Required Hours
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="24" step="0.5" {...field} />
                      </FormControl>
                      <FormDescription>Total hours required per day (default for all days)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Day-Specific Hours
              </CardTitle>
              <CardDescription>
                Override the required hours for specific days of the week. Leave blank to use the default ({defaultHours || 8}h).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {DAY_FIELDS.map(({ key, label }) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            step="0.5"
                            placeholder={`${defaultHours || 8}h (default)`}
                            value={field.value == null ? "" : String(field.value)}
                            onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Example: set Thursday to 11 to require 11 working hours on Thursdays. Overtime and undertime are computed against each day's required hours.
              </p>
            </CardContent>
          </Card>

          <div className="max-w-2xl flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
