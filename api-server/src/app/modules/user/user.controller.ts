import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { UserService } from "./user.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";

/**
 * Create a new patient
 */
const createPatient = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.createPatient(req);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Patient created successfully",
		data: result,
	});
});

export const UserController = {
	createPatient,
};
