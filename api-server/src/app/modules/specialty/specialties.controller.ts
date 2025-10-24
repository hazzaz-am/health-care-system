import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { SpecialtiesService } from "./specialties.service";

const createSpecialty = catchAsync(async (req: Request, res: Response) => {
	const response = await SpecialtiesService.createSpecialty(req);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Specialty created successfully",
		data: response,
	});
});

const getAllSpecialties = catchAsync(async (_req: Request, res: Response) => {
	const response = await SpecialtiesService.getAllSpecialties();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Specialties retrieved successfully",
		data: response,
	});
});

const deleteSpecialtyById = catchAsync(async (req: Request, res: Response) => {
	const result = await SpecialtiesService.deleteSpecialtyById(req.params.id);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Specialty deleted successfully",
		data: result,
	});
});

export const SpecialtiesController = {
	createSpecialty,
	getAllSpecialties,
	deleteSpecialtyById,
};
