import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post("/login", validateRequest(AuthValidation.loginValidationSchema), AuthController.credentialsLogin);

export const authRoutes = router;