import { NextResponse } from "next/server";
import { listPrairieLearnMps } from "../../../../lib/prairielearn";
import { forbidden } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";
import { MP_MANAGE_ROLES } from "../../../../lib/mps";

/** The course's MPs on PrairieLearn, so the MP editor can fill in names and links. */
export async function GET() {
  const { role } = await getSessionUser();
  if (!MP_MANAGE_ROLES.includes(role)) return forbidden();
  return NextResponse.json(await listPrairieLearnMps());
}
