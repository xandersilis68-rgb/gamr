
(() => {
  'use strict';
  const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
  const saveKey='vnl_vs_save_v9', dbKey='vnl_vs_players_v7', packsKey='vnl_vs_packs_v2';
  const PLACEHOLDERS=[
    'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png',
    'https://upload.wikimedia.org/wikipedia/commons/7/72/Placeholder_person.png',
    'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'
  ];
  function log(type,msg,meta){ try{ window.VNLErrorLog?.add(type,msg,meta);}catch(_){} }
  let actx; function sfx(freq=880, dur=0.08, type='square'){ const sfxBox=$('#sfx'); if(sfxBox && !sfxBox.checked) return; try{ actx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=actx.createOscillator(); const g=actx.createGain(); o.frequency.value=freq; o.type=type; g.gain.value=0.05; o.connect(g); g.connect(actx.destination); o.start(); setTimeout(()=>o.stop(), dur*1000);}catch(_){} }

  const Save = JSON.parse(localStorage.getItem(saveKey) || JSON.stringify({
    coins: 1500, collection:{}, team:[], achievements:{}, settings:{sfx:true}
  }));
  function commit(){ localStorage.setItem(saveKey, JSON.stringify(Save)); $('#coin-count').textContent = Save.coins|0; }
  $('#coin-count').textContent = Save.coins|0;

  // DB + Packs
  let DB = JSON.parse(localStorage.getItem(dbKey) || 'null');
  async function loadDB(){
    try{
      const r=await fetch('players.json'); if(!r.ok) throw new Error('players.json not found');
      DB = await r.json();
      DB = DB.map(p=>({
        id:String(p.id), name:p.name, country:p.country||'Unknown',
        position:p.position||randPos(), rarity:p.rarity||'Starter',
        stats:p.stats||{attack:50,defense:50,serve:50,overall:50},
        image:(p.image||PLACEHOLDERS[Math.floor(Math.random()*PLACEHOLDERS.length)])
      }));
      localStorage.setItem(dbKey, JSON.stringify(DB));
    }catch(e){ log('db_load_error', e.message); if(!DB){ DB = demoDB(); localStorage.setItem(dbKey, JSON.stringify(DB)); } }
  }
  let PACKS = JSON.parse(localStorage.getItem(packsKey) || 'null');
  async function loadPacks(){
    try{
      const r=await fetch('packs.json'); if(!r.ok) throw new Error('packs.json not found');
      const j=await r.json(); PACKS = [
        {id:'starter',name:'Starter Pack',price:j.Starter.price,pulls:4,weights:j.Starter.distribution},
        {id:'pro',name:'Pro Pack',price:j.Pro.price,pulls:4,weights:j.Pro.distribution},
        {id:'legend',name:'Legend Pack',price:j.Legend.price,pulls:4,weights:j.Legend.distribution},
      ]; localStorage.setItem(packsKey, JSON.stringify(PACKS));
    }catch(e){ log('packs_load_error', e.message);
      if(!PACKS){ PACKS=[
        {id:'starter',name:'Starter Pack',price:100,pulls:4,weights:{Starter:.75,Pro:.22,Legend:.03}},
        {id:'pro',name:'Pro Pack',price:400,pulls:4,weights:{Starter:.5,Pro:.45,Legend:.05}},
        {id:'legend',name:'Legend Pack',price:2000,pulls:4,weights:{Starter:.1,Pro:.3,Legend:.6}},
      ]; }
    }
  }
  function randPos(){ return ['OH','MB','OP','S','L'][Math.floor(Math.random()*5)]; }
  function demoDB(){
    const names=['Alex Smith','Chris Taylor','Jordan Lee','Sam Davis','Jamie Moore','Riley Brown','Morgan White','Cameron Garcia','Libby Green'];
    return names.map((n,i)=>({id:'demo-'+i, name:n, country:'Demo', position:i===8?'L':randPos(), rarity:'Starter',
      stats:{attack:50,defense:60,serve:55,overall:55}, image:PLACEHOLDERS[i%PLACEHOLDERS.length]}));
  }

  function show(sectionId){
    ['home','match','select','collection','shop'].forEach(id => {
      const el = document.getElementById(id); if(!el) return;
      if(id===sectionId) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
  }

  // HERO canvas animation (makes it feel like a game menu)
  (function heroAnim(){
    const c = $('#hero-canvas'); if(!c) return; const ctx=c.getContext('2d');
    let t=0, sparks=[];
    function loop(){
      ctx.clearRect(0,0,c.width,c.height);
      // gradient bg
      const g=ctx.createLinearGradient(0,0,0,c.height); g.addColorStop(0,'#0a1226'); g.addColorStop(1,'#06101f'); ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height);
      // net
      ctx.fillStyle='#e5e7eb'; ctx.fillRect(c.width/2-2, 110, 4, 120);
      // ball bouncing
      const x = (Math.sin(t/40)*0.5+0.5)* (c.width-80) + 40;
      const y = 60 + Math.abs(Math.sin(t/18))*40;
      ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fillStyle='#ffd166'; ctx.fill();
      // sparks
      if(Math.random()<0.2) sparks.push({x,y,vx:(Math.random()-.5)*2,vy:-Math.random()*2-1,a:1});
      sparks = sparks.filter(s=>s.a>0.01);
      sparks.forEach(s=>{ s.x+=s.vx; s.y+=s.vy; s.a*=0.95; ctx.fillStyle=`rgba(255,200,80,${s.a})`; ctx.fillRect(s.x,s.y,2,2); });
      t++; requestAnimationFrame(loop);
    } loop();
  })();

  // SHOP + pack opening animation
  function renderShop(){
    const grid = $('#shop-grid'); grid.innerHTML='';
    PACKS.forEach(pk=>{
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<h3>${pk.name}</h3><p>Price: ${pk.price} 🟡</p><p>4 Cards • Weighted rarities</p><button data-id="${pk.id}">Buy</button>`;
      el.querySelector('button').onclick=()=>openPack(pk);
      grid.appendChild(el);
    });
  }
  function weightedPick(weights){
    const entries=Object.entries(weights); const total=entries.reduce((s,[,w])=>s+w,0);
    let r=Math.random()*total; for(const [k,w] of entries){ if((r-=w)<=0) return k; } return entries[0][0];
  }
  function pickByRarity(r){ const pool=DB.filter(p=>p.rarity===r); return pool[Math.floor(Math.random()*pool.length)] || DB[Math.floor(Math.random()*DB.length)]; }
  function openPack(pk){
    if(Save.coins < pk.price){ alert('Not enough coins'); return; }
    Save.coins -= pk.price; commit();
    const pulls = Array.from({length:pk.pulls}, ()=> pickByRarity(weightedPick(pk.weights)));
    const overlay=$('#pack-overlay'), box=$('#pack-box'), cardsWrap=$('#cards'), closeBtn=$('#close-pack');
    overlay.classList.remove('hidden'); cardsWrap.innerHTML=''; closeBtn.classList.add('hidden'); box.textContent='Tap to open'; box.style.animation='pulse 1.2s infinite';
    box.onclick=()=>{
      box.style.animation='none'; box.textContent=''; box.onclick=null; sfx(660,0.12);
      pulls.forEach((p,idx)=>{
        setTimeout(()=>{
          const el=document.createElement('div'); el.className='card-flip';
          el.innerHTML=`<div class="flip-inner rarity-${p.rarity}">
            <div class="flip-front">Card</div>
            <div class="flip-back">
              <img src="${p.image}" alt="${p.name}" style="width:100%;height:160px;object-fit:cover;border-radius:8px">
              <div style="font-weight:700">${p.name}</div>
              <div>${p.country} • ${p.position} • <em>${p.rarity}</em></div>
              <small>ATK ${p.stats.attack} DEF ${p.stats.defense} SRV ${p.stats.serve}</small>
            </div>
          </div>`;
          cardsWrap.appendChild(el);
          requestAnimationFrame(()=> el.querySelector('.flip-inner').classList.add('show'));
          Save.collection[p.id] = (Save.collection[p.id]||0)+1; commit();
          sfx(440+idx*80, 0.08, 'sawtooth');
          if(idx===pulls.length-1){ closeBtn.classList.remove('hidden'); }
        }, 400 + idx*650);
      });
    };
    closeBtn.onclick=()=> overlay.classList.add('hidden');
  }

  // Collection
  function renderCollection(){
    const grid=$('#collection-grid'); grid.innerHTML='';
    const ids=Object.keys(Save.collection);
    if(!ids.length){ grid.innerHTML='<p>No cards yet. Buy some packs!</p>'; return; }
    ids.map(id=>DB.find(p=>String(p.id)===String(id))).filter(Boolean).forEach(p=>{
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<img src="${p.image}" alt="${p.name}"><div><strong>${p.name}</strong><br>${p.country} • ${p.position} • <em>${p.rarity}</em></div>`;
      grid.appendChild(el);
    });
  }

  // Select team
  function renderSelect(){
    const grid=$('#sel-grid'); const q=$('#f-q'), pos=$('#f-pos'); const picked=$('#picked');
    function draw(){
      picked.innerHTML=''; Save.team.forEach(id=>{ const p=DB.find(x=>x.id===id); if(p){ const t=document.createElement('div'); t.className='tag'; t.textContent=`${p.name} • ${p.position}`; picked.appendChild(t);} });
      const list = DB.filter(p=>{
        const qv=q.value.trim().toLowerCase();
        if(pos.value && p.position!==pos.value) return false;
        if(qv && !(p.name.toLowerCase().includes(qv) || (p.country||'').toLowerCase().includes(qv))) return false;
        return true;
      }).slice(0,500);
      grid.innerHTML='';
      list.forEach(p=>{
        const el=document.createElement('div'); el.className='card';
        el.innerHTML=`<img src="${p.image}" alt="${p.name}"><div><strong>${p.name}</strong><br>${p.country} • ${p.position} • ${p.rarity}</div><button data-id="${p.id}">${Save.team.includes(p.id)?'Remove':'Add'}</button>`;
        el.querySelector('button').onclick=()=>{
          if(Save.team.includes(p.id)){ Save.team = Save.team.filter(x=>x!==p.id); }
          else{
            if(Save.team.length>=6) return alert('You already picked 6');
            if(Save.team.length===5){
              const hasL = Save.team.some(id => (DB.find(x=>x.id===id)||{}).position==='L');
              if(!hasL && p.position!=='L') return alert('You must include a Libero (L)');
            }
            Save.team.push(p.id);
          }
          commit(); draw();
        };
        grid.appendChild(el);
      });
    }
    q.oninput=draw; pos.onchange=draw; draw();
    $('#btn-save-team').onclick=()=>{
      if(Save.team.length!==6) return alert('Pick exactly 6 players including 1 Libero.');
      const hasL = Save.team.some(id => (DB.find(x=>x.id===id)||{}).position==='L');
      if(!hasL) return alert('Your 6 must include a Libero (L).');
      alert('Saved!'); commit(); show('home');
    };
    $$('.back-home').forEach(b=>b.onclick=()=>show('home'));
  }

  // Match engine
  const canvas=$('#game'), ctx=canvas.getContext('2d'); let running=false;
  let ball, leftTeam=[], rightTeam=[], scoreL=0, scoreR=0, setNo=1, setsL=0, setsR=0, serveLeft=true;
  let controlIndex=0; const keys={};
  document.addEventListener('keydown',e=>{ keys[e.key]=true;
    if(e.key==='q'||e.key==='Q') {controlIndex=(controlIndex+5)%6; refreshStrips(); sfx(780,0.07);}
    if(e.key==='e'||e.key==='E') {controlIndex=(controlIndex+1)%6; refreshStrips(); sfx(820,0.07);}
    if(/^[1-6]$/.test(e.key)) {controlIndex = parseInt(e.key)-1; refreshStrips(); sfx(700,0.07);}
  });
  document.addEventListener('keyup',e=>keys[e.key]=false);

  function mkSprite(x,left,meta,slot){ return {x,y:480,vx:0,vy:0,w:28,h:64,left,jump:0,cd:0,slot,meta,spd: meta.position==='L'? 3.8: 3.2}; }
  function chooseTeam(pool,left){ const required=['OH','MB','S','OP','OH','L']; const picks=[]; required.forEach((pos,idx)=>{
      let subset=pool.filter(p=>p.position===pos); if(!subset.length) subset = pos==='L'? pool.filter(p=>p.position==='L'): pool.filter(p=>p.position!=='L');
      const meta=subset[Math.floor(Math.random()*subset.length)] || pool[Math.floor(Math.random()*pool.length)];
      const baseX= left? 160: 1120; const step = left? 60: -60; picks.push(mkSprite(baseX + idx*step, left, meta, idx));
    }); return picks; }
  function buildLeftFromSave(){ if(Save.team.length===6){ const baseX=160, step=60; return Save.team.map((id,i)=>{ const meta=DB.find(p=>p.id===id) || DB[i]; return mkSprite(baseX+i*step, true, meta, i); }); } return chooseTeam(DB,true); }
  function refreshStrips(){
    function nodeFor(team, controlledIdx=null){
      const wrap=document.createElement('div'); wrap.className='strip';
      team.forEach((p,i)=>{ const d=document.createElement('div'); d.className='pico' + (p.meta.position==='L'?' libero':''); const img=document.createElement('img'); img.src=p.meta.image||PLACEHOLDERS[0]; d.title=`${p.meta.name} • ${p.meta.position} • ${p.meta.rarity}`; d.appendChild(img); if(controlledIdx===i) d.style.boxShadow='0 0 0 2px #fff'; wrap.appendChild(d); });
      return wrap;
    }
    const L=$('#strip-left'), R=$('#strip-right'); L.innerHTML=''; R.innerHTML=''; L.appendChild(nodeFor(leftTeam,controlIndex)); R.appendChild(nodeFor(rightTeam));
  }
  function startMatch(){
    leftTeam = buildLeftFromSave();
    rightTeam = chooseTeam(DB,false);
    controlIndex=0; scoreL=scoreR=0; setsL=setsR=0; setNo=1; serveLeft=true;
    ball={x:serveLeft? 280:1000, y:320, vx:0, vy:0, r:8, lastTouch:null};
    running=true; refreshStrips(); updateScore(); loop();
  }
  function updateScore(){ $('#score-left').textContent=scoreL; $('#score-right').textContent=scoreR; $('#set-count').textContent=`Set ${setNo} / Best of 3`; }

  function physics(){
    const p=leftTeam[controlIndex]; if(!p) return;
    // Selected controls
    if(keys['ArrowLeft']) p.vx=-p.spd; else if(keys['ArrowRight']) p.vx=p.spd; else p.vx*=0.82;
    if(keys[' '] && p.y>=480) p.vy=-9.6;
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.5; if(p.y>480){ p.y=480; p.vy=0; }
    p.x=Math.max(40, Math.min(620, p.x));
    // AI
    function driveAI(team, leftSide){
      team.forEach((q,qi)=>{
        if(leftSide && qi===controlIndex) return;
        const baseTarget = leftSide? (ball.x<640? 340 : 420) : (ball.x>640? 940 : 860);
        let targetX = baseTarget + (qi* (leftSide? 36 : -36));
        if(q.meta.position==='L'){ targetX = leftSide? (ball.x<640? ball.x-20 : 360) : (ball.x>640? ball.x+20 : 920); }
        const accel = (q.meta.position==='L'? 0.56: 0.42) * Math.sign(targetX - q.x);
        q.vx += accel; q.vx = Math.max(-(q.spd), Math.min(q.spd, q.vx));
        if(ball.y<380 && Math.abs(q.x-ball.x)<30 && q.y>=480) q.vy = q.meta.position==='L'? -9.6 : -8.6;
        q.x+=q.vx; q.y+=q.vy; q.vy+=0.5; if(q.y>480){ q.y=480; q.vy=0; }
        const minX = leftSide? 40: 660, maxX = leftSide? 620: 1240;
        q.x=Math.max(minX, Math.min(maxX, q.x));
      });
    }
    driveAI(rightTeam,false); driveAI(leftTeam,true);

    // Ball
    ball.vy+=0.45; ball.x+=ball.vx; ball.y+=ball.vy;

    // Net
    if(ball.x>638 && ball.x<642 && ball.y>300 && ball.y<480){ ball.vx*=-0.9; sfx(200,0.05); }

    // Player hits
    function hit(team, leftSide){
      team.forEach(pl=>{
        if(Math.abs(ball.x - pl.x) < 22 && Math.abs(ball.y - (pl.y-32)) < 30){
          const isAboveNet = ball.y < 320;
          ball.lastTouch = leftSide ? 'left':'right';
          if(pl.meta.position==='L'){
            ball.vx = (ball.x - pl.x) * 0.3 + (leftSide? 2.3 : -2.3);
            ball.vy = -Math.max(6.7, Math.abs(ball.vy)*0.6 + 5.7); sfx(900,0.06,'triangle');
          }else{
            const power = isAboveNet ? 1.0 : 0.7; const bias = leftSide? 5 : -5;
            ball.vx = (ball.x - pl.x) * power + bias; ball.vy = -Math.abs(ball.vy)*0.95 - (isAboveNet? 7.7:6.2); sfx(520,0.06,'square');
          }
        }
      });
    }
    hit(leftTeam,true); hit(rightTeam,false);

    // Floor landed → point immediately
    const groundY = 492;
    if(ball.y>=groundY){
      const landedLeft = ball.x < 640;
      endRally(landedLeft ? 'right' : 'left'); return;
    }
    // Out beyond sidelines
    if(ball.x<0 || ball.x>1280){ endRally(ball.x<0 ? 'right' : 'left'); return; }
  }

  function endRally(pointTo){
    if(pointTo==='left'){ scoreL++; } else { scoreR++; }
    sfx(pointTo==='left'? 880:440, 0.1, 'sine');
    updateScore();
    // Win set?
    if(scoreL>=25 && (scoreL-scoreR)>=2){ setsL++; scoreL=scoreR=0; setNo++; toast('Set won!'); }
    if(scoreR>=25 && (scoreR-scoreL)>=2){ setsR++; scoreL=scoreR=0; setNo++; toast('Set lost.'); }
    if(setsL===2 || setsR===2){
      toast(setsL===2?'Victory!':'Defeat'); Save.coins += setsL===2? 180: 50; commit(); running=false; show('home'); return;
    }
    // Serve to scoring side; rotate that side
    const scoringLeft = (pointTo==='left'); const servingSide = scoringLeft ? leftTeam : rightTeam;
    servingSide.push(servingSide.shift()); // rotate
    const serveX = scoringLeft? 280: 1000; ball={x:serveX,y:320,vx:0,vy:0,r:8,lastTouch:null};
    refreshStrips();
  }

  function drawCourt(){
    ctx.clearRect(0,0,1280,720);
    const grd=ctx.createLinearGradient(0,0,0,720); grd.addColorStop(0,'#0b1020'); grd.addColorStop(1,'#070b16');
    ctx.fillStyle=grd; ctx.fillRect(0,0,1280,720);
    ctx.fillStyle='#1e293b'; ctx.fillRect(0,520,1280,200);
    ctx.fillStyle='#0e4d64'; ctx.fillRect(0,520,640,200);
    ctx.fillStyle='#7c2d12'; ctx.fillRect(640,520,640,200);
    ctx.fillStyle='#e5e7eb'; ctx.fillRect(638,340,4,180);
    // ball
    ctx.beginPath(); ctx.arc(ball.x,ball.y,8,0,Math.PI*2); ctx.fillStyle='#ffd166'; ctx.fill();
    // players
    function drawTeam(team, color, liberoColor, controlIdx=null){
      team.forEach((pl,i)=>{
        const jersey = pl.meta.position==='L'? liberoColor : color;
        ctx.fillStyle=jersey; ctx.fillRect(pl.x-14, pl.y-64, 28, 64);
        if(controlIdx===i){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(pl.x-16, pl.y-66, 32, 68); }
        const img = new Image(); img.src = pl.meta.image || PLACEHOLDERS[0];
        const ix = Math.round(pl.x-16), iy = Math.round(pl.y-90);
        img.onload = () => ctx.drawImage(img, ix, iy, 32, 32);
        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(pl.x-34, pl.y-72, 68, 14);
        ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.textAlign='center';
        ctx.fillText(pl.meta.name.split(' ')[0], pl.x, pl.y-61);
      });
    }
    drawTeam(leftTeam, '#ff4d6d', '#facc15', controlIndex);
    drawTeam(rightTeam, '#00b4d8', '#f59e0b', null);
  }

  function loop(){ if(!running) return; try{ physics(); drawCourt(); requestAnimationFrame(loop); }catch(e){ log('loop_error', e.message); running=false; alert('Game error; check debug tools.'); } }

  // Helpers
  function toast(msg){ console.log('[TOAST]', msg); }

  // UI wiring
  function setupUI(){
    // Home buttons
    $('#play-now').onclick=()=>{ startMatch(); show('match'); };
    $('#open-packs').onclick=()=>{ renderShop(); show('shop'); };
    $('#team-select').onclick=()=>{ renderSelect(); show('select'); };
    // Topbar secondary
    $('#btn-collection').onclick=()=>{ renderCollection(); show('collection'); };
    $('#btn-settings').onclick=()=>{ alert('Only SFX toggle for now.'); };
    // Back buttons
    $$('.back-home').forEach(b=>b.onclick=()=>show('home'));
    // Exit from match
    $('#btn-exit').onclick=()=>{ running=false; show('home'); };
    // Export/Import
    $('#btn-export').onclick=()=>{
      const blob = new Blob([JSON.stringify(Save,null,2)], {type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vnl-volley-save.json'; a.click();
    };
    $('#file-import').onchange=(e)=>{
      const f=e.target.files[0]; if(!f) return;
      const rd=new FileReader(); rd.onload=()=>{ try{ const data=JSON.parse(rd.result); Object.assign(Save,data); commit(); alert('Save imported'); }catch(err){ alert('Bad file'); } };
      rd.readAsText(f);
    };
  }

  (async function init(){ await loadDB(); await loadPacks(); setupUI(); commit(); show('home'); })();
})(); 
