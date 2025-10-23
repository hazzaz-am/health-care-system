import { Router } from "express";
import { ScheduleControllers } from "./schedule.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/", authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN), ScheduleControllers.createSchedule);
router.get("/", authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR), ScheduleControllers.retrieveSchedules);
router.delete("/:id", authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN), ScheduleControllers.deleteSchedule);

export const scheduleRoutes = router;