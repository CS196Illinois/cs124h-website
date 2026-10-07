import { NextResponse } from "next/server";

/** User-facing error messages shared by the API routes. */
export const MESSAGES = {
  SERVER_ERROR: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff.",
  SIGN_IN: "Please sign in to continue.",
  NO_PERMISSION: "You do not have permission to do that.",
  INVALID_INPUT: "Please check the information you entered and try again.",
};

export const jsonError = (message, status) => NextResponse.json({ error: message }, { status });

export const serverError = () => jsonError(MESSAGES.SERVER_ERROR, 500);
/** 401 for a missing session; some routes answer 403 for a signed-in caller of the wrong role. */
export const signInRequired = (status = 401) => jsonError(MESSAGES.SIGN_IN, status);
export const forbidden = () => jsonError(MESSAGES.NO_PERMISSION, 403);
export const invalidInput = () => jsonError(MESSAGES.INVALID_INPUT, 400);
