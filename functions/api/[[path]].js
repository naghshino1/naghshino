const DEPARTMENTS = [
  { id: "finance", name: "مدیر مالی", scope: "بودجه‌بندی و تحلیل مالی؛ بدون دسترسی بانکی خودکار" },
  { id: "marketing", name: "مدیر بازاریابی", scope: "تحقیق مخاطب، کمپین و تقویم محتوا" },
  { id: "sales", name: "مدیر محصول و فروش", scope: "کاتالوگ، قیف فروش و تحلیل سفارش" },
  { id: "operations", name: "مدیر عملیات", scope: "فرایندها، پیگیری و کنترل کیفیت" },
  { id: "research", name: "مدیر تحقیق و توسعه", scope: "تحقیق بازار، رقبا و فناوری" },
  { id: "support", name: "مدیر پشتیبانی", scope: "دسته‌بندی درخواست‌ها و پیش‌نویس پاسخ" }
];
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
async function audit(db, event, details = {}) {
  await db.prepare("INSERT INTO audit(id,event,details,created_at) VALUES(?,?,?,?)")
    .bind(id(), event, JSON.stringify(details), now()).run();
}
function authorized(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
}
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": env.CORS_ORIGIN || url.origin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type",
    "access-control-max-age": "86400"
  }});
  const db = env.DB;
  if (!db) return json({ error: "database_not_bound", message: "Bind a D1 database as DB." }, 503);
  const path = url.pathname.replace(/^\/api\/?/, "");
  if (path === "health" && request.method === "GET") return json({
    ok: true, service: "naghshino-company-os", aiConfigured: Boolean(env.AI_API_KEY && env.AI_MODEL)
  });
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  try {
    if (path === "agents" && request.method === "GET") return json({
      ceo: { id: "ceo", name: "مدیرعامل هوشمند", role: "برنامه‌ریزی و هماهنگی؛ پیشنهاد و تقسیم وظایف" },
      departments: DEPARTMENTS
    });
    if (path === "tasks" && request.method === "GET") {
      const { results } = await db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200").all();
      return json({ tasks: results });
    }
    if (path === "tasks" && request.method === "POST") {
      const body = await request.json();
      const title = String(body.title || "").trim();
      if (!title || title.length > 180) return json({ error: "title_required_max_180" }, 400);
      const department = DEPARTMENTS.some(d => d.id === body.department) ? body.department : "ceo";
      const taskId = id(), timestamp = now();
      await db.prepare("INSERT INTO tasks(id,title,description,department,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
        .bind(taskId, title, String(body.description || "").slice(0, 4000), department, "pending", timestamp, timestamp).run();
      await audit(db, "task.created", { id: taskId, title, department });
      return json({ task: await db.prepare("SELECT * FROM tasks WHERE id=?").bind(taskId).first() }, 201);
    }
    const taskMatch = path.match(/^tasks\/([^/]+)$/);
    if (taskMatch && request.method === "PATCH") {
      const body = await request.json();
      if (!["pending", "in_progress", "blocked", "done"].includes(body.status)) return json({ error: "invalid_status" }, 400);
      const result = await db.prepare("UPDATE tasks SET status=?,updated_at=? WHERE id=?")
        .bind(body.status, now(), taskMatch[1]).run();
      if (!result.meta.changes) return json({ error: "task_not_found" }, 404);
      await audit(db, "task.status_changed", { id: taskMatch[1], status: body.status });
      return json({ task: await db.prepare("SELECT * FROM tasks WHERE id=?").bind(taskMatch[1]).first() });
    }
    if (path === "ceo/plan" && request.method === "POST") {
      const body = await request.json();
      const goal = String(body.goal || "").trim();
      if (!goal || goal.length > 4000) return json({ error: "goal_required_max_4000" }, 400);
      if (!env.AI_API_KEY || !env.AI_MODEL) return json({ error: "ai_not_configured" }, 503);
      const base = (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { authorization: "Bearer " + env.AI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ model: env.AI_MODEL, temperature: 0.2, messages: [
          { role: "system", content: 'You are the owner-supervised CEO planner of Naghshino. Return only JSON: {"summary":"...","tasks":[{"title":"...","department":"finance|marketing|sales|operations|research|support","description":"..."}]}. Create 3-8 practical tasks. Never claim to execute anything. Mark sensitive external actions as requiring owner approval.' },
          { role: "user", content: goal }
        ] })
      });
      if (!response.ok) return json({ error: "model_provider_error", providerStatus: response.status }, 502);
      const payload = await response.json();
      const raw = payload.choices?.[0]?.message?.content || "";
      let plan;
      try { plan = JSON.parse(raw.replace(/^\x60\x60\x60json\s*/, "").replace(/\s*\x60\x60\x60$/, "")); }
      catch { return json({ error: "invalid_model_response" }, 502); }
      if (!Array.isArray(plan.tasks) || plan.tasks.length < 1 || plan.tasks.length > 8) return json({ error: "invalid_plan" }, 502);
      const created = [];
      for (const item of plan.tasks) {
        const title = String(item.title || "").trim().slice(0, 180);
        if (!title) continue;
        const taskId = id(), timestamp = now();
        const department = DEPARTMENTS.some(d => d.id === item.department) ? item.department : "research";
        await db.prepare("INSERT INTO tasks(id,title,description,department,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
          .bind(taskId, title, String(item.description || "").slice(0, 4000), department, "pending", timestamp, timestamp).run();
        created.push(await db.prepare("SELECT * FROM tasks WHERE id=?").bind(taskId).first());
      }
      await audit(db, "ceo.plan_created", { goal, taskIds: created.map(t => t.id) });
      return json({ summary: String(plan.summary || "برنامه اولیه ساخته شد."), tasks: created, execution: "not_started" }, 201);
    }
    if (path === "audit" && request.method === "GET") {
      const { results } = await db.prepare("SELECT * FROM audit ORDER BY created_at DESC LIMIT 100").all();
      return json({ events: results });
    }
    return json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("Naghshino API error", error);
    return json({ error: "internal_error" }, 500);
  }
}