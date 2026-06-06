import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User, { type UserDocument, type UserRole } from "../models/User.js";

interface AuthTokenPayload {
  id: string;
  role: UserRole;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "dev_insecure_secret_change_me";
}

/**
 * Sign a JWT for a user document.
 */
export function signToken(user: UserDocument): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    getJwtSecret(),
    options,
  );
}

/**
 * Express middleware: require a valid Bearer token.
 * Attaches `req.user` (the User document) on success.
 */
export async function protect(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({ success: false, message: "User no longer exists." });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

/**
 * Express middleware factory: require one of the given roles.
 * Must be used after `protect`.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res
        .status(403)
        .json({ success: false, message: "You do not have access to this resource." });
      return;
    }
    next();
  };
}

export default protect;
