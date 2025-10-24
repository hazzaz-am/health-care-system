import z from "zod";

const createDoctorScheduleSchema = z.object({
  scheduleIds: z.array(z.string()),
})

export const DoctorScheduleValidation = {
  createDoctorScheduleSchema,
};