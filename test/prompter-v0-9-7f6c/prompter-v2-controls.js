(()=>{
  const $=id=>document.getElementById(id);
  const line=$('readingLine');
  const bg=$('promptBackground');
  if(line){
    line.addEventListener('input',e=>{
      $('lineOut').textContent=e.target.value;
      document.documentElement.style.setProperty('--reading-line-top',`${e.target.value}%`);
    });
  }
  if(bg){
    bg.addEventListener('change',e=>{
      const shades={clear:'rgba(0,0,0,0)',light:'rgba(0,0,0,.16)',dark:'rgba(0,0,0,.38)'};
      document.documentElement.style.setProperty('--prompt-bg',shades[e.target.value]||shades.light);
    });
  }
})();
