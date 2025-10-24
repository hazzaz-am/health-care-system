import { Router } from "express";
import { SpecialtiesController } from "./specialties.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { SpecialtiesValidation } from "./specialties.validation";
import { FileUploader } from "../../helpers/fileUploader";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/", FileUploader.uploadImage.single("file"), (req, res, next) => {
	req.body = SpecialtiesValidation.createSpecialtySchema.parse(
		JSON.parse(req.body.data)
	);
	return SpecialtiesController.createSpecialty(req, res, next);
});

router.get("/", SpecialtiesController.getAllSpecialties);

router.delete(
	"/:id",
	authorization(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	SpecialtiesController.deleteSpecialtyById
);

export const specialtiesRoutes = router;
