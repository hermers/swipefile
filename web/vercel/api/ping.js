// Daily keep-alive. Vercel Cron calls this once a day (see vercel.json), and it
// asks the Swipefile backend for its health, which reads the database. That
// activity stops the free Supabase project from pausing, which would make the
// Share shortcuts fail.
const HEALTH_URL = "https://cbxhjtbqhlpxrnsundju.supabase.co/functions/v1/inspo/health";

export async function GET(request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Anyone else is turned away.
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const res = await fetch(HEALTH_URL, { headers: { "x-swipefile-key": process.env.SWIPEFILE_KEY ?? "" } });
  const body = await res.text();
  console.log(`swipefile health ${res.status}: ${body}`);
  return new Response(body, { status: res.ok ? 200 : 502, headers: { "content-type": "application/json" } });
}
