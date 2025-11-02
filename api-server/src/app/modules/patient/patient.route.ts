import { Router } from "express";
import { PatientController } from "./patient.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.get(
	"/",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	PatientController.getAllPatients
);

router.get(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR),
	PatientController.getPatientById
);

router.patch(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PATIENT),
	PatientController.updatePatientInfo
);

router.delete(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PATIENT),
	PatientController.deletePatientById
);

export const PatientRoutes = router;
