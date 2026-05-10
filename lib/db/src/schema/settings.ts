import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  officeStartTime: text("office_start_time").notNull().default("08:00"),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(15),
  officeEndTime: text("office_end_time").notNull().default("17:00"),
  workdayHours: real("workday_hours").notNull().default(8),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
