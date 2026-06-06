import type { Request, Response } from "express";
import ProctorEvent, { type ProctorEventType } from "../models/ProctorEvent.js";

const VALID_TYPES: ProctorEventType[] = [
  "tab_hidden",
  "window_blur",
  "no_face",
  "multiple_faces",
  "looking_away",
  "fullscreen_exit",
];

/**
 * POST /api/v1/proctor/events
 * Body: { session_id, context?, events: [{ type, detail?, at? }] }
 * Accepts a batch of proctoring signals captured client-side.
 */
export async function logProctorEvents(req: Request, res: Response) {
  try {
    const sessionId = String(req.body?.session_id || "").trim();
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "session_id is required." });
    }

    const context = String(req.body?.context || "");
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : [];
    const docs = rawEvents
      .filter((e: any) => VALID_TYPES.includes(e?.type))
      .map((e: any) => ({
        user_id: req.user?._id ?? null,
        session_id: sessionId,
        context,
        type: e.type as ProctorEventType,
        detail: String(e?.detail || ""),
        at: e?.at ? new Date(e.at) : new Date(),
      }));

    if (docs.length) {
      await ProctorEvent.insertMany(docs);
    }

    return res.status(201).json({ success: true, data: { logged: docs.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("logProctorEvents error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * GET /api/v1/proctor/events/:sessionId — integrity summary for one session.
 */
export async function getSessionEvents(req: Request, res: Response) {
  try {
    const events = await ProctorEvent.find({ session_id: req.params.sessionId })
      .sort({ at: 1 })
      .lean();
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
    return res.status(200).json({
      success: true,
      data: { total: events.length, counts, events },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}
