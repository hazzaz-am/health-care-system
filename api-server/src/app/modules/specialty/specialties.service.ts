import { Request } from "express";
import { FileUploader } from "../../helpers/fileUploader";
import { prisma } from "../../shared/prisma";

const createSpecialty = async (req: Request) => {
	const payload = req.body;

	if (req.file) {
		const imageUrl = await FileUploader.uploadToCloudinary(req.file);
		payload.icon = imageUrl?.secure_url;
	}

	const result = await prisma.specialties.create({
		data: payload,
	});
	return result;
};

const getAllSpecialties = async () => {
	const result = await prisma.specialties.findMany();
	return result;
};

const deleteSpecialtyById = async (id: string) => {

	const result = await prisma.specialties.delete({
		where: {
			id,
		},
	});
	return result;
};

export const SpecialtiesService = {
	createSpecialty,
	getAllSpecialties,
	deleteSpecialtyById,
};
