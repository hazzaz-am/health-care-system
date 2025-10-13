import z from "zod";

const createPatientSchema = z.object({
	password: z.string(),
	patient: z.object({
		name: z.string({
			error: "Name is required",
		}),
		email: z.string({
			error: "Email is required",
		}),
		address: z.string().optional(),
	}),
});

export const UserValidation = {
	createPatientSchema,
};
