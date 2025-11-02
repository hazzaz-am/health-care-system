import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.get("/", DoctorController.getAllDoctors);

router.get("/:id", DoctorController.getDoctorById);

router.patch(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	DoctorController.updateDoctorInfo
);

router.delete(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	DoctorController.deleteDoctorById
);

export const DoctorRoutes = router;
