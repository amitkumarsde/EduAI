// models/ProctorEvent.ts
//
// Records integrity / proctoring signals captured in the browser during a
// monitored quiz or exam (tab switches, missing face, multiple faces, looking
// away). Used to flag attempts for review.

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type ProctorEventType =
  | "tab_hidden"
  | "window_blur"
  | "no_face"
  | "multiple_faces"
  | "looking_away"
  | "fullscreen_exit";

export interface IProctorEvent {
  user_id: Types.ObjectId | null;
  session_id: string; // client-generated id grouping one exam session
  context: string; // "adaptive" | "institute:<examCode>" etc.
  type: ProctorEventType;
  detail: string;
  at: Date;
  createdAt?: Date;
}

export type ProctorEventDocument = HydratedDocument<IProctorEvent>;

const proctorEventSchema = new Schema<IProctorEvent>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    session_id: { type: String, required: true, index: true },
    context: { type: String, default: "" },
    type: {
      type: String,
      enum: [
        "tab_hidden",
        "window_blur",
        "no_face",
        "multiple_faces",
        "looking_away",
        "fullscreen_exit",
      ],
      required: true,
    },
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const ProctorEvent = model<IProctorEvent>("ProctorEvent", proctorEventSchema);

export default ProctorEvent;
