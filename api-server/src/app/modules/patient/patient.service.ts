import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import HttpStatus from "http-status";
import AppError from "../../errors/AppError";
import { getPagination } from "../../helpers/getPagination";
import { prisma } from "../../shared/prisma";
import { AuthenticatedUser } from "../../types";
import { PatientConstants } from "./patient.constants";
import { IPatientUpdatePayload } from "./patient.interface";

const getAllPatients = async (filters: any, options: any) => {
	const { limit, page, skip, sortBy, sortOrder } = getPagination(options);
	const { searchTerm, ...filtersData } = filters;

	const conditions: Prisma.PatientWhereInput[] = [];

	if (searchTerm) {
		conditions.push({
			OR: PatientConstants.PATIENT_SEARCHABLE_FIELDS.map((field) => ({
				[field]: {
					contains: searchTerm,
					mode: "insensitive",
				},
			})),
		});
	}

	if (Object.keys(filtersData).length > 0) {
		conditions.push({
			AND: Object.keys(filtersData).map((key) => ({
				[key]: filtersData[key as keyof typeof filtersData],
			})),
		});
	}

	const whereConditions: Prisma.PatientWhereInput =
		conditions.length > 0 ? { AND: conditions } : {};

	const totalPatients = await prisma.patient.count({ where: whereConditions });

	const patients = await prisma.patient.findMany({
		skip,
		take: limit,
		orderBy: { [sortBy]: sortOrder },
		where: whereConditions,
	});

	return {
		meta: {
			page,
			limit,
			totalPages: Math.ceil(totalPatients / limit),
			total: totalPatients,
		},
		data: patients,
	};
};

const getPatientById = async (id: string) => {
	const patient = await prisma.patient.findUniqueOrThrow({
		where: {
			id,
		},
	});

	return patient;
};

const updatePatientInfo = async (id: string, req: Request) => {
	const payload: Partial<IPatientUpdatePayload> = req.body;
	const user = req.user as AuthenticatedUser;

	const patientInfo = await prisma.patient.findUniqueOrThrow({
		where: {
			id,
		},
	});

	if (
		patientInfo.email !== user.email &&
		user.role !== UserRole.ADMIN &&
		user.role !== UserRole.SUPER_ADMIN
	) {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to update this patient's information"
		);
	}

	const updatedData = await prisma.patient.update({
		where: {
			id: patientInfo.id,
		},
		data: payload,
	});

	return updatedData;
};

const deletePatientById = async (
	id: string,
	loggedInUser: AuthenticatedUser | undefined
) => {
	const patientInfo = await prisma.patient.findUniqueOrThrow({
		where: {
			id,
		},
	});

	if (
		loggedInUser &&
		(patientInfo.email === loggedInUser.email ||
			loggedInUser.role === UserRole.ADMIN ||
			loggedInUser.role === UserRole.SUPER_ADMIN)
	) {
		await prisma.patient.delete({
			where: {
				id,
			},
		});
	} else {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to delete this patient"
		);
	}
};

export const PatientService = {
	getAllPatients,
	updatePatientInfo,
	getPatientById,
	deletePatientById,
};
