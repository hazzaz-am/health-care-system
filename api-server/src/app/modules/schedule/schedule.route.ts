import { Router } from "express";
import { ScheduleControllers } from "./schedule.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";
import { validateRequest } from "../../middlewares/validateRequest";
import { ScheduleSchemaValidation } from "./schedule.validation";

const router = Router();

router.post(
	"/",
	validateRequest(ScheduleSchemaValidation.createScheduleSchema),
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	ScheduleControllers.createSchedule
);

router.get(
	"/",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	ScheduleControllers.retrieveSchedules
);

router.delete(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	ScheduleControllers.deleteSchedule
);

export const scheduleRoutes = router;
