import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	salt_round: Number(process.env.SALT_ROUNDS),
	cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
	cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
	jwt: {
		accessToken: process.env.JWT_ACCESS_SECRET as string,
		refreshToken: process.env.JWT_REFRESH_SECRET as string,
		accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN as string,
		refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN as string,
	},
	superAdmin: {
		super_admin_email: process.env.SUPER_ADMIN_EMAIL as string,
		super_admin_password: process.env.SUPER_ADMIN_PASSWORD as string,
		super_admin_contact_number: process.env.SUPER_ADMIN_NUMBER as string,
	},
};
