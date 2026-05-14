import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, attendanceTable, employeesTable, settingsTable } from "@workspace/db";
import {
  TimeInBody,
  TimeOutBody,
  TimeOutParams,
  GetTodayAttendanceParams,
  ListAttendanceQueryParams,
  ListEmployeeHistoryQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getCurrentTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

function computeWorkingHours(timeIn: string, timeOut: string): number {
  const [h1, m1, s1] = timeIn.split(":").map(Number);
  const [h2, m2, s2] = timeOut.split(":").map(Number);
  const inSec = h1 * 3600 + m1 * 60 + (s1 || 0);
  const outSec = h2 * 3600 + m2 * 60 + (s2 || 0);
  return Math.max(0, (outSec - inSec) / 3600);
}

async function getSettings() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings;
}

async function getStatus(timeIn: string): Promise<string> {
  const settings = await getSettings();
  const officeStart = settings?.officeStartTime ?? "08:00";
  const threshold = settings?.lateThresholdMinutes ?? 15;

  const [oh, om] = officeStart.split(":").map(Number);
  const [th, tm] = timeIn.split(":").map(Number);

  const officeMinutes = oh * 60 + om + threshold;
  const timeInMinutes = th * 60 + tm;

  return timeInMinutes > officeMinutes ? "late" : "present";
}

function computeOvertimeUndertime(
  workingHours: number | null,
  workdayHours: number
): { overtimeHours: number | null; undertimeHours: number | null } {
  if (workingHours == null) return { overtimeHours: null, undertimeHours: null };
  const diff = workingHours - workdayHours;
  return {
    overtimeHours: diff > 0 ? Math.round(diff * 100) / 100 : 0,
    undertimeHours: diff < 0 ? Math.round(-diff * 100) / 100 : 0,
  };
}

function enrichRecords<T extends { workingHours: number | null }>(
  records: T[],
  workdayHours: number
): (T & { overtimeHours: number | null; undertimeHours: number | null })[] {
  return records.map((r) => ({ ...r, ...computeOvertimeUndertime(r.workingHours, workdayHours) }));
}

const ATTENDANCE_SELECT = {
  id: attendanceTable.id,
  employeeId: attendanceTable.employeeId,
  employeeName: employeesTable.fullName,
  department: employeesTable.department,
  date: attendanceTable.date,
  timeIn: attendanceTable.timeIn,
  timeOut: attendanceTable.timeOut,
  latitude: attendanceTable.latitude,
  longitude: attendanceTable.longitude,
  locationAddress: attendanceTable.locationAddress,
  timeOutLatitude: attendanceTable.timeOutLatitude,
  timeOutLongitude: attendanceTable.timeOutLongitude,
  timeOutLocationAddress: attendanceTable.timeOutLocationAddress,
  workingHours: attendanceTable.workingHours,
  status: attendanceTable.status,
  createdAt: attendanceTable.createdAt,
};

router.get("/attendance", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { date, employeeId, department, from, to, status } = params.data;

  let query = db
    .select(ATTENDANCE_SELECT)
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.employeeId))
    .$dynamic();

  const conditions = [];
  if (date) conditions.push(eq(attendanceTable.date, date));
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, employeeId));
  if (status) conditions.push(eq(attendanceTable.status, status));
  if (from) conditions.push(gte(attendanceTable.date, from));
  if (to) conditions.push(lte(attendanceTable.date, to));
  if (department) conditions.push(eq(employeesTable.department, department));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rawRecords = await query.orderBy(attendanceTable.date, attendanceTable.createdAt);
  const settings = await getSettings();
  const workdayHours = settings?.workdayHours ?? 8;
  res.json(enrichRecords(rawRecords, workdayHours));
});

router.post("/attendance", async (req: Request, res: Response): Promise<void> => {
  const parsed = TimeInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { employeeId, latitude, longitude, locationAddress } = parsed.data;
  const today = getToday();

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)));

  if (existing) {
    res.status(409).json({ error: "Already timed in today" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const timeIn = getCurrentTime();
  const status = await getStatus(timeIn);

  const [record] = await db
    .insert(attendanceTable)
    .values({
      employeeId,
      date: today,
      timeIn,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      locationAddress: locationAddress ?? null,
      status,
    })
    .returning();

  res.status(201).json({
    ...record,
    employeeName: employee.fullName,
    department: employee.department,
  });
});

router.patch("/attendance/:id/timeout", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = TimeOutParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = TimeOutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const timeOut = getCurrentTime();
  const workingHours = computeWorkingHours(existing.timeIn, timeOut);

  const updates: Record<string, unknown> = { timeOut, workingHours };
  if (parsed.data.timeOutLatitude != null) updates.timeOutLatitude = parsed.data.timeOutLatitude;
  if (parsed.data.timeOutLongitude != null) updates.timeOutLongitude = parsed.data.timeOutLongitude;
  if (parsed.data.timeOutLocationAddress) updates.timeOutLocationAddress = parsed.data.timeOutLocationAddress;

  const [record] = await db
    .update(attendanceTable)
    .set(updates)
    .where(eq(attendanceTable.id, params.data.id))
    .returning();

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, record.employeeId));

  res.json({
    ...record,
    employeeName: employee?.fullName ?? null,
    department: employee?.department ?? null,
  });
});

router.get("/attendance/today/:employeeId", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
  const params = GetTodayAttendanceParams.safeParse({ employeeId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const today = getToday();
  const [record] = await db
    .select(ATTENDANCE_SELECT)
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.employeeId))
    .where(and(eq(attendanceTable.employeeId, params.data.employeeId), eq(attendanceTable.date, today)));

  if (!record) { res.json({ record: null }); return; }
  const settings = await getSettings();
  const workdayHours = settings?.workdayHours ?? 8;
  const enriched = enrichRecords([record], workdayHours)[0];
  res.json({ record: enriched });
});

router.get("/attendance/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const params = ListEmployeeHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { employeeId, from, to } = params.data;

  let query = db
    .select(ATTENDANCE_SELECT)
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.employeeId))
    .$dynamic();

  const conditions = [eq(attendanceTable.employeeId, employeeId)];
  if (from) conditions.push(gte(attendanceTable.date, from));
  if (to) conditions.push(lte(attendanceTable.date, to));

  const rawRecords = await query.where(and(...conditions)).orderBy(attendanceTable.date);
  const settings = await getSettings();
  const workdayHours = settings?.workdayHours ?? 8;
  res.json(enrichRecords(rawRecords, workdayHours));
});

export default router;
