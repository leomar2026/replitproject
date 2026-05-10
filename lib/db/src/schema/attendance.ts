import { pgTable, text, serial, timestamp, doublePrecision, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  date: text("date").notNull(),
  timeIn: text("time_in").notNull(),
  timeOut: text("time_out"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationAddress: text("location_address"),
  workingHours: real("working_hours"),
  status: text("status").notNull().default("present"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
