import { neon } from "@neondatabase/serverless";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` };
}
function templates(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6
    ? [{ number: 1, start: "10:00", end: "12:00" }, { number: 2, start: "12:00", end: "15:00" }, { number: 3, start: "15:00", end: "17:00" }]
    : [{ number: 1, start: "12:00", end: "15:00" }, { number: 2, start: "15:00", end: "17:00" }];
}
export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ success: false, message: "DATABASE_URL belum ditemukan" });
  const sql = neon(process.env.DATABASE_URL);
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }
    const date = req.query.date;
    if (!isValidDate(date)) return res.status(400).json({ success: false, message: "Parameter date wajib berformat YYYY-MM-DD" });
    const plan = templates(date);
    const payload = JSON.stringify(plan);
    await sql`
      INSERT INTO stock_sessions (business_date, session_number, start_time, end_time, status)
      SELECT ${date}::date, x.session_number, x.start_time::time, x.end_time::time, 'scheduled'
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(session_number INT, start_time TEXT, end_time TEXT)
      ON CONFLICT (business_date, session_number) DO NOTHING
    `;
    const now = jakartaNow();
    const rows = await sql`
      UPDATE stock_sessions
      SET status = CASE
        WHEN ${date} < ${now.date}::date THEN 'closed'
        WHEN ${date} = ${now.date}::date AND end_time <= ${now.time}::time THEN 'closed'
        WHEN ${date} = ${now.date}::date AND start_time <= ${now.time}::time AND end_time > ${now.time}::time THEN 'open'
        ELSE 'scheduled'
      END,
      opened_at = CASE
        WHEN ${date} = ${now.date}::date AND start_time <= ${now.time}::time AND end_time > ${now.time}::time THEN COALESCE(opened_at, NOW())
        ELSE opened_at
      END,
      closed_at = CASE
        WHEN (${date} < ${now.date}::date OR (${date} = ${now.date}::date AND end_time <= ${now.time}::time)) THEN COALESCE(closed_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
      WHERE business_date = ${date}::date
      RETURNING id, business_date, session_number, start_time, end_time, status, opened_at, closed_at
    `;
    const active = rows.find(row => row.status === "open") || null;
    return res.status(200).json({ success: true, business_date: date, day_type: plan.length === 3 ? "weekend" : "weekday", active_session: active, sessions: rows.sort((a,b) => a.session_number - b.session_number) });
  } catch (error) {
    console.error("Stock sessions API:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat sesi. Pastikan migration Tahap 5 sudah dijalankan." });
  }
}
