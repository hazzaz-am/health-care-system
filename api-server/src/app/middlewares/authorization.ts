import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import httpStatus from 'http-status';
import { JwtTokens } from "../helpers/jwtTokens";
import config from "../../config";

// Define a proper type for the authenticated user
interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  // Add other fields from your JWT payload
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authorization = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Support both cookie and Authorization header
      const accessToken =
        req.cookies?.accessToken ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!accessToken) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Access token is missing. Please authenticate."
        );
      }

      // Verify token - this should throw specific errors for expired/invalid tokens
      const verifiedUser = JwtTokens.verifyToken(
        accessToken,
        config.jwt.accessToken
      ) as AuthenticatedUser;

      // Attach user to request
      req.user = verifiedUser;

      // Check role-based authorization
      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Access denied. You do not have permission to perform this action.`
        );
      }

      next();
    } catch (error) {
      // Let AppError instances pass through
      if (error instanceof AppError) {
        next(error);
        return;
      }

      // Handle JWT-specific errors
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          next(new AppError(httpStatus.UNAUTHORIZED, "Access token has expired"));
          return;
        }
        if (error.name === 'JsonWebTokenError') {
          next(new AppError(httpStatus.UNAUTHORIZED, "Invalid access token"));
          return;
        }
      }

      // Generic error fallback
      next(new AppError(httpStatus.UNAUTHORIZED, "Authentication failed"));
    }
  };
}