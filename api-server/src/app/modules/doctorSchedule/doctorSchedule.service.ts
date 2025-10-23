import { UserRole } from "@prisma/client";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import { AuthenticatedUser } from "../../types";

interface ICreateDoctorSchedulePayload {
  scheduleIds: string[];
}

const createDoctorSchedules = async (user: AuthenticatedUser, payload: ICreateDoctorSchedulePayload) => {
  if (user.role === UserRole.PATIENT) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You do not have access to this resources");
  }

  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: {
      email: user.email,
    }
  });

  const doctorScheduleData = payload.scheduleIds.map((scheduleId) => ({
    doctorId: doctor.id,
    scheduleId
  }));

  const doctorSchedules = await prisma.doctorSchedules.createMany({
    data: doctorScheduleData
  });

  return doctorSchedules;

};

export const DoctorSchedulesService = {
  createDoctorSchedules
};