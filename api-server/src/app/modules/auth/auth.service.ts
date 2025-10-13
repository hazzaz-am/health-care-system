import { UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { LoginPayload } from "./auth.interface";
import bcrypt from "bcryptjs";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { UserTokens } from "../../helpers/userTokens";

const credentialsLogin = async (payload: LoginPayload) => {
	const user = await prisma.user.findUniqueOrThrow({
		where: {
			email: payload.email,
			status: UserStatus.ACTIVE,
		},
	});

	const isPasswordMatched = await bcrypt.compare(
		payload.password,
		user.password
	);
	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Password is incorrect");
	}

	const tokens = UserTokens.createUserTokens(user);

	return {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		needPasswordChange: user.needPasswordChange,
	};
};

export const AuthService = {
	credentialsLogin,
};
