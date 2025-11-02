import bcrypt from "bcryptjs";
import config from "../../config";
import { prisma } from "../shared/prisma";
import { UserRole } from "@prisma/client";

export const seedSuperAdmin = async () => {
	try {
		const isSuperAdminExist = await prisma.user.findUnique({
			where: { email: config.superAdmin.super_admin_email },
		});

		if (isSuperAdminExist) {
			console.log("SUPER ADMIN ALREADY EXIST");
			return;
		}

		const hashPassword = await bcrypt.hash(
			config.superAdmin.super_admin_password,
			Number(config.salt_round)
		);

		const payload = {
			role: UserRole.SUPER_ADMIN,
			email: config.superAdmin.super_admin_email,
			password: hashPassword,
		};

		const superAdmin = await prisma.user.create({ data: payload });
		console.log("Super Admin created successfully");
		console.log(superAdmin);
	} catch (error) {
		console.error(error);
	}
};
