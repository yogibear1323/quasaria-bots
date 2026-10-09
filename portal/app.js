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
  return bots[id];
}

function setPose(b, pose){
  if (b.state === pose) return;
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

function initDesks(){
  const cd = document.getElementById("crypto-desks");
  Object.keys(CRYPTO_HUES).forEach((s,i)=>makeDesk(cd, "c:"+s, s+"-bot", CRYPTO_HUES[s], s+"-USD", i));
  const fd = document.getElementById("fx-desks");
  FX_PAIRS.forEach((pr,i)=>makeDesk(fd, "f:"+pr, pr, FX_HUES[pr], "spot FX · paper", i+5));
  const sd = document.getElementById("stock-desks");
  Object.keys(ROLE_HUES).forEach((r,i)=>makeDesk(sd, "d:"+r, r, ROLE_HUES[r], ROLE_DESC[r], i+3));
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
  document.getElementById("totpnl").innerHTML = `since start <span class="${cls(totPnl)}">${fmtSigned(totPnl)}</span> · day = crypto ${fmtSigned(c.day_pnl)}` + (fxOn ? ` + fx ${fmtSigned(f.day_pnl)}` : "");
  const open = (c.open_positions||0) + (fxOn ? f.open_positions||0 : 0) + (d && d.available ? d.portfolio_positions||0 : 0);
  document.getElementById("openpos").textContent = open;
  document.getElementById("fees").textContent = `crypto ${c.open_positions||0}` + (fxOn ? ` · fx ${f.open_positions||0}` : "") + ` · stocks ${d.available ? d.portfolio_positions||0 : 0}` + ` · crypto fees ${fmtUsd(c.fees_paid)}`;
  const anyHalt = c.halted || (fxOn && f.halted);
  const states = [c.risk_state, fxOn ? f.risk_state : null].filter(Boolean);
  const worst = states.includes("reduce") ? "reduce" : states.includes("near_limit") ? "near_limit" : states[0] || "—";
  const rs = document.getElementById("riskstate"); rs.textContent = anyHalt ? "HALTED" : worst.toUpperCase(); rs.className = anyHalt ? "neg" : worst==="safe" ? "pos" : "";
  document.getElementById("dd").textContent = `dd crypto ${c.drawdown!=null ? (c.drawdown*100).toFixed(2)+"%" : "—"}` + (fxOn ? ` · fx ${f.drawdown!=null ? (f.drawdown*100).toFixed(2)+"%" : "—"} · fx lev ${f.leverage!=null ? (+f.leverage).toFixed(2)+"x" : "—"}` : "");
  const loop = (name, x) => x.running ? `${name} <span class="pos">RUNNING</span>` : `${name} <span class="neg">NOT RUNNING</span>`;
  document.getElementById("runner").innerHTML = loop("crypto", c) + (fxOn ? " · " + loop("fx", f) : "") + ` · SNAPSHOT ${esc((data.snapshot||{}).taken||"")}`;
  document.getElementById("halt-banner").classList.toggle("hidden", !anyHalt);
  const reasons = [];
  if (c.halted) reasons.push("CRYPTO: " + (c.halt_reason || (c.kill_switch_armed ? "kill switch armed" : "risk halt")));
  if (fxOn && f.halted) reasons.push("FX: " + (f.halt_reason || "risk halt"));
  document.getElementById("halt-reason").textContent = reasons.join(" · ");
  document.getElementById("desk-sub").textContent = d.available ? `research-desk · ${d.ledger_rows} ledger rows · ${d.tickets} tickets · ${d.reports} reports` : "research-desk not built yet: bots on standby";
  renderFxZoneHeader(f);
  // holo panels
  const rl = c.risk_limits || {};
  const kills = [c.kill_switch_armed ? "KILL" : null, ...(fxOn ? (f.kill_files_armed||[]).filter(k=>k!=="KILL") : [])].filter(Boolean);
  document.getElementById("risklimits").innerHTML = [["max drawdown", rl.max_drawdown_pct],["max daily loss", rl.max_daily_loss_pct],["max per pos", rl.max_position_pct],["max gross", rl.max_gross_exposure_pct]]
    .map(([k,v])=>`<div><span>${k}</span><b>${v!=null ? (v*100).toFixed(0)+"%" : "—"}</b></div>`).join("") + `<div><span>kill files</span><b class="${kills.length?"neg":"pos"}">${kills.length?esc(kills.join("+")):"off"}</b></div>`;
  document.getElementById("ledgerbox").innerHTML = d.available
    ? `${d.ledger_rows} calls · ${d.ledger_graded} graded · ${d.ledger_hits} hits${d.ledger_avg_alpha!=null?` · avg alpha ${(d.ledger_avg_alpha*100).toFixed(2)}%`:""}<br>tickets today: ${d.tickets_today_issued} issued · ${d.tickets_today_withheld} withheld<br>${d.latest_report ? "report: "+esc(d.latest_report) : "no morning report yet"}`
    : "research desk offline";
  const allBots = c.bots.concat(fxOn ? f.bots : []);
  const tot = k => allBots.reduce((a,b)=>a+(b[k]||0),0);
  document.querySelector(".h4 .holo-title").textContent = fxOn ? "CRYPTO + FX LOOP TOTALS" : "CRYPTO LOOP TOTALS";
  document.getElementById("loopstats").innerHTML = [["decisions",tot("decisions")],["fills",tot("fills")],["wins",tot("wins")],["losses",tot("losses")],["blocked",tot("blocks")],["escalations",tot("escalations")]]
    .map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join("");
  // combined equity curve (crypto + fx), aligned on crypto timestamps
  let series = c.equity_series||[];
  if (fxOn && (f.equity_series||[]).length){
    const fs = f.equity_series; let j = 0, last = fs[0][1];
    series = series.filter(p=>p[0] >= fs[0][0]).map(p=>{ while(j<fs.length && fs[j][0]<=p[0]){ last = fs[j][1]; j++; } return [p[0], p[1]+last]; });
    if (series.length < 2) series = c.equity_series||[];
  }
  drawSpark(series);
}

function fmtNYChange(ts){ return new Date(ts*1000).toLocaleString([], {weekday:"short", hour:"numeric", minute:"2-digit"}); }
function renderFxZoneHeader(f){
  const el = document.getElementById("fx-sub"), badge = document.getElementById("fx-market");
  if (!f.available){ el.textContent = "fx loop not running: no fx-session log / fx_portfolio.json yet"; badge.textContent = "NO DATA"; badge.className = "mkt"; return; }
  badge.textContent = f.market_open ? "MARKET OPEN" : "MARKET CLOSED";
  badge.className = "mkt " + (f.market_open ? "open" : "closed");
  const nxt = f.market_next_change ? (f.market_hours_open ? `closes ${fmtNYChange(f.market_next_change)} your time = Fri 5 PM NY` : `reopens ${fmtNYChange(f.market_next_change)} your time = Sun 5 PM NY`) : "";
  el.textContent = `quasaria-trader fx · equity ${fmtUsd(f.equity)} · day ${fmtSigned(f.day_pnl)} · gross ${fmtUsd(f.gross_usd,0)} · lev ${f.leverage!=null?(+f.leverage).toFixed(2)+"x":"—"} · spread paid ${fmtUsd(f.spread_paid_usd)} · financing ${fmtSigned(f.financing_usd)} · ${nxt}`;
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

function drawSpark(series){
  const cv = document.getElementById("spark"), g = cv.getContext("2d");
  g.clearRect(0,0,cv.width,cv.height);
  const btc = lastData && lastData.crypto.bots.find(x=>x.name==="BTC");
  document.querySelector(".h1 .holo-title").textContent = (lastData && lastData.fx && lastData.fx.available ? "CRYPTO+FX EQUITY" : "PAPER EQUITY") + (btc && btc.last_decision ? ` · BTC ${btc.last_decision.regime}` : "");
  if (series.length < 2){ g.fillStyle="#6f82ad"; g.font="11px monospace"; g.fillText("collecting equity points…", 10, 38); return; }
  const ys = series.map(p=>p[1]); let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1){ lo -= 5; hi += 5; }
  g.strokeStyle = "#22e6ff"; g.lineWidth = 2; g.shadowColor="#22e6ff"; g.shadowBlur=8; g.beginPath();
  series.forEach((p,i)=>{ const x = i/(series.length-1)*(cv.width-4)+2, y = cv.height-4 - (p[1]-lo)/(hi-lo)*(cv.height-14); i?g.lineTo(x,y):g.moveTo(x,y); });
  g.stroke(); g.shadowBlur=0; g.fillStyle="#9fefff"; g.font="10px monospace";
  g.fillText(fmtUsd(ys[ys.length-1]), 4, 10);
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
function renderTicker(data){
  const buckets = [];
  buckets.push(pickBalanced(data.crypto.events||[], 10).map(e=>{ const t = evText(e,"crypto"); return {ts:e.ts, html:`<span class="${t.k}">[${tfmt(e.ts)}] ${esc(t.txt)}</span>`}; }));
  if (data.fx && data.fx.available) buckets.push(pickBalanced(data.fx.events||[], 10).map(e=>{ const t = evText(e,"fx"); return {ts:e.ts, html:`<span class="fxev ${t.k}">[${tfmt(e.ts)}] ${esc(t.txt)}</span>`}; }));
  if (data.desk.available) buckets.push((data.desk.events||[]).slice(0,4).map(e=>({ts:e.ts, html:`<span style="color:#ff9cf6">[${tfmt(e.ts)}] DESK ${esc(e.file)}${e.headline?": "+esc(e.headline.slice(0,70)):""}</span>`})));
  // round-robin across sources so no single source crowds the ticker
  buckets.forEach(bk=>bk.sort((a,b)=>b.ts-a.ts));
  const items = [];
  for (let i=0; buckets.some(bk=>i<bk.length); i++) buckets.forEach(bk=>{ if (i<bk.length) items.push(bk[i]); });
  const html = items.slice(0,30).map(i=>i.html).join("") || "<span>no events yet: bots watching the tape</span>";
  const el = document.getElementById("ticker-inner");
  if (el.dataset.h !== html){ el.dataset.h = html; el.innerHTML = html; el.style.animationDuration = Math.max(50, items.length*6)+"s"; }
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
    renderTicker(data);
    firstLoad = false;
  }catch(e){
    document.getElementById("runner").innerHTML = `<span class="neg">data feed error: ${esc(e.message)}</span>`;
  }
}

// lightweight animation tick between polls so idle bots keep changing
setInterval(()=>{ if(!lastData) return; const now = Date.now(); Object.values(bots).forEach(b=>{ if(b.state!=="halted" && now>b.until && !b.nextPose) busyIdle(b, now); }); }, 1000);
setInterval(()=>{ document.getElementById("clock").textContent = new Date().toLocaleString(); }, 1000);

// particles
(function(){
  const cv = document.getElementById("particles"), g = cv.getContext("2d"); let W,H,P=[];
  function rs(){ W=cv.width=innerWidth; H=cv.height=innerHeight; P = Array.from({length: Math.floor(W*H/14000)}, ()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6+.3,vy:-(Math.random()*.35+.05),vx:(Math.random()-.5)*.15,h:Math.random()<.5?"34,230,255":"255,61,242",a:Math.random()*.6+.2})); }
  addEventListener("resize", rs); rs();
  (function f(){ g.clearRect(0,0,W,H); for(const p of P){ p.x+=p.vx; p.y+=p.vy; if(p.y<-5){p.y=H+5;p.x=Math.random()*W;} g.beginPath(); g.fillStyle=`rgba(${p.h},${p.a})`; g.shadowColor=`rgba(${p.h},1)`; g.shadowBlur=6; g.arc(p.x,p.y,p.r,0,7); g.fill(); } requestAnimationFrame(f); })();
})();
// parallax
addEventListener("mousemove", e=>{ const cx = e.clientX/innerWidth-.5, cy = e.clientY/innerHeight-.5;
  document.querySelectorAll(".layer").forEach(l=>{ const d = +l.dataset.depth; l.style.transform = `translate(${-cx*40*d}px,${-cy*24*d}px)`; }); });

initDesks();
poll(); setInterval(poll, POLL_MS);
