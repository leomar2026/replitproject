import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, attendanceTable, employeesTable } from "@workspace/db";
import { ExportReportQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/reports/export", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const params = ExportReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { format, from, to, employeeId, department } = params.data;

  let query = db
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
    .$dynamic();

  const conditions = [];
  if (from) conditions.push(gte(attendanceTable.date, from));
  if (to) conditions.push(lte(attendanceTable.date, to));
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, employeeId));
  if (department) conditions.push(eq(employeesTable.department, department));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const records = await query.orderBy(attendanceTable.date);

  if (format === "json") {
    res.json(records);
    return;
  }

  const headers = [
    "Date",
    "Employee ID",
    "Employee Name",
    "Department",
    "Time In",
    "Time Out",
    "Working Hours",
    "GPS Location",
    "Address",
    "Status",
  ];

  const rows = records.map((r) => [
    r.date ?? "",
    r.employeeId ?? "",
    r.employeeName ?? "",
    r.department ?? "",
    r.timeIn ?? "",
    r.timeOut ?? "",
    r.workingHours != null ? r.workingHours.toFixed(2) : "",
    r.latitude != null && r.longitude != null ? `${r.latitude},${r.longitude}` : "",
    r.locationAddress ?? "",
    r.status ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const filename = `attendance_report_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
