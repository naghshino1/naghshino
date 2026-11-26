import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const adminToken = process.env.ADMIN_TOKEN || '';
const dataPath = process.env.DATABASE_PATH || './data/naghshino.sqlite';
fs.mkdirSync(path.dirname(path.resolve(dataPath)), { recursive: true });
const db = new Database(dataPath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 department TEXT NOT NULL DEFAULT 'ceo', status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL, action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL,
 decided_at TEXT, FOREIGN KEY(task_id) REFERENCES tasks(id)
);
CREATE TABLE IF NOT EXISTS audit (
 id TEXT PRIMARY KEY, event TEXT NOT NULL, details TEXT NOT NULL,
 created_at TEXT NOT NULL
);
`);
const departments = [
 {id:'finance',name:'مدیر مالی',scope:'بودجه‌بندی و تحلیل مالی؛ بدون دسترسی بانکی خودکار'},
 {id:'marketing',name:'مدیر بازاریابی',scope:'تحقیق مخاطب، کمپین و تقویم محتوا'},
 {id:'sales',name:'مدیر محصول و فروش',scope:'کاتالوگ، قیف فروش و تحلیل سفارش'},
 {id:'operations',name:'مدیر عملیات',scope:'فرایندها، پیگیری و کنترل کیفیت'},
 {id:'research',name:'مدیر تحقیق و توسعه',scope:'تحقیق بازار، رقبا و فناوری'},
 {id:'support',name:'مدیر پشتیبانی',scope:'دسته‌بندی درخواست‌ها و پیش‌نویس پاسخ'}
];
app.use(helmet());
app.use(express.json({limit:'256kb'}));
app.use((req,res,next)=>{
 const allowed=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
 const origin=req.headers.origin;
 if(origin && allowed.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');
 if(req.method==='OPTIONS') return res.sendStatus(204);
 next();
});
function audit(event,details={}) {
 db.prepare('INSERT INTO audit(id,event,details,created_at) VALUES(?,?,?,?)')
 .run(crypto.randomUUID(),event,JSON.stringify(details),new Date().toISOString());
}
function auth(req,res,next) {
 const supplied=String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');
 const a=Buffer.from(supplied), b=Buffer.from(adminToken);
 if(!adminToken || a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'unauthorized'});
 next();
}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'naghshino-company-os',aiConfigured:Boolean(process.env.AI_API_KEY&&process.env.AI_MODEL)}));
app.get('/api/agents',auth,(req,res)=>res.json({ceo:{id:'ceo',name:'مدیرعامل هوشمند',role:'برنامه‌ریزی و هماهنگی؛ پیشنهاد و تقسیم وظایف'},departments}));
app.get('/api/tasks',auth,(req,res)=>{
 const rows=db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200').all();
 res.json({tasks:rows});
});
app.post('/api/tasks',auth,(req,res)=>{
 const title=String(req.body?.title||'').trim();
 if(!title || title.length>180) return res.status(400).json({error:'title_required_max_180'});
 const department=departments.some(d=>d.id===req.body?.department)?req.body.department:'ceo';
 const id=crypto.randomUUID(), now=new Date().toISOString();
 db.prepare('INSERT INTO tasks(id,title,description,department,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
 .run(id,title,String(req.body?.description||'').slice(0,4000),department,'pending',now,now);
 audit('task.created',{id,title,department});
 res.status(201).json({task:db.prepare('SELECT * FROM tasks WHERE id=?').get(id)});
});
app.patch('/api/tasks/:id',auth,(req,res)=>{
 const status=req.body?.status;
 if(!['pending','in_progress','blocked','done'].includes(status)) return res.status(400).json({error:'invalid_status'});
 const result=db.prepare('UPDATE tasks SET status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),req.params.id);
 if(!result.changes) return res.status(404).json({error:'task_not_found'});
 audit('task.status_changed',{id:req.params.id,status});
 res.json({task:db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id)});
});
app.post('/api/approvals',auth,(req,res)=>{
 const taskId=String(req.body?.task_id||'');
 const action=String(req.body?.action||'').trim();
 if(!db.prepare('SELECT id FROM tasks WHERE id=?').get(taskId)) return res.status(404).json({error:'task_not_found'});
 if(!action || action.length>500) return res.status(400).json({error:'action_required'});
 const id=crypto.randomUUID(),now=new Date().toISOString();
 db.prepare('INSERT INTO approvals(id,task_id,action,status,created_at) VALUES(?,?,?,?,?)').run(id,taskId,action,'pending',now);
 audit('approval.requested',{id,taskId,action});
 res.status(201).json({approval:{id,task_id:taskId,action,status:'pending',created_at:now}});
});
app.post('/api/approvals/:id/decision',auth,(req,res)=>{
 const decision=req.body?.decision;
 if(!['approved','rejected'].includes(decision)) return res.status(400).json({error:'decision_must_be_approved_or_rejected'});
 const now=new Date().toISOString();
 const result=db.prepare('UPDATE approvals SET status=?,decided_at=? WHERE id=? AND status=?').run(decision,now,req.params.id,'pending');
 if(!result.changes) return res.status(404).json({error:'pending_approval_not_found'});
 audit('approval.decided',{id:req.params.id,decision});
 res.json({id:req.params.id,status:decision,decided_at:now});
});
app.get('/api/audit',auth,(req,res)=>res.json({events:db.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all()}));

// CEO planning: the model may propose tasks, but this endpoint never executes external actions.
let aiWindow={start:Date.now(),count:0};
app.post('/api/ceo/plan',auth,async(req,res)=>{
 const goal=String(req.body?.goal||'').trim();
 if(!goal || goal.length>4000) return res.status(400).json({error:'goal_required_max_4000'});
 const key=process.env.AI_API_KEY, model=process.env.AI_MODEL, base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
 if(!key || !model) return res.status(503).json({error:'ai_not_configured',message:'Set AI_API_KEY and AI_MODEL on the private backend host.'});
 const max=Number(process.env.MAX_AI_CALLS_PER_HOUR||30);
 if(Date.now()-aiWindow.start>3600000) aiWindow={start:Date.now(),count:0};
 if(aiWindow.count>=max) return res.status(429).json({error:'ai_hourly_limit_reached'});
 aiWindow.count++;
 const system=`You are the CEO planner of Naghshino, an owner-supervised company. Break the owner's goal into 3-8 concrete tasks. Return ONLY JSON: { "summary": string, "tasks": [{ "title": string, "department": one of finance,marketing,sales,operations,research,support, "description": string }] }. Do not propose payments, account changes, publishing, customer messages, deletion, or other external/irreversible actions without marking them as requiring human approval in the description. Do not claim to have executed anything.`;
 try {
  const response=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:goal}],temperature:0.2})});
  if(!response.ok) return res.status(502).json({error:'model_provider_error',status:response.status});
  const payload=await response.json();
  const raw=payload.choices?.[0]?.message?.content||'';
  const parsed=JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,''));
  if(!Array.isArray(parsed.tasks)||parsed.tasks.length<1||parsed.tasks.length>8) throw new Error('invalid_plan');
  const insert=db.prepare('INSERT INTO tasks(id,title,description,department,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)');
  const now=new Date().toISOString(),created=[];
  const tx=db.transaction(()=>{for(const t of parsed.tasks){
   const department=departments.some(d=>d.id===t.department)?t.department:'ceo';
   const id=crypto.randomUUID(),title=String(t.title||'').slice(0,180);
   if(!title) continue;
   insert.run(id,title,String(t.description||'').slice(0,4000),department,'pending',now,now);
   created.push(db.prepare('SELECT * FROM tasks WHERE id=?').get(id));
  }});
  tx(); audit('ceo.plan_created',{goal,taskIds:created.map(t=>t.id)});
  res.status(201).json({summary:String(parsed.summary||'برنامه اولیه ساخته شد.'),tasks:created,execution:'not_started'});
 } catch(error){audit('ceo.plan_failed',{message:String(error).slice(0,300)});res.status(502).json({error:'planning_failed',message:'The AI response could not be validated as a task plan.'});}
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'internal_error'});});
app.listen(port,host,()=>console.log('Naghshino API listening on '+host+':'+port));
