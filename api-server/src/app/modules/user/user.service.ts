import { Request } from "express";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import bcrypt from "bcryptjs";
import { FileUploader } from "../../helpers/fileUploader";

/**
 * Create a new patient
 * @param payload - CreatePatientDto
 * @returns Patient profile
 */
const createPatient = async (req: Request) => {
	const payload = req.body;
	if (req.file) {
		const imageUrl = await FileUploader.uploadToCloudinary(req.file);
		payload.patient.profilePhoto = imageUrl?.secure_url;
	}
	const hashPassword = await bcrypt.hash(payload.password, config.salt_round);

	const result = await prisma.$transaction(async (tx) => {
		await tx.user.create({
			data: {
				email: payload.patient.email,
				password: hashPassword,
			},
		});

		const patient = await tx.patient.create({
			data: payload.patient,
		});

		return patient;
	});

	return result;
};

export const UserService = {
	createPatient,
};
