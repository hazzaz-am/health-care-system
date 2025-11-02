import { pickFields } from "../../helpers/pickFields";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { AdminConstants } from "./admin.constants";
import { AdminService } from "./admin.service";

const getAllAdmins = catchAsync(async (req, res) => {
	const options = pickFields(req.query, ["page, limit, sortBy, sortOrder"]);
	const filters = pickFields(
		req.query,
		AdminConstants.ADMIN_FILTERABLE_FIELDS
	);

	const result = await AdminService.getAllAdmins(filters, options);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Admins retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getAdminById = catchAsync(async (req, res) => {
	const adminId = req.params.id;
	const result = await AdminService.getAdminById(adminId);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Admin retrieved successfully",
		data: result,
	});
});

const updateAdminInfo = catchAsync(async (req, res) => {
	const adminId = req.params.id;
	const result = await AdminService.updateAdminInfo(adminId, req);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Admin information updated successfully",
		data: result,
	});
});

const deleteAdminById = catchAsync(async (req, res) => {
	const adminId = req.params.id;
	await AdminService.deleteAdminById(adminId, req.user);
	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Admin deleted successfully",
		data: null,
	});
});

export const AdminController = {
	getAllAdmins,
	updateAdminInfo,
	getAdminById,
	deleteAdminById,
};
