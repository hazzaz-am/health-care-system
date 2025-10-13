import type { CookieOptions, Response } from "express";

interface IAuthTokens {
	accessToken?: string;
	refreshToken?: string;
}

export const setCookie = async (res: Response, tokenInfo: IAuthTokens) => {
	const options: CookieOptions = {
		secure: true,
		httpOnly: true,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	};

	if (tokenInfo.accessToken) {
		res.cookie("accessToken", tokenInfo.accessToken, options);
	}

	if (tokenInfo.refreshToken) {
		res.cookie("refreshToken", tokenInfo.refreshToken, options);
	}
};
