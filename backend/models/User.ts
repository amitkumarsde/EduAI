import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "teacher" | "student";

export interface UserProfile {
  display_name: string;
  avatar_color: string;
  bio: string;
}

/**
 * Application user (authentication).
 * A user can be a "teacher" or a "student". When a student registers,
 * a linked Student profile is created so the existing analytics pipeline
 * (exams, topic health, quizzes) continues to work unchanged.
 */
export interface IUser {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  student_id: Types.ObjectId | null;
  class: string | null;
  school: string | null;
  profile: UserProfile;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SafeUser {
  id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  student_id: Types.ObjectId | null;
  class: string | null;
  school: string | null;
  profile: UserProfile;
}

export interface IUserMethods {
  comparePassword(plainPassword: string): Promise<boolean>;
  toSafeJSON(): SafeUser;
}

// Write-only virtual: assigning `user.password` triggers hashing.
export interface IUserVirtuals {
  password: string;
}

export type UserModel = Model<
  IUser,
  Record<string, never>,
  IUserMethods,
  IUserVirtuals
>;
export type UserDocument = HydratedDocument<
  IUser,
  IUserMethods & IUserVirtuals
>;

// Transient field set by the `password` virtual and consumed in pre('validate').
type UserDocumentWithPlain = UserDocument & { _plainPassword?: string };

const userSchema = new Schema<IUser, UserModel, IUserMethods, {}, IUserVirtuals>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["teacher", "student"],
      default: "student",
    },
    // For students, link to the analytics Student profile.
    student_id: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    // Convenience fields captured at sign-up (mainly for students).
    class: { type: String, default: null },
    school: { type: String, default: null },
    // Editable profile.
    profile: {
      display_name: { type: String, default: "" },
      avatar_color: { type: String, default: "#4f46e5" },
      bio: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// Hash the password whenever it is set via the virtual `password`.
userSchema.virtual("password").set(function setPassword(
  this: UserDocumentWithPlain,
  plainPassword: string,
) {
  this._plainPassword = plainPassword;
});

// Hash in pre('validate') so password_hash is set before the required-field
// validation runs (validation runs before the 'save' hook in Mongoose).
userSchema.pre("validate", async function hashPassword(this: UserDocumentWithPlain) {
  if (!this._plainPassword) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this._plainPassword, salt);
  this._plainPassword = undefined;
});

userSchema.methods.comparePassword = function comparePassword(
  this: UserDocument,
  plainPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, this.password_hash);
};

userSchema.methods.toSafeJSON = function toSafeJSON(this: UserDocument): SafeUser {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    student_id: this.student_id,
    class: this.class,
    school: this.school,
    profile: {
      display_name: this.profile?.display_name || "",
      avatar_color: this.profile?.avatar_color || "#4f46e5",
      bio: this.profile?.bio || "",
    },
  };
};

const User = model<IUser, UserModel>("User", userSchema);

export default User;
