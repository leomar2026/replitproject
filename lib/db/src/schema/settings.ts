import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  officeStartTime: text("office_start_time").notNull().default("08:00"),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(15),
  officeEndTime: text("office_end_time").notNull().default("17:00"),
  workdayHours: real("workday_hours").notNull().default(8),
  mondayWorkdayHours: real("monday_workday_hours"),
  tuesdayWorkdayHours: real("tuesday_workday_hours"),
  wednesdayWorkdayHours: real("wednesday_workday_hours"),
  thursdayWorkdayHours: real("thursday_workday_hours"),
  fridayWorkdayHours: real("friday_workday_hours"),
  saturdayWorkdayHours: real("saturday_workday_hours"),
  sundayWorkdayHours: real("sunday_workday_hours"),
  companyName: text("company_name"),
  companyLogo: text("company_logo"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
