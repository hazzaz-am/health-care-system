import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import config from "../../config";

interface IErrorResponse {
	statusCode: number;
	success: false;
	message: string;
	error?: any;
}

const handleZodError = (err: ZodError): IErrorResponse => {
	const errors = err.issues.map((issue) => ({
		path: issue.path.join("."),
		message: issue.message,
	}));

	return {
		statusCode: httpStatus.BAD_REQUEST,
		success: false,
		message: "Validation error",
		error: errors,
	};
};

const handlePrismaValidationError = (
	err: Prisma.PrismaClientValidationError
): IErrorResponse => {
	return {
		statusCode: httpStatus.BAD_REQUEST,
		success: false,
		message: "Validation error",
		error: config.node_env === "production" ? null : err.message,
	};
};

const handlePrismaKnownError = (
	err: Prisma.PrismaClientKnownRequestError
): IErrorResponse => {
	let message = "Database error";
	let statusCode: number = httpStatus.BAD_REQUEST;

	// Handle unique constraint violation
	if (err.code === "P2002") {
		const target = (err.meta?.target as string[]) || [];
		message = `${target.join(", ")} already exists`;
	}
	// Handle foreign key constraint violation
	else if (err.code === "P2003") {
		message = "Foreign key constraint failed";
	}
	// Handle record not found
	else if (err.code === "P2025") {
		message = "Record not found";
		statusCode = httpStatus.NOT_FOUND;
	}

	return {
		statusCode,
		success: false,
		message,
		error: config.node_env === "production" ? null : err.meta,
	};
};

const globalErrorHandler = (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction
) => {
	let statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
	let success = false;
	let message = err.message || "Something went wrong!";
	let error = err;

	// Handle Zod validation errors
	if (err instanceof ZodError) {
		const simplified = handleZodError(err);
		statusCode = simplified.statusCode;
		message = simplified.message;
		error = simplified.error;
	}
	// Handle Prisma validation errors
	else if (err instanceof Prisma.PrismaClientValidationError) {
		const simplified = handlePrismaValidationError(err);
		statusCode = simplified.statusCode;
		message = simplified.message;
		error = simplified.error;
	}
	// Handle Prisma known request errors
	else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		const simplified = handlePrismaKnownError(err);
		statusCode = simplified.statusCode;
		message = simplified.message;
		error = simplified.error;
	}

	// Sanitize error in production
	if (config.node_env === "production") {
		// Don't expose internal error details in production
		error = {
			...(error?.statusCode && { statusCode: error.statusCode }),
			...(error?.name && { name: error.name }),
		};

		// Only include stack trace in development
		delete error.stack;
	}

	res.status(statusCode).json({
		statusCode,
		success,
		message,
		...(config.node_env !== "production" && { error }),
	});
};

export default globalErrorHandler;
