import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { DoctorSchedulesService } from "./doctorSchedule.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { pickFields } from "../../helpers/pickFields";

const createDoctorSchedules = catchAsync(async (req: Request, res: Response) => {
  const result = await DoctorSchedulesService.createDoctorSchedules(req.user!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Doctor schedules created successfully",
    data: result
  });
});

const getDoctorSchedules = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pickFields(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const filterOptions = pickFields(req.query, ["isBooked"]);
  const result = await DoctorSchedulesService.getDoctorSchedules(paginationOptions, filterOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor schedules retrieve successfully",
    data: result.data,
    meta: result.meta
  });
});

const deleteDoctorScheduleById = catchAsync(async (req: Request, res: Response) => {
  await DoctorSchedulesService.deleteDoctorScheduleById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor schedule deleted successfully",
    data: null
  });
});

export const DoctorSchedulesController = {
  createDoctorSchedules,
  getDoctorSchedules,
  deleteDoctorScheduleById
};