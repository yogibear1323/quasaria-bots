"use strict";
// ─── CONFIG ──────────────────────────────────────────────────────────────
// Where "Enter the Bot Portal" goes: a frozen snapshot of the trading floor.
// Public copy: points at the static snapshot in ./portal/.
const PORTAL_URL = "./portal/";
// ─────────────────────────────────────────────────────────────────────────

const portalUrl = (() => {
  return PORTAL_URL;
})();

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// Same robot SVG as the back office (back-office/static/app.js)
let svgN = 0;
function robotSVG(hue, variant){
  const id = "lg" + (svgN++);
  const headR = variant%3===0 ? 14 : variant%3===1 ? 4 : 9;
  return `<svg class="robot" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
   <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4778"/><stop offset="1" stop-color="#151b3a"/></linearGradient></defs>
   <g class="think-dots" fill="${hue}"><circle cx="84" cy="10" r="2.4"/><circle cx="92" cy="6" r="3"/><circle cx="101" cy="2.5" r="3.6"/></g>
   <g class="r-body">
     <rect x="36" y="56" width="38" height="36" rx="9" fill="url(#${id})" stroke="${hue}" stroke-opacity=".6"/>
     <rect x="46" y="64" width="18" height="10" rx="2" fill="#050915" stroke="${hue}" stroke-opacity=".5"/>
     <rect x="49" y="67" width="12" height="4" rx="1" fill="${hue}"><animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite"/></rect>
   </g>
   <g class="r-armL"><rect x="26" y="60" width="9" height="30" rx="4.5" fill="#2a3462" stroke="${hue}" stroke-opacity=".5"/><circle cx="30.5" cy="92" r="4.5" fill="${hue}" opacity=".85"/></g>
   <g class="r-armR"><rect x="75" y="60" width="9" height="30" rx="4.5" fill="#2a3462" stroke="${hue}" stroke-opacity=".5"/><circle cx="79.5" cy="92" r="4.5" fill="${hue}" opacity=".85"/></g>
   <g class="r-head">
     <line x1="55" y1="14" x2="55" y2="4" stroke="#8a9ad0" stroke-width="2"/>
     <circle class="r-antenna-tip" cx="55" cy="4" r="3.4" fill="${hue}"/>
     <rect x="31" y="14" width="48" height="38" rx="${headR}" fill="url(#${id})" stroke="${hue}" stroke-width="1.5"/>
     <rect x="36" y="22" width="38" height="20" rx="8" fill="#03060f"/>
     <g><ellipse class="r-eye" cx="47" cy="32" rx="4.5" ry="5" fill="${hue}"/><ellipse class="r-eye" cx="63" cy="32" rx="4.5" ry="5" fill="${hue}"/>
       <circle cx="47" cy="32" r="1.6" fill="#fff"/><circle cx="63" cy="32" r="1.6" fill="#fff"/></g>
     <g class="x-eyes" stroke="#ff3b5c" stroke-width="2.5" stroke-linecap="round"><path d="M43 28l8 8M51 28l-8 8M59 28l8 8M67 28l-8 8"/></g>
     <rect x="28" y="27" width="3" height="10" rx="1.5" fill="${hue}" opacity=".7"/><rect x="79" y="27" width="3" height="10" rx="1.5" fill="${hue}" opacity=".7"/>
   </g>
  </svg>`;
}

// ─── Bot roster (facts from the repo READMEs and research) ──────────────
const BOTS = [
  // Crypto pit: Coinbase public data, spot long-only
  {desk:"crypto", name:"BTC-bot", hue:"#ff9f1c", role:"BTC-USD", does:"Trades the big one, and doubles as the room's smoke alarm: a −10% BTC day flips everyone into crisis mode (no new entries).", note:"Research read: sideways, slight risk-off lean."},
  {desk:"crypto", name:"ETH-bot", hue:"#8c9eff", role:"ETH-USD", does:"Watches the ETH book and tape: trend z-score, 24h mean reversion, vol regime and toxic-flow checks, every 60 s.", note:"Same gate as everyone: quality ≥ 2, confidence > 0.80, risk safe."},
  {desk:"crypto", name:"HYPE-bot", hue:"#2ef2c8", role:"HYPE-USD", does:"Tracks Hyperliquid's token, one of the research desk's top setups thanks to heavy buybacks.", note:"Caveat: FDV is about 4.3× market cap."},
  {desk:"crypto", name:"PUMP-bot", hue:"#7dff6a", role:"PUMP-USD", does:"Keeps an eye on pump.fun's token, where buybacks fight against monthly unlocks.", note:"Unlocks land on the 12th of each month and currently exceed buybacks."},
  {desk:"crypto", name:"AERO-bot", hue:"#3da9ff", role:"AERO-USD", does:"Follows Aerodrome, the other top setup: revenue up, with a merger launching Oct 21.", note:"Sell-the-news risk; Coinbase migration pause Nov 2–4."},
  {desk:"crypto", name:"UNI-bot", hue:"#ff4fb8", role:"UNI-USD", does:"Scores Uniswap's token off the public order book and trade flow.", note:"Value capture is thin: about 0.79 bps of volume."},
  {desk:"crypto", name:"LINK-bot", hue:"#4f7bff", role:"LINK-USD", does:"Runs the same deterministic scorer on Chainlink's token.", note:"Pricey: roughly 145× holder revenue."},
  {desk:"crypto", name:"RAY-bot", hue:"#c86bff", role:"RAY-USD", does:"Watches Raydium. Research flagged it as a possible short, but spot rules mean this bot can only go long or sit out.", note:"Revenue spike leans on one partner."},
  // FX desk
  ...[["USD/JPY","#ff5f6d","major"],["EUR/JPY","#ffa94d","cross"],["EUR/USD","#4dabf7","major"],["AUD/USD","#ffd43b","major"],
      ["USD/CHF","#e64980","major"],["GBP/USD","#9775fa","major"],["CHF/JPY","#ff8787","cross"],["NZD/JPY","#20c997","cross"]].map(([p,h,k]) => ({
    desk:"fx", name:p, hue:h, role:`spot FX ${k} · paper`,
    does:`Made the cut on cost vs volatility. Scores ${p} with the shared decision schema and trades on margin, paper only.`,
    note:"Sits out ±news windows, respects market hours, flattens Fri 16:30 NY. Max 1.5× per pair."
  })),
  // Stock research desk
  {desk:"stock", name:"Scout", hue:"#22e6ff", role:"screens the universe", does:"Ranks US stocks with an attention formula: news outlets, fresh 8-K filings, volume and price gaps.", note:"Picks who the rest of the desk studies tonight."},
  {desk:"stock", name:"Tape", hue:"#ffd23d", role:"price & volume", does:"Reads the chart: trend, volume and how the stock moved around the news.", note:"Quotes and history from public endpoints."},
  {desk:"stock", name:"Fundamentals", hue:"#7dff6a", role:"SEC filings", does:"Pulls SEC EDGAR XBRL facts (8 quarters): revenue growth, operating margin, free cash flow.", note:"Facts come from filings, not vibes."},
  {desk:"stock", name:"Catalyst", hue:"#ff8a3d", role:"news & events", does:"Watches the live 8-K feed, earnings dates and headlines, and judges which way a catalyst cuts.", note:"First run: Haemonetics' Oct 8 filing on CSL's rollout."},
  {desk:"stock", name:"Bull", hue:"#39ff88", role:"long thesis", does:"Makes the strongest honest case for buying.", note:"Every bull case gets a bear reply."},
  {desk:"stock", name:"Bear", hue:"#ff3b5c", role:"short thesis", does:"Argues against every idea. Until the bear is answered, a 4 or 5 rating is capped at 3.", note:"No answered bear, no ticket."},
  {desk:"stock", name:"Risk", hue:"#ff3df2", role:"limits & sizing", does:"Sizes positions from equity, stop distance and liquidity, runs a preflight and withholds tickets that break limits.", note:"Tells you which cap is binding."},
  {desk:"stock", name:"PM", hue:"#ffffff", role:"final call", does:"Assigns 1 to 5 ratings, writes paper tickets, and logs every call to a ledger that grades it later.", note:"Tickets fill only on paper, and only after you type “approve”."},
];

// ─── Hero bots ──────────────────────────────────────────────────────────
const HERO = [
  {hue:"#ff9f1c", tag:"CRYPTO PIT", lines:["BTC book looks thin…","confidence 0.62: no trade","waiting for setup ≥ 2","toxic flow? nope."]},
  {hue:"#ff3df2", tag:"STOCK DESK", lines:["Bear: answer me first!","8-K just dropped 📄","HAE: rated 4/5","ticket needs approval"]},
  {hue:"#4dabf7", tag:"FX DESK", lines:["news in 45 min: sitting out","EUR/USD spread ok","market's open 🌏","flatten before Friday"]},
];
const heroWrap = document.getElementById("hero-bots");
const heroEls = HERO.map((h,i) => {
  const d = document.createElement("div");
  d.className = "hbot " + ["typing","thinking","watching"][i];
  d.style.setProperty("--hue", h.hue);
  d.innerHTML = `<div class="bubble"></div>${robotSVG(h.hue, i)}<div class="hdesk"></div><div class="tag">${h.tag}</div>`;
  heroWrap.appendChild(d); return d;
});
let heroTurn = 0;
function heroSay(){
  const i = heroTurn % 3, el = heroEls[i], h = HERO[i];
  const bub = el.querySelector(".bubble");
  bub.textContent = h.lines[Math.floor(heroTurn/3) % h.lines.length];
  bub.classList.add("show");
  setTimeout(()=>bub.classList.remove("show"), 2300);
  heroEls.forEach(e => { if (Math.random() < .4){ e.classList.remove("typing","watching","thinking"); e.classList.add(["typing","watching","thinking"][Math.floor(Math.random()*3)]); } });
  heroTurn++;
}
heroSay(); setInterval(heroSay, 2600);

// demo sparkline (clearly labeled not real data)
const spark = document.getElementById("spark");
let pts = Array.from({length:60}, (_,i) => 45 + Math.sin(i/5)*14 + (Math.random()-.5)*10);
function drawSpark(){ spark.setAttribute("points", pts.map((y,i)=>`${(i/(pts.length-1)*300).toFixed(1)},${Math.max(4,Math.min(86,y)).toFixed(1)}`).join(" ")); }
drawSpark();
setInterval(()=>{ const last = pts[pts.length-1]; pts.shift(); pts.push(last + (45-last)*.08 + (Math.random()-.5)*12); drawSpark(); }, 450);

// ─── Bot card grid ──────────────────────────────────────────────────────
const grid = document.getElementById("botgrid");
const DESK_TAG = {crypto:"CRYPTO", fx:"FX", stock:"STOCKS"};
BOTS.forEach((b,i) => {
  const c = document.createElement("div");
  c.className = "card reveal"; c.dataset.desk = b.desk; c.tabIndex = 0;
  c.style.setProperty("--hue", b.hue);
  c.setAttribute("aria-label", `${b.name}: ${b.does}`);
  c.innerHTML = `<div class="inner">
    <div class="face front ${["watching","typing","thinking"][i%3]}"><span class="desk-tag">${DESK_TAG[b.desk]}</span>${robotSVG(b.hue, i)}<div class="plate"></div><h4>${esc(b.name)}</h4><div class="role">${esc(b.role)}</div></div>
    <div class="face back"><h4>${esc(b.name)}</h4><p>${esc(b.does)}</p><div class="note">${esc(b.note)}</div></div>
  </div>`;
  const front = c.querySelector(".front");
  c.addEventListener("mouseenter", ()=>front.classList.add("waving"));
  c.addEventListener("mouseleave", ()=>front.classList.remove("waving"));
  c.addEventListener("click", ()=>c.classList.toggle("flipped"));
  c.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); c.classList.toggle("flipped"); } });
  grid.appendChild(c);
});

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active", x===t));
  const f = t.dataset.f;
  grid.querySelectorAll(".card").forEach(c => c.classList.toggle("gone", f!=="all" && c.dataset.desk!==f));
  document.querySelectorAll(".intro").forEach(n => n.classList.toggle("dim", f!=="all" && n.dataset.desk!==f));
}));

// ─── Scroll reveals + counters ──────────────────────────────────────────
function countUp(el){
  const target = +el.dataset.count, pre = el.dataset.prefix || "", t0 = performance.now(), dur = 1400;
  (function step(t){ const k = Math.min(1,(t-t0)/dur), v = Math.round(target*(1-Math.pow(1-k,3)));
    el.textContent = pre + v.toLocaleString("en-US"); if (k<1) requestAnimationFrame(step); })(t0);
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in");
  e.target.querySelectorAll("[data-count]").forEach(countUp);
  io.unobserve(e.target);
}), {threshold:.12});
document.querySelectorAll(".reveal").forEach((el,i) => { el.style.transitionDelay = (i%8)*60 + "ms"; io.observe(el); });

// ─── Kill-switch toy ────────────────────────────────────────────────────
const toast = document.getElementById("toast");
function showToast(msg){ toast.textContent = msg; toast.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove("show"), 3200); }
const kill = document.getElementById("killbtn");
function armKill(){
  kill.classList.remove("armed"); void kill.offsetWidth; kill.classList.add("armed");
  document.querySelectorAll(".hbot, .card .front").forEach(e => e.classList.add("halted"));
  showToast("$ touch KILL  →  all bots: no new risk, flatten, exit. (demo only)");
  setTimeout(()=>document.querySelectorAll(".halted").forEach(e=>e.classList.remove("halted")), 3000);
}
kill.addEventListener("click", armKill);
kill.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); armKill(); } });

// ─── Portal buttons ─────────────────────────────────────────────────────
document.getElementById("portal-url").textContent = portalUrl;
document.querySelectorAll(".portal-link").forEach(a => {
  a.href = portalUrl;
  a.addEventListener("click", e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const w = document.createElement("div"); w.className = "warp";
    w.style.setProperty("--x", e.clientX + "px"); w.style.setProperty("--y", e.clientY + "px");
    document.body.appendChild(w);
    setTimeout(()=>{ location.href = portalUrl; }, 650);
  });
});

// ─── Starfield ──────────────────────────────────────────────────────────
const cv = document.getElementById("stars"), cx = cv.getContext("2d");
let W, H, stars = [];
function resize(){ W = cv.width = innerWidth; H = cv.height = innerHeight;
  stars = Array.from({length: Math.min(160, Math.floor(W*H/9000))}, () => ({x:Math.random()*W, y:Math.random()*H, z:Math.random()*1+.2, c:Math.random()<.5?"34,230,255":"255,61,242"})); }
resize(); addEventListener("resize", resize);
(function tick(){
  cx.clearRect(0,0,W,H);
  for (const s of stars){ s.y -= s.z*.35; if (s.y < -2){ s.y = H+2; s.x = Math.random()*W; }
    cx.fillStyle = `rgba(${s.c},${.25+s.z*.5})`; cx.fillRect(s.x, s.y, s.z*2, s.z*2); }
  requestAnimationFrame(tick);
})();
