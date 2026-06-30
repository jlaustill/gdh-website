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
    return new Response("Invalid JSON", { status: 400 });
  }

  let row;
  try {
    row = parseLocationBody(payload);
  } catch (error) {
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
