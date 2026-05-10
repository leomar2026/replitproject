import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminsTable, employeesTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { signToken, requireAuth } from "../middlewares/auth.js";
import type { Request, Response } from "express";
import type { AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, role } = parsed.data;

  if (role === "employee") {
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.employeeId, username));

    if (!employee) {
      res.status(401).json({ error: "Employee not found" });
      return;
    }

    const token = signToken({
      id: employee.id,
      username: employee.fullName,
      role: "employee",
      employeeId: employee.employeeId,
    });

    res.json({ token, role: "employee", employeeId: employee.employeeId, username: employee.fullName });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, username));

  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ id: admin.id, username: admin.username, role: admin.role });
  res.json({ token, role: admin.role, employeeId: null, username: admin.username });
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: AuthPayload }).user;
  res.json({ token: "", role: user.role, employeeId: user.employeeId ?? null, username: user.username });
});

export default router;
