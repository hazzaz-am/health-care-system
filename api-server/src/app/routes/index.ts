import express from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";
import { scheduleRoutes } from "../modules/schedule/schedule.route";
import { doctorSchedules } from "../modules/doctorSchedule/doctorSchedule.route";

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
	{
		path: "/schedule",
		route: scheduleRoutes,
	},
	{
		path: "/doctor-schedule",
		route: doctorSchedules,
	},
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
