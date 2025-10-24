import z from "zod";

const createScheduleSchema = z.object({
	startTime: z.string({ error: "Start time must be string" }),
	endTime: z.string({ error: "End time must be string" }),
	startDate: z.string({ error: "Start date must be string" }),
	endDate: z.string({ error: "End date must be string" }),
});

export const ScheduleSchemaValidation = {
	createScheduleSchema,
};
