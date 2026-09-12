(() => {
  const $ = id => document.getElementById(id);
  const preview = $('preview');
  const promptTrack = $('promptTrack');
  const script = $('script');

  let stream = null;
  let recorder = null;
  let chunks = [];
  let animId = null;
  let scrollY = 0;
  let scrollRunning = false;
  let lastTs = null;
  let recTimer = null;
  let recStart = null;
  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let vuAnimId = null;
  let isStartingRecord = false;
  let opfsRoot = null;
  let opfsHandle = null;
  let opfsWritable = null;
  let opfsName = '';
  let writeQueue = Promise.resolve();
  let storageMode = 'memory';

  function requestedVideoConstraints(){
    const quality = $('cameraQuality').value;
    const fps = $('frameRate').value;
    const video = { facingMode: { ideal: $('facing').value } };
    if(quality === '2160'){ video.width = { ideal: 3840 }; video.height = { ideal: 2160 }; }
    else if(quality === '1080'){ video.width = { ideal: 1920 }; video.height = { ideal: 1080 }; }
    if(fps !== 'auto') video.frameRate = { ideal: Number(fps) };
    return video;
  }

  function updateGrid(){ $('cameraGrid').classList.toggle('hidden', $('gridMode').value !== '3x3'); }

  function updateCameraReadout(){
    if(!stream){ $('cameraReadout').textContent = 'Not started'; return; }
    const track = stream.getVideoTracks()[0];
    if(!track){ $('cameraReadout').textContent = 'No video track'; return; }
    const settings = track.getSettings ? track.getSettings() : {};
    const w = settings.width || '?';
    const h = settings.height || '?';
    const fps = settings.frameRate ? Number(settings.frameRate).toFixed(settings.frameRate % 1 ? 1 : 0) : '?';
    $('cameraReadout').textContent = `${w} × ${h} • ${fps} FPS`;
  }

  async function prepareRecordingStorage(ext){
    writeQueue = Promise.resolve();
    chunks = [];
    opfsRoot = null; opfsHandle = null; opfsWritable = null; opfsName = '';
    storageMode = 'memory';
    if(navigator.storage && navigator.storage.getDirectory && window.isSecureContext){
      try{
        opfsRoot = await navigator.storage.getDirectory();
        opfsName = `ee-prompter-${Date.now()}.${ext}`;
        opfsHandle = await opfsRoot.getFileHandle(opfsName,{create:true});
        opfsWritable = await opfsHandle.createWritable();
        storageMode = 'device-backed';
      }catch(err){ console.warn('Device-backed recording buffer unavailable; using memory.', err); }
    }
  }

  async function finalizeRecordingStorage(type, ext){
    if(storageMode === 'device-backed' && opfsWritable && opfsHandle){
      await writeQueue;
      await opfsWritable.close();
      opfsWritable = null;
      const file = await opfsHandle.getFile();
      const url = URL.createObjectURL(file);
      triggerDownload(url, ext);
      setTimeout(async ()=>{
        URL.revokeObjectURL(url);
        try{ if(opfsRoot && opfsName) await opfsRoot.removeEntry(opfsName); }catch(e){}
      }, 10000);
      return;
    }
    const blob = new Blob(chunks,{type});
    const url = URL.createObjectURL(blob);
    triggerDownload(url, ext);
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
  }

  function triggerDownload(url, ext){
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    a.href = url;
    a.download = `EXAPTER-ENDAPTER-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function cameraErrorMessage(err){
    const protocol = location.protocol || '';
    if(protocol === 'content:' || (!window.isSecureContext && protocol !== 'http:' && protocol !== 'https:')) return 'Camera/microphone access is blocked because Android opened this file directly from device storage. The teleprompter itself is working, but Chrome requires this camera feature to run from HTTPS or localhost.';
    if(!window.isSecureContext) return 'Camera/microphone access requires a secure page. Open the teleprompter over HTTPS or localhost.';
    if(err && err.name === 'NotAllowedError') return 'Camera/microphone permission was denied for this site. Allow Camera and Microphone in Chrome site permissions, then try again.';
    if(err && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) return 'Chrome could not satisfy the requested camera mode. Try Auto or 1080p / 30 FPS.';
    return 'Camera/microphone access failed. Check Chrome site permissions and try again.';
  }

  function updateWordCount(){
    const words = script.value.trim() ? script.value.trim().split(/\s+/).length : 0;
    $('wordCount').textContent = `${words} words`;
  }
  script.addEventListener('input', updateWordCount);

  function loadScript(){
    const txt = script.value.trim();
    promptTrack.textContent = txt || 'Paste your script below, then tap LOAD SCRIPT.';
    resetScroll();
  }

  function resetScroll(){
    scrollRunning = false;
    cancelAnimationFrame(animId);
    animId = null;
    lastTs = null;
    scrollY = 0;
    promptTrack.style.transform = 'translateY(0px)';
    $('startScrollBtn').textContent = 'Start Scroll';
    $('startScrollBtn').disabled = !stream;
  }

  function tick(ts){
    if (!scrollRunning) return;
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    const speed = Number($('speed').value);
    scrollY += speed * dt;
    promptTrack.style.transform = `translateY(${-scrollY}px)`;
    animId = requestAnimationFrame(tick);
  }
  function startScroll(){ if(scrollRunning) return; scrollRunning = true; lastTs = null; $('startScrollBtn').textContent = 'Stop Scroll'; animId = requestAnimationFrame(tick); }
  function stopScroll(){ scrollRunning = false; cancelAnimationFrame(animId); lastTs = null; $('startScrollBtn').textContent = 'Start Scroll'; }
  function toggleScroll(){ if(scrollRunning) stopScroll(); else startScroll(); }
  function setMirror(){ preview.classList.toggle('mirror', $('mirror').checked && $('facing').value === 'user'); }

  function stopAnalyzer(){
    cancelAnimationFrame(vuAnimId);
    vuAnimId = null;
    try{ if(audioSource) audioSource.disconnect(); }catch(e){}
    audioSource = null;
    analyser = null;
    if(audioCtx){ try{ audioCtx.close(); }catch(e){} audioCtx = null; }
    $('peakDb').textContent = '— dBFS';
    const canvas = $('vuCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#030504';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function setupAnalyzer(){
    stopAnalyzer();
    if(!stream) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    audioCtx = new AC();
    audioSource = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    audioSource.connect(analyser);
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    const canvas = $('vuCanvas');
    const ctx = canvas.getContext('2d');
    function drawVU(){
      if(!analyser) return;
      const cssW = Math.max(320, canvas.clientWidth || 900);
      const cssH = Math.max(44, canvas.clientHeight || 58);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
      if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(time);
      ctx.fillStyle = '#030504'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = 'rgba(141,209,141,.045)';
      const grid = Math.max(4, Math.round(4*dpr));
      for(let x=0;x<w;x+=grid*4) ctx.fillRect(x,0,1,h);
      for(let y=0;y<h;y+=grid*3) ctx.fillRect(0,y,w,1);
      const bands = 32, gap = Math.max(2, Math.floor(2*dpr)), barW = Math.max(3, Math.floor((w-gap*(bands-1))/bands)), segH = Math.max(2, Math.floor(3*dpr)), segGap = Math.max(1, Math.floor(1*dpr)), maxSegments = Math.max(6, Math.floor((h-4*dpr)/(segH+segGap)));
      for(let b=0;b<bands;b++){
        const start = Math.floor(Math.pow(b/bands,1.55)*(freq.length-1));
        const end = Math.max(start+1,Math.floor(Math.pow((b+1)/bands,1.55)*(freq.length-1)));
        let sum=0,n=0; for(let i=start;i<=end&&i<freq.length;i++){sum+=freq[i];n++;}
        const lit = Math.round((n?sum/n/255:0)*maxSegments), x=b*(barW+gap);
        for(let s=0;s<maxSegments;s++){
          const y=h-(s+1)*(segH+segGap), ratio=s/maxSegments;
          let color=ratio>.78?'#d56642':ratio>.55?'#d5bc55':'#8dd18d';
          if(s<lit){ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=Math.max(1,2*dpr);}else{ctx.fillStyle='#111713';ctx.shadowBlur=0;}
          ctx.fillRect(x,y,barW,segH);
        }
      }
      ctx.shadowBlur=0;
      let sumSq=0; for(let i=0;i<time.length;i++){const v=(time[i]-128)/128;sumSq+=v*v;}
      const rms=Math.sqrt(sumSq/time.length), db=rms>0.00001?20*Math.log10(rms):-96;
      $('peakDb').textContent=`${Math.max(-96,db).toFixed(1)} dBFS`;
      vuAnimId=requestAnimationFrame(drawVU);
    }
    drawVU();
  }

  function stopCamera(){
    stopAnalyzer();
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
    preview.srcObject=null;
    $('cameraStatus').textContent='Camera off';
    $('cameraBtn').textContent='Start Camera';
    $('recordBtn').disabled=true;
    $('startScrollBtn').disabled=true;
    $('cameraReadout').textContent='Not started';
    stopScroll();
  }

  async function startCamera(){
    const facingMode=$('facing').value;
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error('getUserMedia unavailable');
      stream=await navigator.mediaDevices.getUserMedia({video:requestedVideoConstraints(),audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      preview.srcObject=stream;
      setMirror(); updateGrid(); updateCameraReadout(); setupAnalyzer();
      $('cameraStatus').textContent=facingMode==='user'?'Front camera ready':'Rear camera ready';
      $('cameraBtn').textContent='Stop Camera';
      $('recordBtn').disabled=false;
      $('startScrollBtn').disabled=false;
    }catch(err){ console.error(err); alert(cameraErrorMessage(err)); $('cameraStatus').textContent='Camera unavailable'; }
  }
  async function toggleCamera(){ if(stream) stopCamera(); else await startCamera(); }

  function recordingBitrates(){
    if(!stream) return {videoBitsPerSecond:12000000,audioBitsPerSecond:192000};
    const track=stream.getVideoTracks()[0], settings=track&&track.getSettings?track.getSettings():{};
    const w=Number(settings.width||0), h=Number(settings.height||0), pixels=w*h;
    const is4KClass=pixels>=7000000||Math.max(w,h)>=3000;
    return {videoBitsPerSecond:is4KClass?40000000:12000000,audioBitsPerSecond:192000};
  }
  function bestMimeType(){
    const types=['video/mp4;codecs=h264,aac','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    return types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
  }
  function fmtTime(ms){ const s=Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  function startRecTimer(){ recStart=Date.now(); $('recStatus').classList.remove('hidden'); $('recTime').textContent='00:00'; recTimer=setInterval(()=>{$('recTime').textContent=fmtTime(Date.now()-recStart);},250); }
  function stopRecTimer(){ clearInterval(recTimer); recTimer=null; $('recStatus').classList.add('hidden'); }
  async function countdown(seconds){ if(!seconds)return; const el=$('countdown'); el.style.display='grid'; for(let n=seconds;n>0;n--){el.textContent=n;await new Promise(r=>setTimeout(r,1000));} el.style.display='none'; }

  async function startRecording(){
    if(!stream)return;
    const secs=Number($('countdownSeconds').value);
    if(isStartingRecord)return;
    isStartingRecord=true;
    $('recordBtn').disabled=true;
    $('recordBtn').textContent='Starting…';
    await countdown(secs);
    chunks=[];
    const mimeType=bestMimeType(), bitrates=recordingBitrates();
    try{
      recorder=mimeType?new MediaRecorder(stream,{mimeType,videoBitsPerSecond:bitrates.videoBitsPerSecond,audioBitsPerSecond:bitrates.audioBitsPerSecond}):new MediaRecorder(stream,{videoBitsPerSecond:bitrates.videoBitsPerSecond,audioBitsPerSecond:bitrates.audioBitsPerSecond});
    }catch{ recorder=new MediaRecorder(stream); }
    const actualType=recorder.mimeType||mimeType||'video/webm', ext=actualType.includes('mp4')?'mp4':'webm';
    await prepareRecordingStorage(ext);
    recorder.onerror=e=>{console.error('MediaRecorder error',e.error||e);$('formatLabel').textContent='Recording error';alert('The browser reported a recording error. The camera is still available; stop and try again.');};
    recorder.ondataavailable=e=>{
      if(!e.data||!e.data.size)return;
      if(storageMode==='device-backed'&&opfsWritable){writeQueue=writeQueue.then(()=>opfsWritable.write(e.data)).catch(err=>{console.error('Recording buffer write failed',err);chunks.push(e.data);storageMode='memory';});}
      else chunks.push(e.data);
    };
    recorder.onstop=async()=>{
      const type=recorder.mimeType||actualType||'video/webm';
      try{await finalizeRecordingStorage(type,ext);$('formatLabel').textContent=`Saved ${ext.toUpperCase()} locally`;}
      catch(err){console.error('Save failed',err);$('formatLabel').textContent='Save failed';alert('Recording stopped, but Chrome could not finish the local save.');}
      finally{$('recordBtn').disabled=false;$('recordBtn').textContent='Record';$('recordBtn').classList.remove('recording');isStartingRecord=false;stopRecTimer();}
    };
    recorder.start(1000);
    $('formatLabel').textContent=`Recording ${recorder.mimeType||mimeType||'video'}`;
    $('recordBtn').disabled=false;
    $('recordBtn').textContent='Stop Record';
    $('recordBtn').classList.add('recording');
    isStartingRecord=false;
    startRecTimer();
    if($('autoScrollOnRecord').checked){resetScroll();startScroll();}
  }

  function stopRecording(){ if(recorder&&recorder.state!=='inactive')recorder.stop(); if(scrollRunning)stopScroll(); }
  function toggleRecording(){ if(isStartingRecord)return; if(recorder&&recorder.state!=='inactive')stopRecording(); else startRecording(); }

  $('cameraBtn').addEventListener('click',toggleCamera);
  $('recordBtn').addEventListener('click',toggleRecording);
  $('startScrollBtn').addEventListener('click',toggleScroll);
  $('resetBtn').addEventListener('click',()=>{if(recorder&&recorder.state!=='inactive')stopRecording();resetScroll();});
  $('loadBtn').addEventListener('click',loadScript);
  $('clearBtn').addEventListener('click',()=>{script.value='';updateWordCount();loadScript();});
  $('speed').addEventListener('input',e=>$('speedOut').textContent=e.target.value);
  $('textSize').addEventListener('input',e=>{$('sizeOut').textContent=e.target.value;document.documentElement.style.setProperty('--prompt-size',`${e.target.value}px`);});
  $('promptWidth').addEventListener('input',e=>{$('widthOut').textContent=e.target.value;document.documentElement.style.setProperty('--prompt-width',`${e.target.value}%`);});
  $('promptPos').addEventListener('input',e=>{$('posOut').textContent=e.target.value;document.documentElement.style.setProperty('--prompt-bottom',`${e.target.value}%`);});
  $('mirror').addEventListener('change',setMirror);
  $('facing').addEventListener('change',async()=>{setMirror();if(stream){stopCamera();await startCamera();}});
  for(const id of ['cameraQuality','frameRate']) $(id).addEventListener('change',async()=>{if(stream){stopCamera();await startCamera();}});
  $('gridMode').addEventListener('change',updateGrid);
  window.addEventListener('beforeunload',()=>{stopAnalyzer();if(stream)stream.getTracks().forEach(t=>t.stop());});
  updateGrid();
  updateWordCount();
})();