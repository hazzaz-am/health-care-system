import z from "zod";

const createSpecialtySchema = z.object({
	title: z
		.string({ error: "Title is required" })
		.min(1, { error: "Title cannot be empty" }),
});

export const SpecialtiesValidation = {
	createSpecialtySchema,
};
