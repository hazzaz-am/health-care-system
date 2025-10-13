import { User } from "@prisma/client";
import config from "../../config";
import { JwtTokens } from "./jwtTokens";

const createUserTokens = (user: User) => {
	const jwtPayload = {
		id: user.id,
		email: user.email,
		role: user.role,
	};

	const accessToken = JwtTokens.generateToken(
		jwtPayload,
		config.jwt.accessToken,
		config.jwt.accessTokenExpiresIn
	);

	const refreshToken = JwtTokens.generateToken(
		jwtPayload,
		config.jwt.refreshToken,
		config.jwt.refreshTokenExpiresIn
	);

	return {
		accessToken,
		refreshToken,
	};
};

export const UserTokens = {
	createUserTokens,
};
