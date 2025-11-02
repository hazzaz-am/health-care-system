import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import HttpStatus from "http-status";
import AppError from "../../errors/AppError";
import { getPagination } from "../../helpers/getPagination";
import { prisma } from "../../shared/prisma";
import { AuthenticatedUser } from "../../types";
import { AdminConstants } from "./admin.constants";
import { IAdminUpdatePayload } from "./admin.interface";

const getAllAdmins = async (filters: any, options: any) => {
	const { limit, page, skip, sortBy, sortOrder } = getPagination(options);
	const { searchTerm, ...filtersData } = filters;

	const conditions: Prisma.AdminWhereInput[] = [];

	if (searchTerm) {
		conditions.push({
			OR: AdminConstants.ADMIN_SEARCHABLE_FIELDS.map((field) => ({
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

	const whereConditions: Prisma.AdminWhereInput =
		conditions.length > 0 ? { AND: conditions } : {};

	const totalAdmins = await prisma.admin.count({ where: whereConditions });

	const admins = await prisma.admin.findMany({
		skip,
		take: limit,
		orderBy: { [sortBy]: sortOrder },
		where: whereConditions,
	});

	return {
		meta: {
			page,
			limit,
			totalPages: Math.ceil(totalAdmins / limit),
			total: totalAdmins,
		},
		data: admins,
	};
};

const getAdminById = async (id: string) => {
	const admin = await prisma.admin.findUniqueOrThrow({
		where: {
			id,
		},
	});

	return admin;
};

const updateAdminInfo = async (id: string, req: Request) => {
	const payload: Partial<IAdminUpdatePayload> = req.body;
	const user = req.user as AuthenticatedUser;

	const adminInfo = await prisma.admin.findUniqueOrThrow({
		where: {
			id,
		},
	});

	if (adminInfo.email !== user.email && user.role !== UserRole.SUPER_ADMIN) {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to update this admin's information"
		);
	}

	const updatedData = await prisma.admin.update({
		where: {
			id: adminInfo.id,
		},
		data: payload,
	});

	return updatedData;
};

const deleteAdminById = async (
	id: string,
	loggedInUser: AuthenticatedUser | undefined
) => {
	const adminInfo = await prisma.admin.findUniqueOrThrow({
		where: {
			id,
		},
	});

	if (
		loggedInUser &&
		(adminInfo.email === loggedInUser.email ||
			loggedInUser.role === UserRole.SUPER_ADMIN)
	) {
		await prisma.admin.delete({
			where: {
				id,
			},
		});
	} else {
		throw new AppError(
			HttpStatus.FORBIDDEN,
			"You are not authorized to delete this admin"
		);
	}
};

export const AdminService = {
	getAllAdmins,
	updateAdminInfo,
	getAdminById,
	deleteAdminById,
};
