import { NextFunction, Request, Response } from "express";
import { ZodObject } from "zod";

export const validateRequest =
	(schema: ZodObject) =>
		async (req: Request, _res: Response, next: NextFunction) => {
			try {
				await schema.parseAsync(req.body);
				return next();
			} catch (error) {
				next(error);
			}
		};
