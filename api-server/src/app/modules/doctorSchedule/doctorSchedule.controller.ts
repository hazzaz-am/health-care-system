import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { DoctorSchedulesService } from "./doctorSchedule.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";

const createDoctorSchedules = catchAsync(async (req: Request, res: Response) => {
  const result = await DoctorSchedulesService.createDoctorSchedules(req.user!, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Doctor schedules created successfully",
    data: result
  });
});

export const DoctorSchedulesController = {
  createDoctorSchedules
};