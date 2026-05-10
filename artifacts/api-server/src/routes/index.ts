import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import biometricRouter from "./biometric";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(biometricRouter);

export default router;
