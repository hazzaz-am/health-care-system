import { Prisma, UserRole } from "@prisma/client";
import { getPagination } from "../../helpers/getPagination";
import { DoctorConstants } from "./doctor.constants";
import { prisma } from "../../shared/prisma";
import { IDoctorUpdatePayload } from "./doctor.interface";
import { AuthenticatedUser } from "../../types";
import HttpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Request } from "express";

const getAllDoctors = async (filters: any, options: any) => {
	const { limit, page, skip, sortBy, sortOrder } = getPagination(options);
	const { searchTerm, specialties, ...filtersData } = filters;

	const conditions: Prisma.DoctorWhereInput[] = [];

	if (searchTerm) {
		conditions.push({
			OR: DoctorConstants.DOCTOR_SEARCHABLE_FIELDS.map((field) => ({
				[field]: {
					contains: searchTerm,
					mode: "insensitive",
				},
			})),
		});
	}

	if (specialties && specialties.length > 0) {
		conditions.push({
			doctorSpecialties: {
				some: {
					specialties: {
						title: {
							contains: specialties,
							mode: "insensitive",
						},
					},
				},
			},
		});
	}

	if (Object.keys(filtersData).length > 0) {
		conditions.push({
			AND: Object.keys(filtersData).map((key) => ({
				[key]: filtersData[key as keyof typeof filtersData],
			})),
		});
	}

	const whereConditions: Prisma.DoctorWhereInput =
		conditions.length > 0 ? { AND: conditions } : {};

	const totalDoctors = await prisma.doctor.count({ where: whereConditions });

	const doctors = await prisma.doctor.findMany({
		skip,
		take: limit,
		orderBy: { [sortBy]: sortOrder },
		where: whereConditions,
		include: {
			doctorSpecialties: {
				include: {
					specialties: true,
				},
			},
		},
	});

	return {
		meta: {
			page,
			limit,
			totalPages: Math.ceil(totalDoctors / limit),
			total: totalDoctors,
		},
		data: doctors,
	};
};

const getDoctorById = async (id: string) => {
	const doctor = await prisma.doctor.findUniqueOrThrow({
		where: {
			id,
		},
	});

	return doctor;
};

const updateDoctorInfo = async (id: string, req: Request) => {
	const payload: Partial<IDoctorUpdatePayload> = req.body;
	const user = req.user as AuthenticatedUser;

	if (
		id !== user.id &&
		user.role !== UserRole.ADMIN &&
		user.role !== UserRole.SUPER_ADMIN
	) {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to update this doctor's information"
		);
	}

	const doctorInfo = await prisma.doctor.findUniqueOrThrow({
		where: {
			id,
		},
	});

	const { specialties, ...doctorData } = payload;

	return await prisma.$transaction(async (tnx) => {
		if (specialties && specialties.length > 0) {
			const deleteSpecialtyIds = specialties.filter(
				(specialty) => specialty.isDeleted
			);

			for (const specialty of deleteSpecialtyIds) {
				await tnx.doctorSpecialties.deleteMany({
					where: {
						doctorId: id,
						specialtiesId: specialty.specialtyId,
					},
				});
			}

			const createSpecialtyIds = specialties.filter(
				(specialty) => !specialty.isDeleted
			);

			for (const specialty of createSpecialtyIds) {
				await tnx.doctorSpecialties.create({
					data: {
						doctorId: id,
						specialtiesId: specialty.specialtyId,
					},
				});
			}
		}

		const updatedData = await tnx.doctor.update({
			where: {
				id: doctorInfo.id,
			},
			data: doctorData,
			include: {
				doctorSpecialties: {
					include: {
						specialties: true,
					},
				},
			},
		});

		return updatedData;
	});
};

const deleteDoctorById = async (
	id: string,
	loggedInUser: AuthenticatedUser | undefined
) => {
	if (
		loggedInUser &&
		(id === loggedInUser.id ||
			loggedInUser.role === UserRole.ADMIN ||
			loggedInUser.role === UserRole.SUPER_ADMIN)
	) {
		await prisma.doctor.delete({
			where: {
				id,
			},
		});
	} else {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to delete this doctor"
		);
	}
};

export const DoctorService = {
	getAllDoctors,
	updateDoctorInfo,
	getDoctorById,
	deleteDoctorById,
};
