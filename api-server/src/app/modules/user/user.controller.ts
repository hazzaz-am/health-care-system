import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { UserService } from "./user.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { UserRole, UserStatus } from "@prisma/client";
import { pickFields } from "../../helpers/pickFields";

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

/**
 * Create a new doctor
 */
const createDoctor = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.createDoctor(req);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Doctor created successfully",
		data: result,
	});
});

/**
 * Create a new admin
 */
const createAdmin = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.createAdmin(req);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Admin created successfully",
		data: result,
	});
});

/* The `getUsersFromDB` function is a controller function that handles the logic for retrieving users
from the database based on the provided filters and options. */
const getUsersFromDB = catchAsync(async (req: Request, res: Response) => {

	const options = pickFields(req.query, ["page", "limit", "sortBy", "sortOrder"])
	const filters = pickFields(req.query, ["searchTerm", "role", "status"])

	const result = await UserService.getUsersFromDB(filters, options);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const UserController = {
	createPatient,
	createDoctor,
	createAdmin,
	getUsersFromDB,
};
