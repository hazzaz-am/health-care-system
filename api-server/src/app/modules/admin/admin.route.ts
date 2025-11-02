import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authorization } from "../../middlewares/authorization";
import { UserRole } from "@prisma/client";

const router = Router();

router.get(
	"/",
	authorization(UserRole.SUPER_ADMIN),
	AdminController.getAllAdmins
);

router.get(
	"/:id",
	authorization(UserRole.SUPER_ADMIN, UserRole.ADMIN),
	AdminController.getAdminById
);

router.patch(
	"/:id",
	authorization(UserRole.SUPER_ADMIN, UserRole.ADMIN),
	AdminController.updateAdminInfo
);

router.delete(
	"/:id",
	authorization(UserRole.SUPER_ADMIN),
	AdminController.deleteAdminById
);

export const AdminRoutes = router;
