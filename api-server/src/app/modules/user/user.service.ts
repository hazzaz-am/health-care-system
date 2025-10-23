import { Request } from "express";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import bcrypt from "bcryptjs";
import { FileUploader } from "../../helpers/fileUploader";
import { Prisma, UserRole } from "@prisma/client";
import { getPagination } from "../../helpers/getPagination";
import { UserConstants } from "./user.constants";

/**
 * Create a new patient
 * @param req - Request
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

/**
 * Create a new doctor
 * @param req - Request
 * @returns Doctor profile
 */
const createDoctor = async (req: Request) => {
	const payload = req.body;
	if (req.file) {
		const imageUrl = await FileUploader.uploadToCloudinary(req.file);
		payload.doctor.profilePhoto = imageUrl?.secure_url;
	}

	const hashPassword = await bcrypt.hash(payload.password, config.salt_round);

	const result = await prisma.$transaction(async (tx) => {
		await tx.user.create({
			data: {
				email: payload.doctor.email,
				password: hashPassword,
				role: UserRole.DOCTOR,
			},
		});

		const doctor = await tx.doctor.create({
			data: payload.doctor,
		});

		return doctor;
	});

	return result;
};

/**
 *
 * @param req Request
 * @returns Admin Profile
 */
const createAdmin = async (req: Request) => {
	const payload = req.body;
	if (req.file) {
		const imageUrl = await FileUploader.uploadToCloudinary(req.file);
		payload.admin.profilePhoto = imageUrl?.secure_url;
	}

	const hashPassword = await bcrypt.hash(payload.password, config.salt_round);

	const result = await prisma.$transaction(async (tx) => {
		await tx.user.create({
			data: {
				email: payload.admin.email,
				password: hashPassword,
				role: UserRole.ADMIN,
			},
		});

		const admin = await tx.admin.create({
			data: payload.admin,
		});

		return admin;
	});

	return result;
};

/**
 * The function `getUsersFromDB` retrieves users from a database based on specified filters and
 * pagination options.
 * @param {any} filters - The `filters` parameter in the `getUsersFromDB` function is an object that
 * contains filter criteria for querying users from the database. It may include properties such as
 * `searchTerm` for searching users based on a keyword and other properties for filtering users based
 * on specific conditions.
 * @param {any} options - The `options` parameter in the `getUsersFromDB` function is used for
 * pagination and sorting purposes. It contains the following properties:
 * @returns The function `getUsersFromDB` returns an object with two properties:
 * 1. `meta`: An object containing information about pagination, including `page`, `limit`, and
 * `total`.
 * 2. `data`: An array of user objects that match the specified filters and pagination options.
 */
const getUsersFromDB = async (filters: any, options: any) => {

	const { page, limit, skip, sortBy, sortOrder } = getPagination(options);
	const { searchTerm, ...filtersData } = filters;

	const conditions: Prisma.UserWhereInput[] = [];

	if (searchTerm) {
		conditions.push({
			OR:
				UserConstants.searchableFields.map((field) => ({
					[field]: {
						contains: searchTerm,
						mode: "insensitive",
					}
				}))
		})
	}

	if (Object.keys(filtersData).length > 0) {
		conditions.push({
			AND: Object.keys(filtersData).map(key => ({
				[key]: filtersData[key as keyof typeof filtersData]
			}))
		})
	}

	const whereConditions: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

	const totalUsers = await prisma.user.count({
		where: whereConditions
	});

	const users = await prisma.user.findMany({
		skip,
		take: limit,
		where: whereConditions,
		orderBy: { [sortBy]: sortOrder }
	});

	return {
		meta: {
			page,
			limit,
			totalPages: Math.ceil(totalUsers / limit),
			total: totalUsers,
		},
		data: users,
	};
};

export const UserService = {
	createPatient,
	createDoctor,
	createAdmin,
	getUsersFromDB,
};
