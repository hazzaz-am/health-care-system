import { Gender, UserRole, UserStatus } from "@prisma/client";

interface CreatePatientDto {
	name: string;
	email: string;
	password: string;
}

interface CreateDoctorDto {
	email: string;
	password: string;
	name: string;
	contactNumber: string;
	registrationNumber: string;
	experience: number;
	gender: Gender;
	appointmentFee: number;
	qualification: "";
	currentWorkingPlace: "";
	designation: "";
}

interface CreateAdminDto {
	email: string;
	password: string;
	name: string;
	contactNumber: string;
}

interface GetUsersDto {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	searchTerm?: string;
	role?: UserRole;
	status?: UserStatus;
}

interface IOptions {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export type { CreatePatientDto, CreateDoctorDto, CreateAdminDto, GetUsersDto, IOptions };
