import { Router } from "express";
import { UserController } from "./user.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";
import { FileUploader } from "../../helpers/fileUploader";

const router = Router();

/**
 * Create a new patient
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

export const userRoutes = router;
