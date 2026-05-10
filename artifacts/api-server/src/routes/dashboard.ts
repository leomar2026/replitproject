import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, attendanceTable, employeesTable, settingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/dashboard/stats", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const today = getToday();

  const [{ totalEmployees }] = await db
    .select({ totalEmployees: sql<number>`count(*)::int` })
    .from(employeesTable);

  const todayRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today));

  const presentToday = todayRecords.length;
  const lateToday = todayRecords.filter((r) => r.status === "late").length;
  const onTimeToday = todayRecords.filter((r) => r.status === "present").length;
  const absentToday = Math.max(0, totalEmployees - presentToday);
  const attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees) * 100 : 0;

  res.json({ totalEmployees, presentToday, lateToday, absentToday, onTimeToday, attendanceRate });
});

router.get("/dashboard/departments", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const today = getToday();

  const departments = await db
    .select({ department: employeesTable.department })
    .from(employeesTable)
    .groupBy(employeesTable.department);

  const results = await Promise.all(
    departments.map(async ({ department }) => {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(employeesTable)
        .where(eq(employeesTable.department, department));

      const [{ present }] = await db
        .select({ present: sql<number>`count(*)::int` })
        .from(attendanceTable)
        .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.employeeId))
        .where(and(eq(attendanceTable.date, today), eq(employeesTable.department, department)));

      return { department, present: present ?? 0, total: total ?? 0 };
    })
  );

  res.json(results);
});

router.get("/dashboard/weekly", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const results = await Promise.all(
    days.map(async (date) => {
      const records = await db
        .select()
        .from(attendanceTable)
        .where(eq(attendanceTable.date, date));

      return {
        date,
        count: records.length,
        lateCount: records.filter((r) => r.status === "late").length,
      };
    })
  );

  res.json(results);
});

router.get("/dashboard/recent", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const records = await db
    .select({
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
      workingHours: attendanceTable.workingHours,
      status: attendanceTable.status,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.employeeId))
    .orderBy(sql`${attendanceTable.createdAt} DESC`)
    .limit(10);

  res.json(records);
});

router.get("/settings", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({}).returning();
  }
  res.json(settings);
});

router.patch("/settings", requireAuth, async (req: Request, res: Response): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({}).returning();
  }

  const [updated] = await db
    .update(settingsTable)
    .set(req.body)
    .where(eq(settingsTable.id, settings.id))
    .returning();

  res.json(updated);
});

export default router;
