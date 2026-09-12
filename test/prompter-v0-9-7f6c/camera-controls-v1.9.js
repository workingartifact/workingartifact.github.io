(() => {
  const $ = id => document.getElementById(id);
  const preview = $('preview');
  let lastTrack = null;

  function track(){
    const s = preview && preview.srcObject;
    return s && s.getVideoTracks ? s.getVideoTracks()[0] : null;
  }
  function caps(){
    const t = track();
    return t && t.getCapabilities ? t.getCapabilities() : {};
  }
  function message(text, ok=true){
    const el = $('cameraControlStatus');
    if(!el) return;
    el.textContent = text;
    el.style.color = ok ? 'var(--muted)' : 'var(--danger)';
  }
  function sync(){
    const t = track();
    const active = !!t;
    ['lockWbBtn','lockExposureBtn','lockFocusBtn','cameraAutoBtn'].forEach(id=>{ if($(id)) $(id).disabled=!active; });
    if(!t){
      if($('cameraControlReadout')) $('cameraControlReadout').textContent='Start camera to inspect controls';
      if($('colorTemperature')) $('colorTemperature').disabled=true;
      return;
    }
    const c = caps();
    const s = t.getSettings ? t.getSettings() : {};
    const wb = $('whiteBalanceMode');
    const temp = $('colorTemperature');
    const exp = $('exposureMode');
    const ev = $('exposureCompensation');
    const focus = $('focusMode');
    if(wb){
      const modes = Array.isArray(c.whiteBalanceMode) ? c.whiteBalanceMode : [];
      wb.disabled=!modes.length;
      if(s.whiteBalanceMode) wb.value=s.whiteBalanceMode;
    }
    if(temp){
      if(c.colorTemperature){
        temp.min=c.colorTemperature.min; temp.max=c.colorTemperature.max; temp.step=c.colorTemperature.step||50;
        if(Number(s.colorTemperature)>0) temp.value=s.colorTemperature;
        $('kelvinOut').textContent=Math.round(Number(temp.value));
        temp.disabled = wb ? wb.value!=='manual' : true;
      }else temp.disabled=true;
    }
    if(exp){
      const modes = Array.isArray(c.exposureMode) ? c.exposureMode : [];
      exp.disabled=!modes.length;
      if(s.exposureMode) exp.value=s.exposureMode;
    }
    if(ev){
      if(c.exposureCompensation){
        ev.min=c.exposureCompensation.min; ev.max=c.exposureCompensation.max; ev.step=c.exposureCompensation.step||0.1666667;
        if(Number.isFinite(Number(s.exposureCompensation))) ev.value=s.exposureCompensation;
        $('exposureOut').textContent=Number(ev.value).toFixed(1);
        ev.disabled=false;
      }else ev.disabled=true;
    }
    if(focus){
      const modes = Array.isArray(c.focusMode) ? c.focusMode : [];
      focus.disabled=!modes.length;
      if(s.focusMode) focus.value=s.focusMode;
    }
    if($('cameraControlReadout')){
      const evText = Number.isFinite(Number(s.exposureCompensation)) ? `${Number(s.exposureCompensation).toFixed(1)} EV` : 'n/a';
      $('cameraControlReadout').textContent=`WB ${s.whiteBalanceMode||'n/a'} • Exposure ${s.exposureMode||'n/a'} ${evText} • Focus ${s.focusMode||'n/a'}`;
    }
  }
  async function apply(values, success){
    const t=track();
    if(!t || !t.applyConstraints){ message('Start the camera before changing camera controls.',false); return; }
    try{
      await t.applyConstraints({advanced:[values]});
      sync();
      message(success||'Camera control updated.');
    }catch(err){
      console.error('Camera control failed',values,err);
      message('Chrome could not apply that camera control. Return it to Auto and try again.',false);
    }
  }
  async function lockWB(){ await apply({whiteBalanceMode:'manual'},'White balance locked to the camera’s current state. Use the Kelvin slider only if you want a manual temperature.'); }
  async function lockExposure(){
    const t=track(); if(!t) return;
    const s=t.getSettings?t.getSettings():{};
    const values={exposureMode:'manual'};
    if(Number(s.exposureTime)>0) values.exposureTime=s.exposureTime;
    if(Number(s.iso)>0) values.iso=s.iso;
    await apply(values,'Exposure locked at the current exposure time and ISO.');
  }
  async function lockFocus(){ await apply({focusMode:'single-shot'},'Focus set to single-shot so Chrome will focus once instead of continuously hunting.'); }
  async function autoAll(){ await apply({whiteBalanceMode:'continuous',exposureMode:'continuous',focusMode:'continuous',exposureCompensation:0},'White balance, exposure, and focus returned to automatic control.'); }

  $('whiteBalanceMode')?.addEventListener('change',async e=>{
    if(e.target.value==='manual'){ await lockWB(); $('colorTemperature').disabled=false; }
    else await apply({whiteBalanceMode:'continuous'},'White balance returned to Auto.');
  });
  $('colorTemperature')?.addEventListener('input',e=>{$('kelvinOut').textContent=Math.round(Number(e.target.value));});
  $('colorTemperature')?.addEventListener('change',async e=>{
    const v=Number(e.target.value);
    await apply({whiteBalanceMode:'manual',colorTemperature:v},`White balance set to ${Math.round(v)} K.`);
  });
  $('exposureMode')?.addEventListener('change',async e=>{
    if(e.target.value==='manual') await lockExposure();
    else await apply({exposureMode:'continuous'},'Exposure returned to Auto.');
  });
  $('exposureCompensation')?.addEventListener('input',e=>{$('exposureOut').textContent=Number(e.target.value).toFixed(1);});
  $('exposureCompensation')?.addEventListener('change',async e=>{
    const v=Number(e.target.value);
    await apply({exposureCompensation:v},`Exposure compensation set to ${v.toFixed(1)} EV.`);
  });
  $('focusMode')?.addEventListener('change',async e=>{ await apply({focusMode:e.target.value},`Focus mode set to ${e.target.options[e.target.selectedIndex].text}.`); });
  $('lockWbBtn')?.addEventListener('click',lockWB);
  $('lockExposureBtn')?.addEventListener('click',lockExposure);
  $('lockFocusBtn')?.addEventListener('click',lockFocus);
  $('cameraAutoBtn')?.addEventListener('click',autoAll);

  setInterval(()=>{
    const t=track();
    if(t!==lastTrack){ lastTrack=t; sync(); }
    else if(t) sync();
  },700);
  sync();
})();
