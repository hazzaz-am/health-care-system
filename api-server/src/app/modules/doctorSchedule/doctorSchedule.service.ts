import { Prisma, UserRole } from "@prisma/client";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import { AuthenticatedUser } from "../../types";
import { getPagination } from "../../helpers/getPagination";

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

const getDoctorSchedules = async (paginationOptions: any, filterOptions: any) => {
  const { page, limit, skip, sortBy, sortOrder } = getPagination(paginationOptions);
  const { isBooked: filterIsBooked } = filterOptions;

  const conditions: Prisma.DoctorSchedulesWhereInput[] = [];

  if (filterIsBooked) {
    conditions.push({
      AND:
      {
        isBooked: filterIsBooked
      }

    });
  }
  const whereConditions: Prisma.DoctorSchedulesWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const totalDoctorSchedules = await prisma.doctorSchedules.count({
    where: whereConditions
  });

  const doctorSchedules = await prisma.doctorSchedules.findMany({
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder
    },
    where: whereConditions
  });

  return {
    meta: {
      page,
      limit,
      totalPages: Math.ceil(totalDoctorSchedules / limit),
      total: totalDoctorSchedules,
    },
    data: doctorSchedules
  };

};

const deleteDoctorScheduleById = async (id: string) => {
  await prisma.doctorSchedules.deleteMany({
    where: {
      scheduleId: id
    }
  })
};

export const DoctorSchedulesService = {
  createDoctorSchedules,
  getDoctorSchedules,
  deleteDoctorScheduleById
};