"use strict";
/* Property Tokenization view: ILLUSTRATIVE ONLY. No network calls, no wallets, no keys.
   All numbers below are estimates computed in the browser from the inputs on the page. */
(function(){
  const $ = id => document.getElementById(id);
  const usd = (v,d=0) => (v<0?"-":"") + "$" + Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
  const num = (v,d=0) => v.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
  const e = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const VALUE = 500000, SHARES = 500000, ASSUMED_RATE = 3.0;
  const ISS = "GEXAMPLEISSUER…PLACEHOLDER", DIST = "GEXAMPLEDISTRIBUTION…PLACEHOLDER", OWN = "GEXAMPLEHOMEOWNER…PLACEHOLDER", TRE = "CEXAMPLEVAULT…PLACEHOLDER", POOL = "CEXAMPLEBLENDPOOL…PLACEHOLDER", ORA = "CEXAMPLEREFLECTOR…PLACEHOLDER";
  const BILLS = [["Electricity",180],["Internet",70],["Water & sewer",85],["Home insurance (monthly share)",125],["Property tax (monthly escrow)",320],["Groceries",450]];

  const S = { deploy:50, mode:"assumed", live:"", freq:12, years:10, xlm:0.25, dest:"mortgage", spM:50, spI:30, mbal:300000, mrate:6.0, mterm:25, step:0, play:false, tab:"asset", prog:1 };

  function calc(){
    const rate = (S.mode==="live" && S.live!=="" && +S.live>=0) ? +S.live : ASSUMED_RATE;
    const r = rate/100, deployed = VALUE * Math.min(50,S.deploy)/100;
    const yearly = deployed*r, monthly = yearly/12;
    const f = S.freq, y = S.years;
    const comp = t => deployed*Math.pow(1+r/f, f*t);
    const series = []; for (let t=0;t<=y;t++) series.push({t, comp:comp(t), harv:deployed + deployed*r*t, prin:deployed});
    const compTotal = comp(y), apy = Math.pow(1+r/f,f)-1;
    return {rate, usingLive:(S.mode==="live" && S.live!=="" && +S.live>=0), deployed, yearly, monthly, compTotal, compEarn:compTotal-deployed, apy, series,
      perShareYear: yearly/SHARES, perShareMonth: monthly/SHARES, xlmAmt: S.xlm>0 ? deployed/S.xlm : 0, lentShares: SHARES*Math.min(50,S.deploy)/100};
  }
  function split(){
    if (S.dest==="mortgage") return {m:1,i:0,b:0};
    if (S.dest==="income") return {m:0,i:1,b:0};
    if (S.dest==="bills") return {m:0,i:0,b:1};
    const m = S.spM/100, i = Math.min(S.spI/100, 1-m); return {m, i, b: Math.max(0,1-m-i)};
  }
  function mortgage(extra){
    const P0 = Math.max(0,+S.mbal||0), n = Math.max(1,Math.round((+S.mterm||1)*12)), r = (+S.mrate||0)/100/12;
    const pmt = r===0 ? P0/n : P0*r/(1-Math.pow(1+r,-n));
    const run = ex => { let bal=P0, int=0, k=0; const atYears = {}; const target = S.years*12;
      let balAtT = null;
      while (bal>0.005 && k<n+1){ const i = bal*r; let pr = pmt - i + ex; if (pr>bal) pr = bal; bal -= pr; int += i; k++; if (k===target) balAtT = bal; }
      if (balAtT===null) balAtT = bal>0.005?bal:0; return {months:k, interest:int, balAtT}; };
    return {pmt, base:run(0), withX:run(extra), P0, n};
  }
  const ym = m => { const y=Math.floor(m/12), mo=m%12; return `${y} yr ${mo} mo`; };

  /* ---------- tiles / chart / destination ---------- */
  function renderTiles(c){
    const t = (l,v,s,hl) => `<div class="tile${hl?" hl":""}"><label>${l}</label><b>${v}</b><small>${s}</small></div>`;
    $("tiles").innerHTML =
      t("Share tokens minted", num(SHARES)+" HOUSE1", "1:1 with SPV shares · est.") +
      t("Value lent (max 50%)", usd(c.deployed), `${num(c.lentShares)} shares-worth · not lent: ${usd(VALUE-c.deployed)}`) +
      t("Est. per month", usd(c.monthly), `${c.usingLive?"MANUAL "+c.rate.toFixed(2)+"%":"ASSUMED 3.00%"} · simple`, true) +
      t("Est. per year", usd(c.yearly), "gross, before fees/tax", true) +
      t("Effective APY", (c.apy*100).toFixed(3)+"%", `compounded ${S.freq===365?"daily":S.freq===52?"weekly":S.freq===12?"monthly":S.freq===4?"quarterly":"annually"}`) +
      t(`Compounded, ${S.years} yr`, usd(c.compTotal), `+${usd(c.compEarn)} est. interest`, true) +
      t("Per-share yield / yr", "$"+c.perShareYear.toFixed(4), `${(c.perShareYear/(VALUE/SHARES)*100).toFixed(2)}% of $1.00 ref. share`) +
      t("Per-share / month", "$"+c.perShareMonth.toFixed(5), "yield ÷ 500,000 shares") +
      t("Lent amount in XLM", num(c.xlmAmt)+" XLM", `@ $${(+S.xlm).toFixed(2)} placeholder (Reflector SEP-40 in concept)`);
  }
  function drawChart(c, prog){
    const cv = $("growth"), g = cv.getContext("2d"), W = cv.width, H = cv.height, L=70, R=22, T=14, B=34;
    g.clearRect(0,0,W,H);
    const pts = c.series, maxY = Math.max(c.compTotal, c.deployed*1.02, 1), minY = Math.min(c.deployed*0.98, c.deployed);
    const X = t => L + (t/Math.max(1,S.years))*(W-L-R), Y = v => T + (1-(v-minY)/Math.max(1e-9,maxY-minY))*(H-T-B);
    g.font = "12px ui-monospace,monospace"; g.fillStyle="#7d8b9f"; g.strokeStyle="#223041"; g.lineWidth=1;
    for (let i=0;i<=4;i++){ const v = minY+(maxY-minY)*i/4, y = Y(v); g.beginPath(); g.moveTo(L,y); g.lineTo(W-R,y); g.stroke(); g.fillText(usd(v), 4, y+4); }
    const step = Math.max(1,Math.ceil(S.years/8)); for (let t=0;t<=S.years;t+=step){ g.fillText("yr "+t, Math.min(X(t)-12, W-44), H-12); }
    const lastN = Math.max(1, Math.round(pts.length-1)*prog);
    const line = (key,col,dash,w=2) => { g.strokeStyle=col; g.lineWidth=w; g.setLineDash(dash||[]); g.beginPath();
      const steps = 80; for (let k=0;k<=steps;k++){ const t = lastN*k/steps; let v;
        if (key==="comp") v = c.deployed*Math.pow(1+c.rate/100/S.freq, S.freq*t);
        else if (key==="harv") v = c.deployed + c.deployed*c.rate/100*t; else v = c.deployed;
        k?g.lineTo(X(t),Y(v)):g.moveTo(X(t),Y(v)); } g.stroke(); g.setLineDash([]); };
    line("prin","#718096",[5,4],1.5); line("harv","#f6ad55"); line("comp","#4fd1c5",null,2.5);
    if (prog>=1){ g.fillStyle="#4fd1c5"; g.fillText(usd(c.compTotal), Math.max(L, X(S.years)-86), Y(c.compTotal)-8); g.fillStyle="#f6ad55"; const hv = c.deployed + c.deployed*c.rate/100*S.years; g.fillText(usd(hv), Math.max(L, X(S.years)-86), Y(hv)+16); }
    g.fillStyle="#7d8b9f"; g.fillText("ESTIMATE · ILLUSTRATIVE · "+(c.usingLive?"manual":"ASSUMED")+" "+c.rate.toFixed(2)+"%", L+6, T+10);
  }
  let animT = null;
  function animateChart(){ cancelAnimationFrame(animT); const c = calc(); if (matchMedia("(prefers-reduced-motion:reduce)").matches){ drawChart(c,1); return; }
    const t0 = performance.now(); (function f(now){ const p = Math.min(1,(now-t0)/900); drawChart(c, 1-Math.pow(1-p,3)); if (p<1) animT = requestAnimationFrame(f); })(t0); }

  function renderDest(c){
    const sp = split(), out = [];
    const mAmt = c.monthly*sp.m, iAmt = c.monthly*sp.i, bAmt = c.monthly*sp.b;
    if (sp.m>0){
      const mg = mortgage(mAmt);
      const saved = mg.base.months - mg.withX.months;
      out.push(`<div class="dblock"><h5>① Mortgage paydown <span class="chip warn-chip">ASSUMED TERMS</span></h5><div class="kv">
        <div><span>Extra principal / month</span><b>${usd(mAmt)}</b></div>
        <div><span>Extra principal / year</span><b>${usd(mAmt*12)}</b></div>
        <div><span>Scheduled payment (P&amp;I)</span><b>${usd(mg.pmt)}/mo</b></div>
        <div><span>Payoff without extra</span><b>${ym(mg.base.months)}</b></div>
        <div><span>Payoff with extra</span><b class="pos">${ym(mg.withX.months)}</b></div>
        <div><span>Time saved</span><b class="pos">${saved>0?ym(saved):"none"}</b></div>
        <div><span>Interest saved (est.)</span><b class="pos">${usd(mg.base.interest-mg.withX.interest)}</b></div>
        <div><span>Balance after ${S.years} yr</span><b>${usd(mg.withX.balAtT)} <span class="muted">vs ${usd(mg.base.balAtT)}</span></b></div></div>
        <div class="bar" title="share of the original term remaining"><i style="width:${Math.max(2,mg.withX.months/mg.base.months*100)}%"></i></div>
        <p class="fine">Payments to the servicer happen off-chain. The ${usd(mg.P0)} balance, ${(+S.mrate).toFixed(2)}% rate and ${S.mterm}-yr term are ASSUMED, not a real loan.</p></div>`);
    }
    if (sp.i>0){
      out.push(`<div class="dblock"><h5>② Passive income to wallet <span class="chip warn-chip">ESTIMATE</span></h5><div class="kv">
        <div><span>Payout / month</span><b>${usd(iAmt,2)}</b></div>
        <div><span>Payout / year</span><b>${usd(iAmt*12,2)}</b></div>
        <div><span>Per share / year (on payout)</span><b>$${(iAmt*12/SHARES).toFixed(5)}</b></div>
        <div><span>Destination</span><b class="mono">${e(OWN)}</b></div>
        <div><span>Paid as</span><b>EXUSD (placeholder stablecoin) · Stellar payment</b></div></div>
        <p class="fine">Non-custodial: you hold the keys in Freighter, LOBSTR, xBull or Scopuly. The app never sees them. Taxes not modeled.</p></div>`);
    }
    if (sp.b>0){
      let left = bAmt; const rows = BILLS.map(([n,a])=>{ const cov = Math.min(a,left); left -= cov; return `<div class="bill"><span>${e(n)}</span><b class="mono">${usd(cov)} / ${usd(a)}</b><div class="bar"><i style="width:${a?cov/a*100:0}%"></i></div></div>`; }).join("");
      out.push(`<div class="dblock"><h5>③ Bills / spend bucket <span class="chip warn-chip">EXAMPLE BILLS</span></h5>
        <div class="kv"><div><span>Available per month</span><b>${usd(bAmt,2)}</b></div><div><span>Left over after the list</span><b>${usd(Math.max(0,left),2)}</b></div></div>${rows}
        <p class="fine">Illustrative bill amounts. The homeowner decides where it goes; a real payout would go to a bank/card via an anchor off-ramp, or stay in the wallet.</p></div>`);
    }
    if (!out.length) out.push(`<div class="dblock">Nothing allocated. Move a slider.</div>`);
    $("dest-out").innerHTML = out.join("");
    const sb = $("splitbar"); if (sb){ sb.innerHTML = `<i style="width:${sp.m*100}%;background:#63b3ed"></i><i style="width:${sp.i*100}%;background:#4fd1c5"></i><i style="width:${sp.b*100}%;background:#f6ad55"></i>`; }
    $("out-sp-b").textContent = Math.round(sp.b*100)+"%";
    // stage 6
    const ic = {mortgage:"🏠",income:"💰",bills:"🧾",custom:"🔀"}[S.dest];
    const T6 = {mortgage:["Yield → mortgage paydown", `≈${usd(mAmt)}/mo extra principal via the servicer (off-chain)`, "ON → OFF-CHAIN"],
      income:["Yield → owner wallet", `≈${usd(iAmt)}/mo paid to the owner's non-custodial wallet`, "STELLAR TESTNET"],
      bills:["Yield → bills bucket", `≈${usd(bAmt)}/mo for bills & spending`, "ON → OFF-CHAIN"],
      custom:["Yield split", `${Math.round(sp.m*100)}% mortgage · ${Math.round(sp.i*100)}% income · ${Math.round(sp.b*100)}% bills`, "ON + OFF-CHAIN"]}[S.dest];
    $("stage6-ic").textContent = ic; $("stage6-title").textContent = T6[0]; $("stage6-sub").textContent = T6[1]; $("stage6-loc").textContent = T6[2];
    renderDetail(); renderMock();
    // overview KPI
    $("kpi-token-main").textContent = "~"+usd(c.yearly)+" / yr";
    $("kpi-token-sub").textContent = `est. · $500K home · ${usd(c.deployed)} lent · ${c.usingLive?"manual "+c.rate.toFixed(2)+"%":"ASSUMED 3%"} · lending yield, not rent`;
  }

  /* ---------- pipeline ---------- */
  function destLine(){ return {mortgage:"Yield pays extra principal on the mortgage (servicer integration is off-chain and not real here).", income:"Yield is paid to the owner's non-custodial wallet as passive income.", bills:"Yield goes to a spend bucket for bills or anything the homeowner chooses.", custom:"Yield is split across mortgage paydown, passive income and bills."}[S.dest]; }
  const DETAIL = [
    () => ["1 · Deed, title review & appraisal (off-chain)", ["A title company / attorney confirms who owns the property and that title is clear of problem liens.","An independent appraiser values the home: <b>$500,000</b> in this example (illustrative).","These are the only inputs that cannot be proven on-chain. They stay off-chain; only a hash of the documents and the appraised value are recorded later."]],
    () => ["2 · Legal wrapper: SPV holds the deed (off-chain)", ["The deed is transferred to a single-purpose legal entity (an LLC/trust, the SPV). A custodian/trustee holds it.","The SPV's equity is divided into <b>500,000 shares</b> (reference $1.00 each, illustrative). Holders' rights come from the operating agreement.","Securities, property and tax rules decide who may buy the shares and how they are offered."]],
    () => ["3 · Record the value on Stellar testnet and issue the share token", ["A <b>Soroban vault contract</b> records the property's value, appraisal date and document hash.","An <b>issuer account</b> creates asset <code>HOUSE1</code> (made-up code). Issuer flags: <code>AUTH_REQUIRED</code>, <code>AUTH_REVOCABLE</code>, <code>AUTH_CLAWBACK_ENABLED</code>.","<b>SEP-8</b> approval server + <b>SEP-24</b>/SEP-12 KYC gate who can hold and transfer the shares. The asset's <code>stellar.toml</code> (SEP-1) advertises it."]],
    () => ["4 · Mint to the owner's non-custodial wallet", ["The owner passes KYC, opens a <b>trustline</b> to <code>HOUSE1</code>, and the issuer authorizes it.","500,000 shares move issuer → distribution account → owner wallet. The share register ties the wallet to the holder.","Wallets: Freighter, LOBSTR, xBull, Scopuly. The app never holds private keys. Testnet only."]],
    () => ["5 · Lend up to 50% through Blend", [`Up to 50% of the recorded value (<b>${usd(calc().deployed)}</b> of $500,000) is supplied to a <b>Blend</b> lending pool to earn borrower interest.`,"<b>Reflector</b> price feeds (SEP-40 <code>lastprice</code>) value the position, including XLM conversion.","Compounds on the frequency you choose. Rate: Blend's variable rate, or an <b>ASSUMED 3%</b>.","<b>Yield comes from lending, not rent.</b> Risks: smart-contract bugs, oracle errors, liquidation shortfalls, withdrawal liquidity, rate swings."]],
    () => [`6 · ${$("stage6-title").textContent}`, [destLine(),"<b>Reporting:</b> the SPV publishes holder statements and tax documents; on-chain payments are visible to anyone with the address.","<b>Redemption / secondary:</b> shares are redeemed through the SPV or traded only between authorized holders (Stellar DEX offers or an anchor), subject to SEP-8 approval and legal limits."]]
  ];
  function renderDetail(){ const d = DETAIL[S.step](); $("stage-detail").innerHTML = `<h4>${e(d[0])}</h4><ul>${d[1].map(x=>`<li>${x}</li>`).join("")}</ul>`; }
  function setStep(i){
    S.step = (i+6)%6;
    document.querySelectorAll("#pipeline .stage").forEach((el,k)=>{ el.classList.toggle("active",k===S.step); el.classList.toggle("done",k<S.step); });
    const pk = $("packet"), el = document.querySelector(`#pipeline .stage[data-i="${S.step}"]`), pl = $("pipeline");
    if (el && pk.offsetParent!==null) pk.style.left = (el.offsetLeft + el.offsetWidth/2 - 7)+"px";
    renderDetail();
  }
  let timer = null;
  function setPlay(on){ S.play = on; clearInterval(timer); $("pl-play").textContent = on ? "❚❚ Pause" : "▶ Play"; $("pl-play").setAttribute("aria-pressed", on); if (on) timer = setInterval(()=>{ if (document.body.dataset.view==="tokenization") setStep(S.step+1); }, 3800); }

  /* ---------- mock stellar view ---------- */
  function renderMock(){
    const c = calc(), sp = split(), el = $("mock"), row = (a,b)=>`<div class="row"><span>${a}</span><span>${b}</span></div>`;
    const tx = (n,hash,ops) => `<div class="tx"><div class="h"><span>#${n} · hash 0000…EXAMPLE${n}</span><span>TESTNET · fake · ${e(hash)}</span></div>${ops.map(o=>`<div class="op">${o}</div>`).join("")}</div>`;
    let harvest;
    if (S.dest==="mortgage") harvest = ["<b>invoke</b> vault.harvest() → blend_pool.submit(Withdraw interest)","<b>payment</b> vault → anchor-account EXUSD "+num(c.monthly*sp.m,2)+" · memo:'SERVICER-REF-EXAMPLE'","<b>off-chain</b> anchor/SEP-24 withdrawal → servicer applies as extra principal (not real)"];
    else if (S.dest==="income") harvest = ["<b>invoke</b> vault.harvest() → blend_pool.submit(Withdraw interest)","<b>payment</b> vault → "+OWN+" EXUSD "+num(c.monthly*sp.i,2)];
    else if (S.dest==="bills") harvest = ["<b>invoke</b> vault.harvest() → blend_pool.submit(Withdraw interest)","<b>payment</b> vault → "+OWN+" EXUSD "+num(c.monthly*sp.b,2)+" · memo:'BILLS'","<b>off-chain</b> owner spends via bank/card off-ramp (illustrative)"];
    else harvest = ["<b>invoke</b> vault.harvest() → blend_pool.submit(Withdraw interest)","<b>payment</b> "+num(c.monthly*sp.i,2)+" EXUSD → owner · <b>payment</b> "+num(c.monthly*sp.b,2)+" EXUSD → bills bucket","<b>payment</b> "+num(c.monthly*sp.m,2)+" EXUSD → anchor-account (servicer, off-chain)"];
    if (S.tab==="asset"){
      el.innerHTML = `<h6>HOUSE1 · real estate share token</h6>` + row("Network","Stellar TESTNET (concept)") + row("Asset code","HOUSE1 (made up)") + row("Asset type","credit_alphanum12") + row("Issuer",ISS) + row("Represents","500,000 shares of EXAMPLE HOUSE 1 SPV LLC (fictional)") + row("Reference value","$1.00 / share (illustrative)") + row("Circulating supply","500,000.0000000") + row("Holders","1 (homeowner)") + row("Regulated (SEP-8)","yes · approval server: example.invalid") + row("Clawback","enabled (compliance)") + row("Vault (Soroban)",TRE) + row("Blend pool",POOL) + row("Price oracle (SEP-40)",ORA) + row("Lent now",usd(c.deployed)+" ("+Math.min(50,S.deploy)+"% of value)");
    } else if (S.tab==="issuer"){
      el.innerHTML = `<h6>Issuer account flags</h6>` + row("Account",ISS) + row("home_domain","house1.example.invalid") + `<div class="flag"><i></i>AUTH_REQUIRED (0x1) · issuer must approve each trustline</div><div class="flag"><i></i>AUTH_REVOCABLE (0x2) · issuer can freeze / limit a trustline</div><div class="flag"><i></i>AUTH_CLAWBACK_ENABLED (0x8) · needs revocable; compliance recovery</div><div class="flag"><i style="background:#718096"></i>AUTH_IMMUTABLE (0x4) · NOT set (it would remove these controls)</div>` + row("Signers","multisig 2-of-3 (concept)") + `<p class="fine">set_options flags = 0x1 | 0x2 | 0x8 = 11. An issuer that keeps these powers cannot be locked, so key custody and governance matter.</p>`;
    } else if (S.tab==="txs"){
      el.innerHTML =
        tx(1,"setup",["<b>create_account</b> "+ISS,"<b>create_account</b> "+DIST+" (testnet: funded by Friendbot)"]) +
        tx(2,"flags",["<b>set_options</b> "+ISS+" set_flags=11 home_domain=house1.example.invalid"]) +
        tx(3,"trust",["<b>change_trust</b> "+OWN+" → HOUSE1:"+ISS+" limit 500000","<b>set_trust_line_flags</b> issuer authorizes "+OWN+" (AUTHORIZED)"]) +
        tx(4,"mint",["<b>payment</b> "+ISS+" → "+DIST+" 500000 HOUSE1","<b>payment</b> "+DIST+" → "+OWN+" 500000 HOUSE1"]) +
        tx(5,"record",["<b>invoke</b> "+TRE+" record_property(value=500000, appraisal_hash=0xEXAMPLE)"]) +
        tx(6,"price",["<b>invoke</b> "+ORA+" lastprice(Asset::Other('XLM')) → PriceData{price (÷10^decimals()), timestamp}"]) +
        tx(7,"lend",["<b>invoke</b> "+TRE+" allocate("+num(c.deployed)+") → "+POOL+" submit(requests=[{SupplyCollateral, asset=EXUSD, amount}])"]) +
        tx(8,"harvest",harvest);
    } else {
      el.innerHTML = `<pre>[DOCUMENTATION]
ORG_NAME="Example House 1 SPV LLC (FICTIONAL)"

[[CURRENCIES]]
code="HOUSE1"
issuer="${ISS}"
name="Example House 1 share (fictional)"
desc="Illustrative real estate share token. Not an offer."
anchor_asset_type="realestate"
is_asset_anchored=false
regulated=true
approval_server="https://approval.example.invalid/tx-approve"
approval_criteria="KYC + holder limits + lock-up (illustrative)"

TRANSFER_SERVER_SEP0024="https://anchor.example.invalid/sep24"</pre>`;
    }
  }

  /* ---------- wiring ---------- */
  function recalc(chart){ const c = calc(); renderTiles(c); renderDest(c); if (chart) animateChart(); else drawChart(c,1); }
  function bind(){
    $("in-deploy").addEventListener("input", ev=>{ S.deploy = +ev.target.value; $("out-deploy").textContent = S.deploy+"%"; recalc(false); });
    $("in-years").addEventListener("input", ev=>{ S.years = +ev.target.value; $("out-years").textContent = S.years+" yrs"; recalc(false); });
    $("in-freq").addEventListener("change", ev=>{ S.freq = +ev.target.value; recalc(true); });
    $("in-xlm").addEventListener("input", ev=>{ S.xlm = +ev.target.value||0; recalc(false); });
    $("rate-mode").addEventListener("click", ev=>{ const b = ev.target.closest("button"); if(!b) return; S.mode = b.dataset.m;
      document.querySelectorAll("#rate-mode button").forEach(x=>x.classList.toggle("on",x===b));
      $("live-row").classList.toggle("hidden", S.mode!=="live"); $("live-note").classList.toggle("hidden", S.mode!=="live"); recalc(true); });
    $("in-live").addEventListener("input", ev=>{ S.live = ev.target.value; recalc(false); });
    $("dest").addEventListener("click", ev=>{ const b = ev.target.closest("button"); if(!b) return; S.dest = b.dataset.d;
      document.querySelectorAll("#dest button").forEach(x=>{ x.classList.toggle("on",x===b); x.setAttribute("aria-checked", x===b); });
      $("split").classList.toggle("hidden", S.dest!=="custom"); recalc(false); setStep(5); });
    $("in-sp-m").addEventListener("input", ev=>{ S.spM = +ev.target.value; if (S.spM+S.spI>100){ S.spI = 100-S.spM; $("in-sp-i").value = S.spI; } $("out-sp-m").textContent = S.spM+"%"; $("out-sp-i").textContent = S.spI+"%"; recalc(false); });
    $("in-sp-i").addEventListener("input", ev=>{ S.spI = +ev.target.value; if (S.spM+S.spI>100){ S.spM = 100-S.spI; $("in-sp-m").value = S.spM; } $("out-sp-m").textContent = S.spM+"%"; $("out-sp-i").textContent = S.spI+"%"; recalc(false); });
    [["in-mbal","mbal"],["in-mrate","mrate"],["in-mterm","mterm"]].forEach(([id,k])=>$(id).addEventListener("input", ev=>{ S[k] = +ev.target.value; recalc(false); }));
    $("mock-tabs").addEventListener("click", ev=>{ const b = ev.target.closest("button"); if(!b) return; S.tab = b.dataset.t; document.querySelectorAll("#mock-tabs button").forEach(x=>x.classList.toggle("on",x===b)); renderMock(); });
    document.querySelectorAll("#pipeline .stage").forEach(el=>{ el.addEventListener("click", ()=>{ setPlay(false); setStep(+el.dataset.i); }); el.addEventListener("keydown", ev=>{ if (ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); setPlay(false); setStep(+el.dataset.i); } }); });
    $("pl-play").addEventListener("click", ()=>setPlay(!S.play));
    $("pl-next").addEventListener("click", ()=>{ setPlay(false); setStep(S.step+1); });
    $("pl-prev").addEventListener("click", ()=>{ setPlay(false); setStep(S.step-1); });
    document.addEventListener("viewchange", ev=>{ if (ev.detail==="tokenization"){ setStep(S.step); animateChart(); if (!matchMedia("(prefers-reduced-motion:reduce)").matches && !S.userPaused) setPlay(true); } else setPlay(false); });
    addEventListener("resize", ()=>{ if (document.body.dataset.view==="tokenization") setStep(S.step); });
  }
  bind(); recalc(false); setStep(0); setPlay(false);
  if (document.body.dataset.view==="tokenization"){ animateChart(); if (!matchMedia("(prefers-reduced-motion:reduce)").matches) setPlay(true); }
})();
