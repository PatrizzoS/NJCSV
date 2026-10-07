// Run before CSS to restore the preference without a bright first paint.
(()=>{
 const system=window.matchMedia('(prefers-color-scheme: dark)');
 let preference=null;
 try{preference=localStorage.getItem('njcsv-theme');}catch{}
 const apply=theme=>{document.documentElement.dataset.theme=theme;};
 apply(preference==='dark'||preference==='light'?preference:system.matches?'dark':'light');
 window.njcsvTheme={toggle(){
  preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
  try{localStorage.setItem('njcsv-theme',preference);}catch{}
  apply(preference);window.dispatchEvent(new Event('themechange'));
 }};
 system.addEventListener('change',e=>{if(!preference){apply(e.matches?'dark':'light');window.dispatchEvent(new Event('themechange'));}});
})();
