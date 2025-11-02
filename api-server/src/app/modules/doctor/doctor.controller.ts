import { pickFields } from "../../helpers/pickFields";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { DoctorConstants } from "./doctor.constants";
import { DoctorService } from "./doctor.service";

const getAllDoctors = catchAsync(async (req, res) => {
	const options = pickFields(req.query, ["page, limit, sortBy, sortOrder"]);
	const filters = pickFields(
		req.query,
		DoctorConstants.DOCTOR_FILTERABLE_FIELDS
	);

	const result = await DoctorService.getAllDoctors(filters, options);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Doctors retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getDoctorById = catchAsync(async (req, res) => {
	const doctorId = req.params.id;
	const result = await DoctorService.getDoctorById(doctorId);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Doctor retrieved successfully",
		data: result,
	});
});

const updateDoctorInfo = catchAsync(async (req, res) => {
	const doctorId = req.params.id;
	const result = await DoctorService.updateDoctorInfo(doctorId, req);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Doctor information updated successfully",
		data: result,
	});
});

const deleteDoctorById = catchAsync(async (req, res) => {
	const doctorId = req.params.id;
	await DoctorService.deleteDoctorById(doctorId, req.user);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Doctor deleted successfully",
		data: null,
	});
});

export const DoctorController = {
	getAllDoctors,
	updateDoctorInfo,
	getDoctorById,
	deleteDoctorById,
};
