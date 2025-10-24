import { Router } from "express";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import { FileUploader } from "../../helpers/fileUploader";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

/**
 * Create a new Patient
 * @route POST /api/v1/user/create-patient
 */
router.post(
	"/create-patient",
	FileUploader.uploadImage.single("file"),
	(req, res, next) => {
		req.body = UserValidation.createPatientSchema.parse(
			JSON.parse(req.body.data)
		);
		return UserController.createPatient(req, res, next);
	}
);

/**
 * Create a new Doctor
 * @route POST /api/v1/user/create-doctor
 */
router.post(
	"/create-doctor",
	authorization(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DOCTOR),
	FileUploader.uploadImage.single("file"),
	(req, res, next) => {
		req.body = UserValidation.createDoctorSchema.parse(
			JSON.parse(req.body.data)
		);
		return UserController.createDoctor(req, res, next);
	}
);

/**
 * Create a new Admin
 * @route POST /api/v1/user/create-admin
 */
router.post(
	"/create-admin",
	authorization(UserRole.SUPER_ADMIN),
	FileUploader.uploadImage.single("file"),
	(req, res, next) => {
		req.body = UserValidation.createAdminSchema.parse(
			JSON.parse(req.body.data)
		);
		return UserController.createAdmin(req, res, next);
	}
);

router.get(
	"/",
	authorization(UserRole.SUPER_ADMIN, UserRole.ADMIN),
	UserController.getUsersFromDB
);

export const userRoutes = router;
