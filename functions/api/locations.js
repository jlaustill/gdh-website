import { parseRange, bucketSeconds } from "./_lib/range.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { start, end } = parseRange(url.searchParams, new Date());
  const bucket = bucketSeconds(start, end);

  // One row (the latest fix) per time bucket: full detail on short ranges,
  // an evenly downsampled trail on long ones. The final bucket always holds
  // the most recent point, so the marker stays current.
  const result = await env.DB.prepare(
    "SELECT MAX(recorded_at) AS recorded_at, latitude, longitude, accuracy, speed, heading " +
      "FROM locations WHERE recorded_at >= ?1 AND recorded_at <= ?2 " +
      "GROUP BY CAST(strftime('%s', recorded_at) / ?3 AS INTEGER) " +
      "ORDER BY recorded_at ASC",
  )
    .bind(start, end, bucket)
    .all();

  const body = JSON.stringify({ start, end, bucketSeconds: bucket, points: result.results });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}
