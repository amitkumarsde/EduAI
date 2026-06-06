import type { Request, Response } from "express";
import type { Types } from "mongoose";
import User from "../models/User.js";
import Student from "../models/Student.js";
import { signToken } from "../middleware/auth.js";
import { normalizeClassLabel } from "../utils/classUtils.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, role?, class?, school? }
 * For students, also creates/links a Student analytics profile.
 */
export async function register(req: Request, res: Response) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role === "teacher" ? "teacher" : "student";
    const studentClass = normalizeClassLabel(req.body?.class) || null;
    const school = String(req.body?.school || "").trim() || null;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email." });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "An account with this email already exists." });
    }

    let studentId: Types.ObjectId | null = null;
    if (role === "student") {
      const student = await Student.create({
        name,
        class: studentClass || "Class 10",
        school: school || "Not specified",
      });
      studentId = student._id;
    }

    const user = new User({
      name,
      email,
      role,
      class: studentClass,
      school,
      student_id: studentId,
    });
    user.password = password; // hashed by pre('validate') hook
    await user.save();

    const token = signToken(user);
    return res
      .status(201)
      .json({ success: true, token, user: user.toSafeJSON() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
export async function login(req: Request, res: Response) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken(user);
    return res.status(200).json({ success: true, token, user: user.toSafeJSON() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * GET /api/v1/auth/me  (protected)
 */
export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  return res.status(200).json({ success: true, user: req.user.toSafeJSON() });
}

/**
 * PUT /api/v1/auth/me  (protected)
 * Body: { name?, display_name?, avatar_color?, bio? }
 */
export async function updateMe(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const name = req.body?.name;
    if (typeof name === "string" && name.trim()) {
      user.name = name.trim().slice(0, 100);
    }

    user.profile = user.profile || {
      display_name: "",
      avatar_color: "#4f46e5",
      bio: "",
    };
    if (typeof req.body?.display_name === "string") {
      user.profile.display_name = req.body.display_name.trim().slice(0, 100);
    }
    if (typeof req.body?.avatar_color === "string") {
      user.profile.avatar_color = req.body.avatar_color.trim().slice(0, 20);
    }
    if (typeof req.body?.bio === "string") {
      user.profile.bio = req.body.bio.trim().slice(0, 500);
    }

    await user.save();
    return res.status(200).json({ success: true, user: user.toSafeJSON() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Update profile error:", error);
    return res.status(500).json({ success: false, message });
  }
}
