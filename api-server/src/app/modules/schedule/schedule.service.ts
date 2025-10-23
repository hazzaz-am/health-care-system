import { format, addMinutes, addHours } from 'date-fns';
import { prisma } from '../../shared/prisma';
import { getPagination } from '../../helpers/getPagination';
import { DoctorSchedules, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../types';

const createSchedule = async (payload: any) => {
  const { startTime, endTime, startDate, endDate } = payload;
  const intervalTime = 30;

  const schedules = [];
  const currentDate = new Date(startDate);
  const lastDate = new Date(endDate);

  while (currentDate <= lastDate) {
    const startDateTime = new Date(
      addMinutes(
        addHours(
          `${format(currentDate, "yyyy-MM-dd")}`,
          Number(startTime.split(":")[0])
        ),
        Number(startTime.split(":")[1])
      )
    );

    const endDateTime = new Date(
      addMinutes(
        addHours(
          `${format(currentDate, "yyyy-MM-dd")}`,
          Number(endTime.split(":")[0])
        ),
        Number(endTime.split(":")[1])
      )
    );

    while (startDateTime < endDateTime) {
      const slotStartDateTime = startDateTime;
      const slotEndDateTime = addMinutes(startDateTime, intervalTime);

      const scheduleData = {
        startDateTime: slotStartDateTime,
        endDateTime: slotEndDateTime
      };

      const existingSchedule = await prisma.schedule.findFirst({
        where: scheduleData
      });

      if (!existingSchedule) {
        const result = await prisma.schedule.create({ data: scheduleData });
        schedules.push(result);
      }
      slotStartDateTime.setMinutes(slotStartDateTime.getMinutes() + intervalTime);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedules;

};

const retrieveSchedules = async (user: AuthenticatedUser, paginationOptions: any, filterOptions: any) => {
  const { page, limit, skip, sortBy, sortOrder } = getPagination(paginationOptions);
  const { startDateTime: filterStartDateTime, endDateTime: filterEndDateTime } = filterOptions;

  const conditions: Prisma.ScheduleWhereInput[] = [];

  if (filterStartDateTime && filterEndDateTime) {
    conditions.push({
      AND: [
        {
          startDateTime: {
            gte: filterStartDateTime
          }
        },
        {
          endDateTime: {
            lte: filterEndDateTime
          }
        }
      ]
    });
  }

  const whereConditions: Prisma.ScheduleWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  let doctorSchedules: { scheduleId: string; }[] = [];
  let doctorScheduleIds: string[] = [];

  if (user.role === UserRole.DOCTOR) {
    doctorSchedules = await prisma.doctorSchedules.findMany({
      where: {
        doctor: {
          email: user.email
        }
      },
      select: {
        scheduleId: true
      }
    });
    doctorScheduleIds = doctorSchedules.map(schedule => schedule.scheduleId);
  }


  const totalSchedules = await prisma.schedule.count({
    where: {
      ...whereConditions,
      id: {
        notIn: doctorScheduleIds
      }
    }
  });

  const schedules = await prisma.schedule.findMany({
    skip,
    take: limit,
    where: {
      ...whereConditions,
      id: {
        notIn: doctorScheduleIds
      }
    },
    orderBy: {
      [sortBy]: sortOrder
    }
  });

  return {
    meta: {
      page,
      limit,
      totalPages: Math.ceil(totalSchedules / limit),
      total: totalSchedules
    },
    data: schedules
  };
};

const deleteSchedule = async (id: string) => {
  await prisma.schedule.delete({
    where: {
      id
    }
  });
  return null;
};

export const ScheduleServices = {
  createSchedule,
  retrieveSchedules,
  deleteSchedule
};