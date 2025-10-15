import z from "zod";

/**
 * Patient registration validation schema
 */
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

/**
 * Doctor registration validation schema
 */
const createDoctorSchema = z.object({
	password: z.string(),
	doctor: z.object({
		name: z.string({
			error: "Name is required",
		}),
		email: z.string({
			error: "Email is required",
		}),
		contactNumber: z.string({
			error: "Contact number is required",
		}),
		registrationNumber: z.string({
			error: "Registration number is required",
		}),
		experience: z.number({
			error: "Experience is required",
		}),
		gender: z.enum(["MALE", "FEMALE"], {
			error: "Gender is required",
		}),
		appointmentFee: z.number({
			error: "Appointment fee is required",
		}),
		qualification: z.string({
			error: "Qualification is required",
		}),
		currentWorkingPlace: z.string({
			error: "Current working place is required",
		}),
		designation: z.string({
			error: "Designation is required",
		}),
	}),
});

/**
 * Admin user validation schema
 */

const createAdminSchema = z.object({
	password: z.string(),
	admin: z.object({
		name: z.string({
			error: "Name is required",
		}),
		email: z.string({
			error: "Email is required",
		}),
		contactNumber: z.string({
			error: "Contact number is required",
		}),
	}),
});

export const UserValidation = {
	createPatientSchema,
	createDoctorSchema,
	createAdminSchema,
};
