import { isAuthorized } from "./_lib/auth.js";
import { parseLocationBody } from "./_lib/parseLocation.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request.headers.get("Authorization"), env.LOCATION_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    // Reason only — never log the body, which contains geolocation PII.
    console.error("Rejected location POST: malformed JSON body");
    return new Response("Invalid JSON", { status: 400 });
  }

  let row;
  try {
    row = parseLocationBody(payload);
  } catch (error) {
    // error.message is a fixed validation string, not request data.
    console.error("Rejected location POST:", error.message);
    return new Response(error.message, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT INTO locations (recorded_at, latitude, longitude, accuracy, speed, heading) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(row.recordedAt, row.latitude, row.longitude, row.accuracy, row.speed, row.heading)
    .run();

  return new Response("OK", { status: 200 });
}
