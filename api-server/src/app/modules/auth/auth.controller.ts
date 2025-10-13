import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { AuthService } from "./auth.service";
import { setCookie } from "../../helpers/setCookie";
import sendResponse from "../../shared/sendResponse";

const credentialsLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.credentialsLogin(req.body);
	setCookie(res, {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
	});

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Logged in successfully",
		data: {
			needPasswordChange: result.needPasswordChange,
		},
	});
});

export const AuthController = {
	credentialsLogin,
};
