import { NextFunction, Request, Response } from "express";
import { ZodObject } from "zod";

export const validateRequest =
	(schema: ZodObject) =>
	async (req: Request, _res: Response, next: NextFunction) => {
		try {
			await schema.parseAsync({
				body: req.body,
			});
			next();
		} catch (error) {
			next(error);
		}
	};
