"use strict";
const CRYPTO_HUES = {BTC:"#ff9f1c",ETH:"#8c9eff",HYPE:"#2ef2c8",PUMP:"#7dff6a",AERO:"#3da9ff",UNI:"#ff4fb8",LINK:"#4f7bff",RAY:"#c86bff"};
const FX_PAIRS = ["USD/JPY","EUR/JPY","EUR/USD","AUD/USD","USD/CHF","GBP/USD","CHF/JPY","NZD/JPY"];
const FX_HUES = {"USD/JPY":"#ff5f6d","EUR/JPY":"#ffa94d","EUR/USD":"#4dabf7","AUD/USD":"#ffd43b","USD/CHF":"#e64980","GBP/USD":"#9775fa","CHF/JPY":"#ff8787","NZD/JPY":"#20c997"};
const ROLE_HUES = {Scout:"#22e6ff",Tape:"#ffd23d",Fundamentals:"#7dff6a",Catalyst:"#ff8a3d",Bull:"#39ff88",Bear:"#ff3b5c",Risk:"#ff3df2",PM:"#ffffff"};
const ROLE_DESC = {Scout:"screens universe",Tape:"price & volume",Fundamentals:"SEC filings",Catalyst:"news & events",Bull:"long thesis",Bear:"short thesis",Risk:"limits & sizing",PM:"final call"};
const POLL_MS = 3000;
const bots = {};          // id -> {el, state, lastDecTs, lastFillTs, lastFileMtime, until}
let firstLoad = true;
let lastData = null;

const fmtUsd = (v, d=2) => v==null||isNaN(v) ? "—" : (v<0?"-":"") + "$" + Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtSigned = (v, d=2) => v==null||isNaN(v) ? "—" : (v>0?"+":v<0?"-":"±") + "$" + Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtPx = v => v==null ? "—" : v>=1000 ? v.toLocaleString(undefined,{maximumFractionDigits:0}) : v>=1 ? v.toFixed(3) : v.toPrecision(4);
const cls = v => v>0 ? "pos" : v<0 ? "neg" : "";
const ago = ts => { if(!ts) return "—"; const s = Math.max(0, Date.now()/1000 - ts); return s<60? Math.floor(s)+"s ago" : s<3600? Math.floor(s/60)+"m ago" : s<86400? Math.floor(s/3600)+"h ago" : Math.floor(s/86400)+"d ago"; };
const tfmt = ts => new Date(ts*1000).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"});
const esc = s => String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function robotSVG(hue, variant){
  const headR = variant%3===0 ? 14 : variant%3===1 ? 4 : 9;
  return `<svg class="robot" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="g${variant}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4778"/><stop offset="1" stop-color="#151b3a"/></linearGradient></defs>
   <g class="think-dots" fill="${hue}"><circle cx="84" cy="10" r="2.4"/><circle cx="92" cy="6" r="3"/><circle cx="101" cy="2.5" r="3.6"/></g>
   <g class="r-body">
     <rect x="36" y="56" width="38" height="36" rx="9" fill="url(#g${variant})" stroke="${hue}" stroke-opacity=".6"/>
     <rect x="46" y="64" width="18" height="10" rx="2" fill="#050915" stroke="${hue}" stroke-opacity=".5"/>
     <rect class="core" x="49" y="67" width="12" height="4" rx="1" fill="${hue}"><animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite"/></rect>
   </g>
   <g class="r-armL"><rect x="26" y="60" width="9" height="30" rx="4.5" fill="#2a3462" stroke="${hue}" stroke-opacity=".5"/><circle cx="30.5" cy="92" r="4.5" fill="${hue}" opacity=".85"/></g>
   <g class="r-armR"><rect x="75" y="60" width="9" height="30" rx="4.5" fill="#2a3462" stroke="${hue}" stroke-opacity=".5"/><circle cx="79.5" cy="92" r="4.5" fill="${hue}" opacity=".85"/></g>
   <g class="r-head">
     <line x1="55" y1="14" x2="55" y2="4" stroke="#8a9ad0" stroke-width="2"/>
     <circle class="r-antenna-tip" cx="55" cy="4" r="3.4" fill="${hue}"/>
     <rect x="31" y="14" width="48" height="38" rx="${headR}" fill="url(#g${variant})" stroke="${hue}" stroke-width="1.5"/>
     <rect x="36" y="22" width="38" height="20" rx="8" fill="#03060f"/>
     <g class="eyes"><ellipse class="r-eye" cx="47" cy="32" rx="4.5" ry="5" fill="${hue}"/><ellipse class="r-eye" cx="63" cy="32" rx="4.5" ry="5" fill="${hue}"/>
       <circle class="r-pupil" cx="47" cy="32" r="1.6" fill="#fff"/><circle class="r-pupil" cx="63" cy="32" r="1.6" fill="#fff"/></g>
     <g class="x-eyes" stroke="#ff3b5c" stroke-width="2.5" stroke-linecap="round"><path d="M43 28l8 8M51 28l-8 8M59 28l8 8M67 28l-8 8"/></g>
     <rect x="28" y="27" width="3" height="10" rx="1.5" fill="${hue}" opacity=".7"/><rect x="79" y="27" width="3" height="10" rx="1.5" fill="${hue}" opacity=".7"/>
   </g>
  </svg>`;
}

function makeDesk(container, id, name, hue, sub, variant){
  const el = document.createElement("div");
  el.className = "desk watching";
  el.style.setProperty("--hue", hue);
  el.innerHTML = `<div class="monitor"><div class="mon-body">booting…</div></div>
    <div class="halt-tag">HALTED</div>
    <div class="bubble"></div>
    ${robotSVG(hue, variant)}
    <div class="table"><div class="keyboard"></div></div>
    <div class="nameplate"><b>${esc(name)}</b> · ${esc(sub)}</div>`;
  container.appendChild(el);
  bots[id] = {el, state:"watching", lastDecTs:null, lastFillTs:null, lastFileMtime:null, until:0, idleFlip: Date.now() + Math.random()*8000};
  makeMini(id,name,hue,sub,variant);
  return bots[id];
}

function setPose(b, pose){
  if (b.state === pose) return;
  if (b.mini){ b.mini.classList.remove("typing","watching","thinking","halted"); b.mini.classList.add(pose); }
  b.el.classList.remove("typing","watching","thinking","halted");
  b.el.classList.add(pose);
  b.state = pose;
}
function say(b, text, ms=5000){
  const bub = b.el.querySelector(".bubble");
  bub.textContent = text; bub.classList.add("show");
  clearTimeout(b.bubT); b.bubT = setTimeout(()=>bub.classList.remove("show"), ms);
}
function coins(b, n=6){
  for (let i=0;i<n;i++){
    const c = document.createElement("div"); c.className="coin"; c.textContent="$";
    c.style.setProperty("--dx", (Math.random()*90-45)+"px"); c.style.animationDelay = (i*0.12)+"s";
    b.el.appendChild(c); setTimeout(()=>c.remove(), 2200);
  }
  b.el.classList.remove("flash-green"); void b.el.offsetWidth; b.el.classList.add("flash-green");
}
function lossFx(b, amt){
  const d = document.createElement("div"); d.className="lossfx"; d.textContent = fmtSigned(amt);
  b.el.appendChild(d); setTimeout(()=>d.remove(), 1800);
  b.el.classList.remove("flash-red"); void b.el.offsetWidth; b.el.classList.add("flash-red");
}

function renderCryptoBot(bot, c){
  const b = bots["c:"+bot.name];
  const d = bot.last_decision;
  const p = bot.position;
  const holding = Math.abs(p.qty) > 1e-12;
  let status = "WATCHING";
  if (c.halted) status = "HALTED";
  else if (holding) status = "IN POSITION";
  else if (d && d.action === "enter") status = "ENTERING";
  else if (d && d.action === "escalate") status = "ESCALATED";
  const conf = d && d.confidence!=null ? (d.confidence*100).toFixed(0)+"%" : "—";
  b.el.querySelector(".mon-body").innerHTML = `
    <div class="mon-head"><span>${bot.name}</span><span class="status-pill">${status}</span></div>
    <div class="mon-row"><span>mid</span><b>${fmtPx(bot.mid)}</b></div>
    <div class="mon-row"><span>last</span><b>${d? esc(d.action)+" · "+esc(d.direction): "—"}</b></div>
    <div class="mon-row"><span>${d? esc(d.regime||"") : "regime"}</span><b>conf ${conf}</b></div>
    <div class="mon-row"><span>pos</span><b>${holding ? p.qty.toPrecision(4)+" @ "+fmtPx(p.avg_px) : "flat"}</b></div>
    <div class="mon-row"><span>P&amp;L</span><b class="${cls(bot.pnl)}">${fmtSigned(bot.pnl)}</b></div>
    <div class="mon-reason">${d ? esc(d.reason)+" · "+ago(d.ts) : "no decision yet"}</div>`;
  b.el.querySelector(".mon-body").title = `decisions ${bot.decisions} · fills ${bot.fills} (W${bot.wins}/L${bot.losses}) · misses ${bot.misses} · escalations ${bot.escalations} · fees ${fmtUsd(bot.fees)}`;
  const now = Date.now();
  // new decision -> type for a bit
  if (d && d.ts !== b.lastDecTs){
    if (!firstLoad){ b.until = now + 7000; b.nextPose = d.action === "escalate" ? "thinking" : "watching"; setPose(b, "typing"); }
    b.lastDecTs = d.ts;
  }
  // new fill -> speech bubble + fx
  const f = bot.last_fill;
  if (f && f.ts !== b.lastFillTs){
    if (!firstLoad){
      const verb = f.exit ? "CLOSED" : (f.side === "buy" ? "BOUGHT" : "SOLD");
      say(b, `${verb} ${f.qty.toPrecision(3)} ${bot.name} @ ${fmtPx(f.px)}` + (f.exit ? ` ${fmtSigned(f.pnl)}` : ""), 7000);
      if (f.exit && f.pnl > 0) coins(b, 8); else if (f.exit && f.pnl < 0) lossFx(b, f.pnl); else coins(b, 3);
    }
    b.lastFillTs = f.ts;
  }
  if (c.halted){ setPose(b, "halted"); b.el.classList.add("halted"); return; }
  b.el.classList.remove("halted");
  if (now < b.until) return;
  if (b.nextPose){ setPose(b, b.nextPose); b.nextPose = null; b.until = now + 9000; return; }
  busyIdle(b, now);
}

function busyIdle(b, now){
  // when nothing is happening, alternate watching / brief typing bursts / thinking so the floor feels alive
  if (now > b.idleFlip){
    const r = Math.random();
    setPose(b, r < 0.55 ? "watching" : r < 0.85 ? "typing" : "thinking");
    b.idleFlip = now + 2500 + Math.random()*6000;
  }
}

function renderDeskBot(role, desk, halted){
  const b = bots["d:"+role.role];
  const body = b.el.querySelector(".mon-body");
  b.el.classList.toggle("offline", !desk.available);
  if (!desk.available){
    body.innerHTML = `<div class="mon-head"><span>${role.role}</span><span class="status-pill">OFFLINE</span></div>
      <div class="mon-reason">research desk not built yet</div><div class="mon-reason">waiting for the research desk…</div>`;
    busyIdle(b, Date.now()); return;
  }
  const status = role.status === "active" ? "ACTIVE" : "WATCHING";
  let extra = "";
  if (role.count != null) extra += `<div class="mon-row"><span>${esc(role.unit||"items")}</span><b>${role.count}</b></div>`;
  if (role.role === "PM") extra += `<div class="mon-row"><span>book eq</span><b>${fmtUsd(desk.portfolio_equity,0)}</b></div>`;
  if (role.role === "Risk") extra += `<div class="mon-row"><span>withheld</span><b>${desk.tickets_today_withheld}</b></div>`;
  if (role.role === "Bull" || role.role === "Bear") extra += `<div class="mon-row"><span>ledger</span><b>${desk.ledger_graded}/${desk.ledger_rows} graded</b></div>`;
  body.innerHTML = `<div class="mon-head"><span>${role.role}</span><span class="status-pill">${status}</span></div>
    <div class="mon-row"><span>src</span><b>${role.file ? esc(role.file.split("/").slice(-2).join("/")) : "—"}</b></div>
    <div class="mon-row"><span>updated</span><b>${role.mtime ? ago(role.mtime) : "—"}</b></div>
    ${extra}
    <div class="mon-reason" style="white-space:normal;max-height:28px;line-height:1.25">${role.headline ? esc(role.headline) : "watching: waiting for today's report"}</div>`;
  const now = Date.now();
  if (role.mtime && role.mtime !== b.lastFileMtime){
    if (!firstLoad && b.lastFileMtime !== null){ say(b, `filed ${role.file.split("/").pop()}`, 6000); b.until = now + 8000; setPose(b, "typing"); }
    b.lastFileMtime = role.mtime;
  }
  if (halted){ setPose(b,"halted"); b.el.classList.add("halted"); return; }
  b.el.classList.remove("halted");
  if (now < b.until) return;
  if (role.mtime && now/1000 - role.mtime < 600 && Math.random() < 0.5){ setPose(b, "typing"); b.until = now + 4000; return; }
  busyIdle(b, now);
}

const fxPx = (s, v) => v==null ? "—" : v.toFixed(s.includes("JPY") ? 3 : 5);
function renderFxBot(bot, f){
  const b = bots["f:"+bot.name];
  const d = bot.last_decision, p = bot.position;
  const holding = Math.abs(p.qty) > 1e-9;
  let status = "WATCHING";
  if (f.halted) status = "HALTED";
  else if (!f.market_open) status = "MKT CLOSED";
  else if (holding) status = p.qty > 0 ? "LONG" : "SHORT";
  else if (bot.last_block && d && bot.last_block.ts >= d.ts - 1) status = "BLOCKED";
  else if (d && d.action === "enter") status = "ENTERING";
  else if (d && d.action === "escalate") status = "ESCALATED";
  const conf = d && d.confidence!=null ? (d.confidence*100).toFixed(0)+"%" : "—";
  const blockTxt = bot.last_block ? `blocked: ${bot.last_block.why} · ${ago(bot.last_block.ts)}` : (d && d.entry_block ? `blocked: ${d.entry_block}` : null);
  const body = b.el.querySelector(".mon-body");
  body.innerHTML = `
    <div class="mon-head"><span>${bot.name}</span><span class="status-pill">${status}</span></div>
    <div class="mon-row"><span>mid</span><b>${fxPx(bot.name, bot.mid)}${bot.spread_bps!=null?` · ${(+bot.spread_bps).toFixed(1)}bp`:""}</b></div>
    <div class="mon-row"><span>last</span><b>${d? esc(d.action)+" · "+esc(d.direction): "—"}</b></div>
    <div class="mon-row"><span>${d? esc(d.regime||"") : "regime"}</span><b>conf ${conf}</b></div>
    <div class="mon-row"><span>pos</span><b>${holding ? Math.round(p.qty).toLocaleString()+"u @ "+fxPx(bot.name,p.avg_px) : "flat"}</b></div>
    <div class="mon-row"><span>P&amp;L · fin</span><b><span class="${cls(bot.pnl)}">${fmtSigned(bot.pnl)}</span> · ${fmtSigned(bot.financing)}</b></div>
    <div class="mon-reason" ${blockTxt?'style="color:#ffb35c"':""}>${blockTxt ? esc(blockTxt) : d ? esc(d.reason)+" · "+ago(d.ts) : "no decision yet"}</div>`;
  body.title = `decisions ${bot.decisions} · fills ${bot.fills} (W${bot.wins}/L${bot.losses}) · blocked ${bot.blocks} · escalations ${bot.escalations} · spread cost ${fmtUsd(bot.spread_cost)} · financing ${fmtSigned(bot.financing)} · selection: ${(bot.selection_reason||[]).join("; ")}`;
  const now = Date.now();
  if (d && d.ts !== b.lastDecTs){
    if (!firstLoad){ b.until = now + 7000; b.nextPose = d.action === "escalate" ? "thinking" : "watching"; setPose(b, "typing"); }
    b.lastDecTs = d.ts;
  }
  const fl = bot.last_fill;
  if (fl && fl.ts !== b.lastFillTs){
    if (!firstLoad){
      const verb = fl.exit ? "CLOSED" : (fl.side === "buy" ? "BOUGHT" : "SOLD");
      say(b, `${verb} ${Math.round(fl.qty).toLocaleString()} ${bot.name} @ ${fxPx(bot.name, fl.px)}` + (fl.exit ? ` ${fmtSigned(fl.pnl)}` : ""), 7000);
      if (fl.exit && fl.pnl > 0) coins(b, 8); else if (fl.exit && fl.pnl < 0) lossFx(b, fl.pnl); else coins(b, 3);
    }
    b.lastFillTs = fl.ts;
  }
  if (bot.last_block && bot.last_block.ts !== b.lastBlockTs){
    if (!firstLoad && b.lastBlockTs !== undefined) say(b, `entry blocked: ${bot.last_block.why}`.slice(0,48), 6000);
    b.lastBlockTs = bot.last_block.ts;
  }
  b.el.classList.toggle("mkt-closed", !f.market_open && !f.halted);
  if (f.halted){ setPose(b, "halted"); b.el.classList.add("halted"); return; }
  b.el.classList.remove("halted");
  if (now < b.until) return;
  if (b.nextPose){ setPose(b, b.nextPose); b.nextPose = null; b.until = now + 9000; return; }
  busyIdle(b, now);
}

function evText(e, asset){
  const tag = asset === "fx" ? "FX " : "";
  const pxf = v => asset === "fx" ? fxPx(e.sym||"", +v) : fmtPx(+v);
  const qf = v => asset === "fx" ? Math.round(+v).toLocaleString()+"u" : (+v).toPrecision(3);
  let txt="", k="";
  switch(e.event){
    case "fill": txt = `${e.sym} ${e._exit?"CLOSE":e.side.toUpperCase()} ${qf(e.qty)} @ ${pxf(e.px)}${e._exit?" "+fmtSigned(e._pnl):""}` + (asset==="fx" ? ` (spread ${fmtUsd(e.spread_cost_usd)}, ${fmtUsd(e.usd_notional,0)} notional)` : ` (fee ${fmtUsd(e.fee)})`); k = e._exit ? cls(e._pnl) : "pos"; break;
    case "miss": txt = `${e.sym} order missed: ${e.why||e.reason}`; break;
    case "order_rejected": txt = `${e.sym} order rejected: ${e.why||e.reason}`; k="neg"; break;
    case "escalation": txt = `${e.sym} escalated: ${e.reason}`; break;
    case "entry_blocked": txt = `${e.sym} entry blocked: ${e.why}`; k="warn"; break;
    case "financing": txt = `${e.sym} financing ${fmtSigned(e.usd)} (${e.nights} night${e.nights==1?"":"s"} @ ${e.rate_pa}%/yr)`; k = cls(e.usd); break;
    case "market_open": txt = `market OPEN`; k="pos"; break;
    case "market_closed": txt = `market CLOSED (Fri 5 PM NY)`; k="warn"; break;
    case "fx_selection": txt = e.note || "pair selection"; break;
    case "kill_switch": txt = `KILL SWITCH: ${e.note}`; k="neg"; break;
    case "risk_event": txt = `RISK: ${e.ev}`; k="neg"; break;
    case "start": txt = `paper loop started`; break;
    case "stop": txt = `paper loop stopped`; k="neg"; break;
    default: txt = `${e.event}${e.sym?" "+e.sym:""}${e.err?": "+e.err:""}`;
  }
  return {k, txt: tag + txt};
}
function pickBalanced(evts, n){
  // newest first, but don't let a burst of routine escalations bury fills/blocks/financing
  const rev = evts.slice().reverse();
  const important = rev.filter(e=>e.event!=="escalation").slice(0, n);
  const rest = rev.filter(e=>e.event==="escalation").slice(0, Math.max(2, n - important.length));
  return important.concat(rest);
}

const VIEWS = {overview:"Overview", floor:"Bot floor", desks:"Desks & positions", events:"Event log"};
let evFilter = "all";

function makeMini(id, name, hue, sub, variant){
  const strip = document.getElementById("floor-strip");
  const el = document.createElement("a");
  el.href = "#/floor"; el.className = "mini watching"; el.style.setProperty("--hue", hue);
  el.innerHTML = robotSVG(hue, variant).replace('class="robot"', 'class="robot-mini"') + `<div class="m-name">${esc(name)}</div><div class="m-pill">…</div>`;
  strip.appendChild(el);
  bots[id].mini = el;
}
function setMini(id, status, pnl){
  const b = bots[id]; if (!b || !b.mini) return;
  b.mini.querySelector(".m-pill").textContent = status;
  b.mini.title = pnl==null ? "" : "P&L " + fmtSigned(pnl);
  b.mini.dataset.st = status;
}

function initDesks(){
  const cd = document.getElementById("crypto-desks");
  Object.keys(CRYPTO_HUES).forEach((s,i)=>makeDesk(cd, "c:"+s, s+"-bot", CRYPTO_HUES[s], s+"-USD", i));
  const fd = document.getElementById("fx-desks");
  FX_PAIRS.forEach((pr,i)=>makeDesk(fd, "f:"+pr, pr, FX_HUES[pr], "spot FX · paper", i+5));
  const sd = document.getElementById("stock-desks");
  Object.keys(ROLE_HUES).forEach((r,i)=>makeDesk(sd, "d:"+r, r, ROLE_HUES[r], ROLE_DESC[r], i+3));
}

const cryptoStatus = (bot, c) => { const d = bot.last_decision, p = bot.position;
  if (c.halted) return "HALTED"; if (Math.abs(p.qty) > 1e-12) return "IN POSITION";
  if (d && d.action === "enter") return "ENTERING"; if (d && d.action === "escalate") return "ESCALATED"; return "WATCHING"; };
const fxStatus = (bot, f) => { const d = bot.last_decision, p = bot.position;
  if (f.halted) return "HALTED"; if (!f.market_open) return "MKT CLOSED"; if (Math.abs(p.qty) > 1e-9) return p.qty > 0 ? "LONG" : "SHORT";
  if (bot.last_block && d && bot.last_block.ts >= d.ts - 1) return "BLOCKED"; if (d && d.action === "enter") return "ENTERING";
  if (d && d.action === "escalate") return "ESCALATED"; return "WATCHING"; };
const statusChip = s => { const k = s==="HALTED"||s==="BLOCKED" ? "bad" : (s==="IN POSITION"||s==="LONG"||s==="SHORT"||s==="ENTERING") ? "ok" : (s==="ESCALATED"||s==="MKT CLOSED") ? "warn" : "idle"; return `<span class="chip st-${k}">${esc(s)}</span>`; };

function renderHeader(data){
  const c = data.crypto, f = data.fx || {available:false}, d = data.desk;
  const fxOn = f.available;
  const deskEq = d && d.available ? d.portfolio_equity : null;
  const total = (c.equity ?? 0) + (fxOn ? f.equity ?? 0 : 0) + (deskEq ?? 0);
  document.getElementById("equity").textContent = fmtUsd(total);
  document.getElementById("equity-sub").textContent = `crypto ${fmtUsd(c.equity,0)}` + (fxOn ? ` · fx ${fmtUsd(f.equity,0)}` : "") + (deskEq!=null ? ` · stocks ${fmtUsd(deskEq,0)}` : " · stocks: no book yet");
  const day = (c.day_pnl||0) + (fxOn ? f.day_pnl||0 : 0);
  const dp = document.getElementById("daypnl"); dp.textContent = fmtSigned(day); dp.className = cls(day);
  const stockPnl = (deskEq!=null && d.portfolio_start!=null) ? deskEq - d.portfolio_start : null;
  const totPnl = (c.total_pnl||0) + (fxOn ? f.total_pnl||0 : 0) + (stockPnl||0);
  document.getElementById("totpnl").innerHTML = `since start <span class="${cls(totPnl)}">${fmtSigned(totPnl)}</span>`;
  const open = (c.open_positions||0) + (fxOn ? f.open_positions||0 : 0) + (d && d.available ? d.portfolio_positions||0 : 0);
  document.getElementById("openpos").textContent = open;
  document.getElementById("fees").textContent = `crypto ${c.open_positions||0}` + (fxOn ? ` · fx ${f.open_positions||0}` : "") + ` · stocks ${d.available ? d.portfolio_positions||0 : 0}`;
  const anyHalt = c.halted || (fxOn && f.halted);
  const states = [c.risk_state, fxOn ? f.risk_state : null].filter(Boolean);
  const worst = states.includes("reduce") ? "reduce" : states.includes("near_limit") ? "near_limit" : states[0] || "—";
  const rs = document.getElementById("riskstate"); rs.textContent = anyHalt ? "HALTED" : worst.toUpperCase(); rs.className = anyHalt ? "neg" : worst==="safe" ? "pos" : "";
  document.getElementById("dd").textContent = `dd crypto ${c.drawdown!=null ? (c.drawdown*100).toFixed(2)+"%" : "—"}` + (fxOn ? ` · fx ${f.drawdown!=null ? (f.drawdown*100).toFixed(2)+"%" : "—"}` : "");
  const loop = (name, x) => x.running ? `${name} <span class="pos">RUNNING</span>` : `${name} <span class="neg">NOT RUNNING</span>`;
  document.getElementById("runner").innerHTML = loop("crypto", c) + (fxOn ? " · " + loop("fx", f) : "") + ` · snapshot ${esc((data.snapshot||{}).taken||"")}`;
  document.getElementById("halt-banner").classList.toggle("hidden", !anyHalt);
  const reasons = [];
  if (c.halted) reasons.push("CRYPTO: " + (c.halt_reason || (c.kill_switch_armed ? "kill switch armed" : "risk halt")));
  if (fxOn && f.halted) reasons.push("FX: " + (f.halt_reason || "risk halt"));
  document.getElementById("halt-reason").textContent = reasons.join(" · ");
  const sub = d.available ? `research-desk · ${d.ledger_rows} ledger rows · ${d.tickets} tickets · ${d.reports} reports` : "research-desk not built yet: bots on standby";
  document.getElementById("desk-sub").textContent = sub; document.getElementById("desk-sub2").textContent = sub;
  renderFxZoneHeader(f);
  const rl = c.risk_limits || {};
  const kills = [c.kill_switch_armed ? "KILL" : null, ...(fxOn ? (f.kill_files_armed||[]).filter(k=>k!=="KILL") : [])].filter(Boolean);
  document.getElementById("risklimits").innerHTML = [["max drawdown", rl.max_drawdown_pct],["max daily loss", rl.max_daily_loss_pct],["max per position", rl.max_position_pct],["max gross exposure", rl.max_gross_exposure_pct]]
    .map(([k,v])=>`<div><span>${k}</span><b>${v!=null ? (v*100).toFixed(0)+"%" : "—"}</b></div>`).join("") + `<div><span>kill switch files</span><b class="${kills.length?"neg":"pos"}">${kills.length?esc(kills.join("+")):"off"}</b></div>`;
  document.getElementById("ledgerbox").innerHTML = d.available
    ? [["calls logged", d.ledger_rows],["graded", d.ledger_graded],["hits", d.ledger_hits],["avg alpha", d.ledger_avg_alpha!=null ? (d.ledger_avg_alpha*100).toFixed(2)+"%" : "n/a yet"],["tickets issued today", d.tickets_today_issued],["tickets withheld", d.tickets_today_withheld],["latest report", d.latest_report ? esc(d.latest_report) : "none"]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join("")
    : "<div><span>research desk offline</span><b>—</b></div>";
  const allBots = c.bots.concat(fxOn ? f.bots : []);
  const tot = k => allBots.reduce((a,b)=>a+(b[k]||0),0);
  document.getElementById("loopkpi").textContent = tot("decisions").toLocaleString();
  document.getElementById("loopkpi-sub").textContent = `decisions · ${tot("fills")} fills · ${tot("blocks")} blocked · ${tot("escalations")} escalated`;
  // desk summary table
  const rows = [];
  const pct = v => v!=null ? (v*100).toFixed(2)+"%" : "—";
  rows.push(`<tr><td>Crypto pit (8)</td><td>${c.running?'<span class="chip st-ok">RUNNING</span>':'<span class="chip st-bad">STOPPED</span>'}</td><td class="r mono">${fmtUsd(c.equity)}</td><td class="r mono ${cls(c.day_pnl)}">${fmtSigned(c.day_pnl)}</td><td class="r mono ${cls(c.total_pnl)}">${fmtSigned(c.total_pnl)}</td><td class="r mono">${c.open_positions||0}</td><td class="r mono">${pct(c.drawdown)}</td><td>${esc((c.risk_state||"—").toUpperCase())}</td></tr>`);
  if (fxOn) rows.push(`<tr><td>FX desk (8)</td><td>${f.market_open?'<span class="chip st-ok">MARKET OPEN</span>':'<span class="chip st-warn">MARKET CLOSED</span>'}</td><td class="r mono">${fmtUsd(f.equity)}</td><td class="r mono ${cls(f.day_pnl)}">${fmtSigned(f.day_pnl)}</td><td class="r mono ${cls(f.total_pnl)}">${fmtSigned(f.total_pnl)}</td><td class="r mono">${f.open_positions||0}</td><td class="r mono">${pct(f.drawdown)}</td><td>${esc((f.risk_state||"—").toUpperCase())}</td></tr>`);
  if (d.available) rows.push(`<tr><td>Stock research desk (8 roles)</td><td><span class="chip st-ok">ACTIVE</span></td><td class="r mono">${fmtUsd(d.portfolio_equity)}</td><td class="r mono">—</td><td class="r mono ${cls(stockPnl)}">${stockPnl!=null?fmtSigned(stockPnl):"—"}</td><td class="r mono">${d.portfolio_positions||0}</td><td class="r mono">—</td><td>paper tickets need approval</td></tr>`);
  document.querySelector("#tbl-desks tbody").innerHTML = rows.join("");
  // equity chart
  let series = c.equity_series||[];
  if (fxOn && (f.equity_series||[]).length){
    const fs = f.equity_series; let j = 0, last = fs[0][1];
    series = series.filter(p=>p[0] >= fs[0][0]).map(p=>{ while(j<fs.length && fs[j][0]<=p[0]){ last = fs[j][1]; j++; } return [p[0], p[1]+last]; });
    if (series.length < 2) series = c.equity_series||[];
  }
  drawSpark(series);
}

function renderTables(data){
  const c = data.crypto, f = data.fx || {available:false}, d = data.desk;
  const dec = x => x ? `${esc(x.action)} · ${esc(x.direction)}` : "—";
  const cf = x => x && x.confidence!=null ? (x.confidence*100).toFixed(0)+"%" : "—";
  document.querySelector("#tbl-crypto tbody").innerHTML = c.bots.map(b=>{ const p=b.position, h=Math.abs(p.qty)>1e-12;
    return `<tr><td><b>${esc(b.name)}</b>-USD</td><td>${statusChip(cryptoStatus(b,c))}</td><td class="r mono">${fmtPx(b.mid)}</td><td class="r mono">${b.spread_bps!=null?(+b.spread_bps).toFixed(2):"—"}</td><td>${dec(b.last_decision)}</td><td>${esc(b.last_decision?b.last_decision.regime||"":"")}</td><td class="r mono">${cf(b.last_decision)}</td><td class="mono">${h ? p.qty.toPrecision(4)+" @ "+fmtPx(p.avg_px) : "flat"}</td><td class="r mono ${cls(b.pnl)}">${fmtSigned(b.pnl)}</td><td class="r mono">${b.wins}/${b.losses}</td><td class="r mono">${b.decisions}</td></tr>`; }).join("");
  document.querySelector("#tbl-fx tbody").innerHTML = f.available ? f.bots.map(b=>{ const p=b.position, h=Math.abs(p.qty)>1e-9;
    return `<tr><td><b>${esc(b.name)}</b></td><td>${statusChip(fxStatus(b,f))}</td><td class="r mono">${fxPx(b.name,b.mid)}</td><td class="r mono">${b.spread_bps!=null?(+b.spread_bps).toFixed(2):"—"}</td><td>${dec(b.last_decision)}</td><td>${esc(b.last_decision?b.last_decision.regime||"":"")}</td><td class="r mono">${cf(b.last_decision)}</td><td class="mono">${h ? Math.round(p.qty).toLocaleString()+"u @ "+fxPx(b.name,p.avg_px) : "flat"}</td><td class="r mono ${cls(b.pnl)}">${fmtSigned(b.pnl)}</td><td class="r mono ${cls(b.financing)}">${fmtSigned(b.financing)}</td><td class="r mono">${b.blocks||0}</td></tr>`; }).join("") : `<tr><td colspan="11" class="muted">fx loop has no data in this snapshot</td></tr>`;
  document.querySelector("#tbl-roles tbody").innerHTML = (d.roles||[]).map(r=>`<tr><td><b>${esc(r.role)}</b></td><td>${esc(ROLE_DESC[r.role]||"")}</td><td>${statusChip(r.status==="active"?"ACTIVE":"WATCHING")}</td><td class="mono">${r.file?esc(r.file.split("/").pop()):"—"}</td><td>${r.mtime?ago(r.mtime):"—"}</td><td class="r mono">${r.count!=null?r.count+" "+esc(r.unit||""):"—"}</td><td class="clip">${r.headline?esc(r.headline):"—"}</td></tr>`).join("");
  document.querySelector("#tbl-ledger tbody").innerHTML = (d.ledger_recent||[]).map(r=>`<tr><td class="mono">${esc(r.date)}</td><td><b>${esc(r.ticker)}</b></td><td class="r mono">${esc(r.rating)}/5</td><td>${esc(r.setup)}</td><td>${esc(r.sector)}</td><td class="r mono">${esc(r.ref_price)}</td><td class="mono">${esc(r.settle_date)}</td><td>${r.hit===""?'<span class="chip st-idle">pending</span>':esc(r.hit)}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">no rows</td></tr>`;
  // minis
  c.bots.forEach(b=>setMini("c:"+b.name, cryptoStatus(b,c), b.pnl));
  if (f.available) f.bots.forEach(b=>setMini("f:"+b.name, fxStatus(b,f), b.pnl));
  (d.roles||[]).forEach(r=>setMini("d:"+r.role, d.available ? (r.status==="active"?"ACTIVE":"WATCHING") : "OFFLINE", null));
}

function allEvents(data){
  const out = [];
  (data.crypto.events||[]).forEach(e=>{ const t = evText(e,"crypto"); out.push({ts:e.ts, src:"crypto", k:t.k, txt:t.txt}); });
  if (data.fx && data.fx.available) (data.fx.events||[]).forEach(e=>{ const t = evText(e,"fx"); out.push({ts:e.ts, src:"fx", k:t.k, txt:t.txt}); });
  if (data.desk.available) (data.desk.events||[]).forEach(e=>out.push({ts:e.ts, src:"desk", k:"", txt:`filed ${e.file||"file"}`}));
  return out.sort((a,b)=>b.ts-a.ts);
}
function renderEvents(data){
  const evs = allEvents(data);
  const row = e => `<tr><td class="mono nowrap">${tfmt(e.ts)}</td><td><span class="chip src-${e.src}">${e.src.toUpperCase()}</span></td><td class="${e.k}">${esc(e.txt)}</td></tr>`;
  // keep the overview list varied: fills/blocks first, routine escalations capped
  const imp = evs.filter(e=>!/escalated/.test(e.txt)).slice(0,8), esc2 = evs.filter(e=>/escalated/.test(e.txt)).slice(0,4);
  document.querySelector("#tbl-recent tbody").innerHTML = imp.concat(esc2).sort((a,b)=>b.ts-a.ts).map(row).join("") || `<tr><td colspan="3" class="muted">no events yet</td></tr>`;
  const shown = evs.filter(e=>evFilter==="all"||e.src===evFilter).slice(0,200);
  document.querySelector("#tbl-events tbody").innerHTML = shown.map(row).join("") || `<tr><td colspan="3" class="muted">no events</td></tr>`;
}
document.getElementById("ev-filter").addEventListener("click", ev=>{ const b = ev.target.closest("button"); if(!b) return;
  evFilter = b.dataset.f; document.querySelectorAll("#ev-filter button").forEach(x=>x.classList.toggle("on", x===b)); if (lastData) renderEvents(lastData); });

function fmtNYChange(ts){ return new Date(ts*1000).toLocaleString([], {weekday:"short", hour:"numeric", minute:"2-digit"}); }
function renderFxZoneHeader(f){
  const el = document.getElementById("fx-sub"), badge = document.getElementById("fx-market");
  if (!f.available){ el.textContent = "fx loop not running in this snapshot"; badge.textContent = "NO DATA"; badge.className = "chip"; return; }
  badge.textContent = f.market_open ? "MARKET OPEN" : "MARKET CLOSED";
  badge.className = "chip " + (f.market_open ? "st-ok" : "st-warn");
  el.textContent = `equity ${fmtUsd(f.equity)} · day ${fmtSigned(f.day_pnl)} · gross ${fmtUsd(f.gross_usd,0)} · lev ${f.leverage!=null?(+f.leverage).toFixed(2)+"x":"—"} · spread paid ${fmtUsd(f.spread_paid_usd)} · financing ${fmtSigned(f.financing_usd)}`;
}

function drawSpark(series){
  const cv = document.getElementById("spark"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.clearRect(0,0,W,H);
  const btc = lastData && lastData.crypto.bots.find(x=>x.name==="BTC");
  document.getElementById("spark-title").textContent = "PAPER EQUITY" + (btc && btc.last_decision ? ` · BTC regime: ${btc.last_decision.regime}` : "");
  g.strokeStyle = "#2b3646"; g.lineWidth = 1; g.fillStyle = "#7f8da3"; g.font = "11px ui-monospace,monospace";
  for (let i=0;i<4;i++){ const y = 14 + i*(H-34)/3; g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
  if (series.length < 2){ g.fillText("collecting equity points…", 10, H/2); return; }
  const ys = series.map(p=>p[1]); let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1){ lo -= 5; hi += 5; }
  g.strokeStyle = "#4fd1c5"; g.lineWidth = 2; g.beginPath();
  series.forEach((p,i)=>{ const x = i/(series.length-1)*(W-60)+4, y = H-20 - (p[1]-lo)/(hi-lo)*(H-34); i?g.lineTo(x,y):g.moveTo(x,y); });
  g.stroke(); g.fillStyle = "#a9b6c9";
  g.fillText(fmtUsd(hi,0), W-54, 22); g.fillText(fmtUsd(lo,0), W-54, H-24);
  g.fillText(fmtUsd(ys[ys.length-1]) + " latest", 8, H-4);
}

async function poll(){
  try{
    const r = await fetch("state.json", {cache:"no-store"});
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    lastData = data;
    renderHeader(data);
    data.crypto.bots.forEach(b=>renderCryptoBot(b, data.crypto));
    if (data.fx && data.fx.available) data.fx.bots.forEach(b=>renderFxBot(b, data.fx));
    else FX_PAIRS.forEach(pr=>{ const b = bots["f:"+pr]; b.el.classList.add("offline"); b.el.querySelector(".mon-body").innerHTML = `<div class="mon-head"><span>${pr}</span><span class="status-pill">OFFLINE</span></div><div class="mon-reason">fx loop has no data yet</div>`; });
    data.desk.roles.forEach(r=>renderDeskBot(r, data.desk, false));
    renderTables(data); renderEvents(data);
    firstLoad = false;
  }catch(e){
    document.getElementById("runner").innerHTML = `<span class="neg">data feed error: ${esc(e.message)}</span>`;
    console.warn("state.json load failed", e);
  }
}

// routing: #/overview, #/floor, #/desks, #/events
function route(){
  let v = (location.hash||"").replace(/^#\/?/, "").split(/[?&]/)[0] || "overview";
  if (!VIEWS[v]) v = "overview";
  Object.keys(VIEWS).forEach(k=>document.getElementById("view-"+k).classList.toggle("hidden", k!==v));
  document.querySelectorAll("#nav a").forEach(a=>{ const on = a.dataset.view===v; a.classList.toggle("active", on); if(on) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  document.getElementById("view-title").textContent = VIEWS[v];
  document.title = `${VIEWS[v]} · Quasaria Back Office · SNAPSHOT · PAPER TRADING`;
  document.body.dataset.view = v;
  scrollTo(0,0);
  if (v==="overview" && lastData) drawSpark(lastEquitySeries());
  document.dispatchEvent(new CustomEvent("viewchange",{detail:v}));
}
function lastEquitySeries(){ const c = lastData.crypto; return c.equity_series||[]; }
addEventListener("hashchange", route);

setInterval(()=>{ if(!lastData) return; const now = Date.now(); Object.values(bots).forEach(b=>{ if(b.state!=="halted" && now>b.until && !b.nextPose) busyIdle(b, now); }); }, 1000);
setInterval(()=>{ document.getElementById("clock").textContent = new Date().toLocaleString(); }, 1000);
document.getElementById("clock").textContent = new Date().toLocaleString();

initDesks();
route();
poll(); setInterval(poll, POLL_MS);
