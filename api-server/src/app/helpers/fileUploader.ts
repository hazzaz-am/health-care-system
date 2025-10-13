import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import config from "../../config";
import httpStatus from "http-status";
import AppError from "../errors/AppError";

const storage = multer.diskStorage({
	destination: function (_req, _file, cb) {
		cb(null, path.join(process.cwd(), "/uploads"));
	},
	filename: function (_req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, file.fieldname + "-" + uniqueSuffix);
	},
});

const uploadImage = multer({ storage: storage });

export const uploadToCloudinary = async (file: Express.Multer.File) => {
	try {
		// Configuration
		cloudinary.config({
			cloud_name: config.cloudinary_cloud_name,
			api_key: config.cloudinary_api_key,
			api_secret: config.cloudinary_api_secret,
		});

		// Upload an image
		const uploadResult = await cloudinary.uploader.upload(
			file.path, // Path of the image file
			{
				public_id: file.filename,
			}
		);

		// Return the URL of the uploaded image
		return uploadResult;
	} catch (error: any) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			error?.message || "Failed to upload image to Cloudinary"
		);
	}
};

export const FileUploader = {
	uploadImage,
	uploadToCloudinary,
};
