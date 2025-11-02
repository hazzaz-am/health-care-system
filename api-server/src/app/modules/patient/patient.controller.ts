import { pickFields } from "../../helpers/pickFields";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { PatientConstants } from "./patient.constants";
import { PatientService } from "./patient.service";

const getAllPatients = catchAsync(async (req, res) => {
	const options = pickFields(req.query, ["page, limit, sortBy, sortOrder"]);
	const filters = pickFields(
		req.query,
		PatientConstants.PATIENT_FILTERABLE_FIELDS
	);

	const result = await PatientService.getAllPatients(filters, options);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Patients retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getPatientById = catchAsync(async (req, res) => {
	const patientId = req.params.id;
	const result = await PatientService.getPatientById(patientId);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Patient retrieved successfully",
		data: result,
	});
});

const updatePatientInfo = catchAsync(async (req, res) => {
	const patientId = req.params.id;
	const result = await PatientService.updatePatientInfo(patientId, req);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Patient information updated successfully",
		data: result,
	});
});

const deletePatientById = catchAsync(async (req, res) => {
	const patientId = req.params.id;
	await PatientService.deletePatientById(patientId, req.user);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Patient deleted successfully",
		data: null,
	});
});

export const PatientController = {
	getAllPatients,
	updatePatientInfo,
	getPatientById,
	deletePatientById,
};
