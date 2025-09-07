
// error-logger.js — minimal client-side logging with localStorage + download
(function(){
  const KEY = 'vnl_error_log';
  function read(){ try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return [];} }
  function write(arr){ localStorage.setItem(KEY, JSON.stringify(arr).slice(0, 1_000_000)); } // cap ~1MB
  function add(type, msg, meta){
    const log = read();
    log.unshift({ t: new Date().toISOString(), type, msg: String(msg).slice(0,2000), meta: meta||null, ua:navigator.userAgent });
    if(log.length>500) log.length=500;
    write(log);
  }
  window.VNLErrorLog = {
    add,
    clear(){ localStorage.removeItem(KEY); },
    all: read,
    download(){
      const blob = new Blob([JSON.stringify(read(), null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vnl-error-log.json';
      a.click();
    }
  };
  // Global hooks
  window.addEventListener('error', (e)=> add('error', e.message, {file:e.filename,line:e.lineno,col:e.colno,stack:e.error&&e.error.stack}));
  window.addEventListener('unhandledrejection', (e)=> add('unhandledrejection', e.reason?.message || e.reason, {stack:e.reason?.stack}));
})();
