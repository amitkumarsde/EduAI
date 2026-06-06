import type { UserDocument } from "../models/User.js";

// Augment Express' Request so authenticated handlers can read `req.user`
// (populated by the `protect` middleware).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

export {};
