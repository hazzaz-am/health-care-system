import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { ScheduleServices } from "./schedule.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from 'http-status';
import { pickFields } from "../../helpers/pickFields";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
  const result = await ScheduleServices.createSchedule(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Schedule created successfully",
    data: result,
  });
});

const retrieveSchedules = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pickFields(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const filterOptions = pickFields(req.query, ["startDateTime", "endDateTime"]);
  const result = await ScheduleServices.retrieveSchedules(req.user!, paginationOptions, filterOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedules retrieve successfully",
    data: result.data,
    meta: result.meta
  });
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
  await ScheduleServices.deleteSchedule(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Schedule deleted successfully",
    data: null
  });
});

export const ScheduleControllers = {
  createSchedule,
  retrieveSchedules,
  deleteSchedule
};