import express from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";

const router = express.Router();

const moduleRoutes = [
	{
		path: "/auth",
		route: authRoutes
	},
	{
		path: "/user",
		route: userRoutes,
	},
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
