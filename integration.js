
(() => {
  'use strict';
  const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
  const saveKey='vnl_vs_save_v7', dbKey='vnl_vs_players_v7', packsKey='vnl_vs_packs_v2';
  const PLACEHOLDERS=[
    'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png',
    'https://upload.wikimedia.org/wikipedia/commons/7/72/Placeholder_person.png',
    'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'
  ];
  function log(type,msg,meta){ try{ window.VNLErrorLog?.add(type,msg,meta);}catch(_){} }

  const Save = JSON.parse(localStorage.getItem(saveKey) || JSON.stringify({
    coins: 1000, collection:{}, team:[], achievements:{}, settings:{sfx:true,perf:false}
  }));
  function commit(){ localStorage.setItem(saveKey, JSON.stringify(Save)); $('#coin-count').textContent = Save.coins|0; }
  $('#coin-count').textContent = Save.coins|0;

  // Load DB
  let DB = JSON.parse(localStorage.getItem(dbKey) || 'null');
  async function loadDB(){
    try{
      const r=await fetch('players.json'); if(!r.ok) throw new Error('players.json not found');
      const arr=await r.json();
      const norm = arr.map(p=>({
        id:String(p.id), name:p.name, country:p.country||'Unknown',
        position:p.position||randomPos(), rarity:p.rarity||'Starter',
        stats:p.stats||{attack:50,defense:50,serve:50,overall:50},
        image:p.image||PLACEHOLDERS[Math.floor(Math.random()*PLACEHOLDERS.length)],
        sources:Array.isArray(p.sources)?p.sources:[]
      }));
      DB = norm;
      localStorage.setItem(dbKey, JSON.stringify(DB));
      selfCheckDB();
    }catch(e){
      log('db_load_error', e.message);
      if(!DB){ DB = demoDB(); localStorage.setItem(dbKey, JSON.stringify(DB)); }
    }
  }

  // Packs
  let PACKS = JSON.parse(localStorage.getItem(packsKey) || 'null');
  async function loadPacks(){
    try{
      const r=await fetch('packs.json'); if(!r.ok) throw new Error('packs.json not found');
      const j=await r.json(); PACKS = [
        {id:'starter',name:'Starter Pack',price:j.Starter.price,pulls:5,weights:j.Starter.distribution},
        {id:'pro',name:'Pro Pack',price:j.Pro.price,pulls:5,weights:j.Pro.distribution},
        {id:'legend',name:'Legend Pack',price:j.Legend.price,pulls:5,weights:j.Legend.distribution},
      ];
      localStorage.setItem(packsKey, JSON.stringify(PACKS));
    }catch(e){
      log('packs_load_error', e.message);
      if(!PACKS){
        PACKS=[
          {id:'starter',name:'Starter Pack',price:100,pulls:5,weights:{Starter:.75,Pro:.22,Legend:.03}},
          {id:'pro',name:'Pro Pack',price:400,pulls:5,weights:{Starter:.5,Pro:.45,Legend:.05}},
          {id:'legend',name:'Legend Pack',price:2000,pulls:5,weights:{Starter:.1,Pro:.3,Legend:.6}},
        ];
      }
    }
  }

  function randomPos(){ return ['OH','MB','OP','S','L'][Math.floor(Math.random()*5)]; }
  function demoDB(){
    const names=['Alex Smith','Chris Taylor','Jordan Lee','Sam Davis','Jamie Moore','Riley Brown','Morgan White','Cameron Garcia','Libby Green'];
    return names.map((n,i)=>({id:'demo-'+i, name:n, country:'Demo', position:i===8?'L':randomPos(), rarity:'Starter',
      stats:{attack:50,defense:60,serve:55,overall:55}, image:PLACEHOLDERS[i%PLACEHOLDERS.length], sources:['Demo']}));
  }

  function selfCheckDB(){
    try{
      const n = DB?.length||0;
      const lib = DB.filter(p=>p.position==='L').length;
      const missing = DB.filter(p=>!p.image).length;
      if(n<6) throw new Error('Too few players loaded');
      if(lib<1) log('warn','No liberos found in DB, gameplay may auto-pick non-L as fallback');
      if(missing>0) log('warn',`Missing images for ${missing} players`);
    }catch(e){ log('self_check_error', e.message); }
  }

  function show(id){ $$('.screen').forEach(s=>s.classList.add('hidden')); $('#'+id).classList.remove('hidden'); }

  // Shop
  function renderShop(){
    const grid = $('#shop-grid'); grid.innerHTML='';
    PACKS.forEach(pk=>{
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<h3>${pk.name}</h3>
        <p>Price: ${pk.price} 🟡</p>
        <p>Pulls: ${pk.pulls}</p>
        <button data-id="${pk.id}">Buy</button>`;
      el.querySelector('button').onclick=()=>buyPack(pk);
      grid.appendChild(el);
    });
  }
  function weightedPick(weights){
    const entries=Object.entries(weights);
    const total = entries.reduce((s,[,w])=>s+w,0);
    let r=Math.random()*total;
    for(const [k,w] of entries){ if((r-=w)<=0) return k; }
    return entries[0][0];
  }
  function buyPack(pk){
    try{
      if(Save.coins < pk.price){ alert('Not enough coins'); return; }
      Save.coins -= pk.price; commit();
      const pulls=[];
      for(let i=0;i<pk.pulls;i++){
        const rar = weightedPick(pk.weights);
        const pool = DB.filter(p=>p.rarity===rar);
        const pick = pool[Math.floor(Math.random()*pool.length)] || DB[Math.floor(Math.random()*DB.length)];
        pulls.push(pick);
        Save.collection[pick.id] = (Save.collection[pick.id]||0)+1;
      }
      commit();
      alert('You pulled:\\n' + pulls.map(p=>`${p.name} [${p.rarity}]`).join('\\n'));
    }catch(e){ log('pack_error', e.message); }
  }

  // Collection
  function renderCollection(){
    const grid=$('#collection-grid'); grid.innerHTML='';
    const ids=Object.keys(Save.collection);
    if(!ids.length){ grid.innerHTML='<p>No cards yet. Buy some packs!</p>'; return; }
    ids.map(id=>DB.find(p=>String(p.id)===String(id))).filter(Boolean).forEach(p=>{
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<img src="${p.image}" alt="${p.name}"><div><strong>${p.name}</strong><br>
        ${p.country} • ${p.position} • <em>${p.rarity}</em></div>`;
      grid.appendChild(el);
    });
  }

  // Match
  const canvas=$('#game'), ctx=canvas.getContext('2d');
  let running=false, ball, leftTeam=[], rightTeam=[], scoreL=0, scoreR=0, setNo=1, setsL=0, setsR=0, serveLeft=true;
  const keys={}; document.addEventListener('keydown',e=>keys[e.key]=true); document.addEventListener('keyup',e=>keys[e.key]=false);

  function mkSprite(x,left,meta){ return {x,y:420,vx:0,vy:0,w:28,h:64,left,jump:0,cd:0,meta,spd: meta.position==='L'? 3.5: 3.0}; }

  function chooseTeam(fromOwned,left){
    try{
      const ownedIds=Object.keys(Save.collection);
      const pool = ownedIds.length ? DB.filter(p=>ownedIds.includes(String(p.id))) : DB;
      const required = ['OH','MB','S','OP','OH','L']; // 6 on court, one Libero mandatory
      const picks = [];
      required.forEach((pos, idx)=>{
        let subset = pool.filter(p=>p.position===pos);
        if(subset.length===0){
          // fallback: any non-L for non-L slot, any L for L slot else any
          subset = pos==='L' ? pool.filter(p=>p.position==='L') : pool.filter(p=>p.position!=='L');
          log('warn','Fallback pick due to missing slot', {slot:pos});
        }
        const meta = subset[Math.floor(Math.random()*subset.length)] || pool[Math.floor(Math.random()*pool.length)];
        const baseX = left? 120: 1080;
        const step = left? 60: -60;
        picks.push(mkSprite(baseX + idx*step, left, meta));
      });
      return picks;
    }catch(e){ log('choose_team_error', e.message); return []; }
  }

  function refreshStrips(){
    function nodeFor(team){
      const wrap = document.createElement('div'); wrap.className='strip';
      team.forEach(p=>{
        const d=document.createElement('div'); d.className='pico' + (p.meta.position==='L'?' libero':'');
        const img=document.createElement('img'); img.alt=p.meta.name; img.src = p.meta.image || PLACEHOLDERS[Math.floor(Math.random()*PLACEHOLDERS.length)];
        d.title = `${p.meta.name} • ${p.meta.position} • ${p.meta.rarity}`;
        d.appendChild(img); wrap.appendChild(d);
      });
      return wrap;
    }
    const L=$('#strip-left'), R=$('#strip-right'); L.innerHTML=''; R.innerHTML='';
    L.appendChild(nodeFor(leftTeam)); R.appendChild(nodeFor(rightTeam));
  }

  function startMatch(){
    leftTeam = chooseTeam(true,true);
    rightTeam = chooseTeam(false,false);
    scoreL=scoreR=0; setsL=setsR=0; setNo=1; serveLeft=true;
    ball={x:serveLeft? 260:940, y:300, vx:0, vy:0, r:8};
    running=true; refreshStrips(); loop();
  }

  function physics(){
    // Player controls for leftTeam[0]
    const p=leftTeam[0];
    if(!p) return;
    if(keys['ArrowLeft']) p.vx=-p.spd; else if(keys['ArrowRight']) p.vx=p.spd; else p.vx*=0.8;
    if(keys[' '] && p.y>=420) p.vy=-9;
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.5; if(p.y>420){ p.y=420; p.vy=0; }
    p.x=Math.max(40, Math.min(560, p.x));

    // Simple AI
    function abs(v){ return v<0?-v:v; }
    function driveAI(team, leftSide){
      team.forEach((q,qi)=>{
        const baseTarget = leftSide? (ball.x<600? 300 : 420) : (ball.x>600? 900 : 780);
        let targetX = baseTarget + (qi* (leftSide? 40 : -40));
        if(q.meta.position==='L'){
          targetX = leftSide? (ball.x<600? ball.x-20 : 360) : (ball.x>600? ball.x+20 : 840);
        }
        const accel = (q.meta.position==='L'? 0.55: 0.40) * Math.sign(targetX - q.x);
        q.vx += accel; q.vx = Math.max(-(q.spd), Math.min(q.spd, q.vx));
        if(ball.y<350 && abs(q.x-ball.x)<30 && q.y>=420) q.vy = q.meta.position==='L'? -9 : -8;
        q.x+=q.vx; q.y+=q.vy; q.vy+=0.5; if(q.y>420){ q.y=420; q.vy=0; }
        const minX = leftSide? 40: 640, maxX = leftSide? 560: 1160;
        q.x=Math.max(minX, Math.min(maxX, q.x));
      });
    }
    driveAI(rightTeam,false);
    driveAI(leftTeam.slice(1),true);

    // Ball physics
    ball.vy+=0.45; ball.x+=ball.vx; ball.y+=ball.vy;
    if(ball.y>432){ ball.y=432; ball.vy*=-0.55; }
    if(ball.x<10){ ball.x=10; ball.vx*=-0.6; } if(ball.x>1190){ ball.x=1190; ball.vx*=-0.6; }
    if(ball.x>598 && ball.x<602 && ball.y>280 && ball.y<430){ ball.vx*=-0.8; }

    // Collisions
    function collide(team, leftSide){
      team.forEach(pl=>{
        if(Math.abs(ball.x - pl.x) < 22 && Math.abs(ball.y - (pl.y-32)) < 30){
          const isAboveNet = ball.y < 320;
          if(pl.meta.position==='L'){
            ball.vx = (ball.x - pl.x) * 0.3 + (leftSide? 2.5 : -2.5);
            ball.vy = -Math.max(6, Math.abs(ball.vy)*0.6 + 5);
          }else{
            const power = isAboveNet ? 0.9 : 0.6;
            const bias = leftSide? 4 : -4;
            ball.vx = (ball.x - pl.x) * power + bias;
            ball.vy = -Math.abs(ball.vy)*0.9 - (isAboveNet? 7:5);
          }
        }
      });
    }
    collide(leftTeam,true); collide(rightTeam,false);

    // Score on deep out-of-bounds on the ground
    if(ball.y>=432 && (ball.x<0 || ball.x>1200)){
      if(ball.x<0) scoreR++; else scoreL++; rotateServe();
    }
  }

  function drawCourt(){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,1200,600);
    ctx.fillStyle='#0b0f1a'; ctx.fillRect(0,0,1200,600);
    ctx.fillStyle='#1e293b'; ctx.fillRect(0,440,1200,160);
    ctx.fillStyle='#115e59'; ctx.fillRect(0,440,600,160);
    ctx.fillStyle='#7c2d12'; ctx.fillRect(600,440,600,160);
    ctx.fillStyle='#e5e7eb'; ctx.fillRect(598,280,4,160);

    ctx.beginPath(); ctx.arc(ball.x,ball.y,8,0,Math.PI*2); ctx.fillStyle='#ffd166'; ctx.fill();

    function drawTeam(team, color, liberoColor){
      team.forEach(pl=>{
        const jersey = pl.meta.position==='L'? liberoColor : color;
        ctx.fillStyle=jersey; ctx.fillRect(pl.x-14, pl.y-64, 28, 64);
        const img = new Image(); img.src = pl.meta.image || PLACEHOLDERS[0];
        const ix = Math.round(pl.x-16), iy = Math.round(pl.y-88);
        img.onload = () => ctx.drawImage(img, ix, iy, 32, 32);
        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(pl.x-34, pl.y-72, 68, 14);
        ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.textAlign='center';
        ctx.fillText(pl.meta.name.split(' ')[0], pl.x, pl.y-61);
      });
    }
    drawTeam(leftTeam, '#ff4d6d', '#facc15');
    drawTeam(rightTeam, '#00b4d8', '#f59e0b');
    $('#score-left').textContent = scoreL; $('#score-right').textContent = scoreR;
    $('#set-count').textContent = `Set ${setNo} / Best of 3`;
  }

  function rotateServe(){
    ball={x:serveLeft? 260:940, y:300, vx:0, vy:0, r:8}; serveLeft=!serveLeft;
    if(scoreL>=25 && scoreL-scoreR>=2){ setsL++; scoreL=scoreR=0; setNo++; }
    if(scoreR>=25 && scoreR-scoreL>=2){ setsR++; scoreL=scoreR=0; setNo++; }
    if(setsL===2 || setsR===2){
      alert(setsL===2?'You win!':'You lose');
      running=false; show('menu'); Save.coins += setsL===2? 120: 30; commit();
    }
  }
  function loop(){ if(!running) return; try{ physics(); drawCourt(); requestAnimationFrame(loop); }catch(e){ log('loop_error', e.message, {stack:e.stack}); running=false; alert('Game error. See debug tools for log.'); } }

  // UI
  function setupUI(){
    $('#btn-play').onclick=()=>{ startMatch(); show('match'); };
    $('#btn-exit').onclick=()=>{ running=false; show('menu'); };
    $('#btn-collection').onclick=()=>{ renderCollection(); show('collection'); };
    $('#btn-shop').onclick=()=>{ renderShop(); show('shop'); };
    $('#btn-settings').onclick=()=>{ show('settings'); };
    $('#back1').onclick=()=>show('menu'); $('#back2').onclick=()=>show('menu'); $('#back3').onclick=()=>show('menu');

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

  function startMatch(){
    leftTeam = chooseTeam(true,true);
    rightTeam = chooseTeam(false,false);
    scoreL=scoreR=0; setsL=setsR=0; setNo=1; serveLeft=true;
    ball={x:serveLeft? 260:940, y:300, vx:0, vy:0, r:8};
    running=true; refreshStrips(); loop();
  }

  (async function init(){
    await loadDB(); await loadPacks(); setupUI(); commit(); show('menu');
  })();
})();