import { Router } from "express";
import { DoctorSchedulesController } from "./doctorSchedule.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";
import { validateRequest } from "../../middlewares/validateRequest";
import { DoctorScheduleValidation } from "./doctorSchedule.validation";

const router = Router();

router.get(
	"/",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	DoctorSchedulesController.getDoctorSchedules
);

router.delete(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	DoctorSchedulesController.deleteDoctorScheduleById
);

router.post(
	"/",
	validateRequest(DoctorScheduleValidation.createDoctorScheduleSchema),
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	DoctorSchedulesController.createDoctorSchedules
);

export const doctorSchedules = router;
