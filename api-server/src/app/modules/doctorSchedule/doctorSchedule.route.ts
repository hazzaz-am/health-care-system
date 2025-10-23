import { Router } from "express";
import { DoctorSchedulesController } from "./doctorSchedule.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.get("/", DoctorSchedulesController.getDoctorSchedules);
router.delete("/:id", DoctorSchedulesController.deleteDoctorScheduleById);
router.post("/", authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR), DoctorSchedulesController.createDoctorSchedules);


export const doctorSchedules = router;