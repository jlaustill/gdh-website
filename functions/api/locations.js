import { parseRange, MAX_POINTS } from "./_lib/range.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { start, end } = parseRange(url.searchParams, new Date());

  const result = await env.DB.prepare(
    "SELECT recorded_at, latitude, longitude, accuracy, speed, heading " +
      "FROM locations WHERE recorded_at >= ? AND recorded_at <= ? " +
      "ORDER BY recorded_at ASC LIMIT ?",
  )
    .bind(start, end, MAX_POINTS)
    .all();

  const body = JSON.stringify({ start, end, points: result.results });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}
