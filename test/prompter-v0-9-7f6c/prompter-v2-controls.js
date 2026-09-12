(()=>{
  const $=id=>document.getElementById(id);

  // Preserve v2.0 prompt controls.
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

  // v2.1 label + lightweight audio status field.
  const sub=document.querySelector('.sub');
  if(sub) sub.textContent='Local Teleprompter — v2.1';
  const cameraReadout=$('cameraReadout');
  let audioReadout=null;
  if(cameraReadout && cameraReadout.parentElement && cameraReadout.parentElement.parentElement){
    const field=document.createElement('div');
    field.className='field';
    field.innerHTML='<label>Active audio</label><div class="small camera-readout" id="v21AudioReadout">Stereo output target • 48 kHz</div>';
    cameraReadout.parentElement.parentElement.appendChild(field);
    audioReadout=field.querySelector('#v21AudioReadout');
  }

  function setAudioReadout(sourceChannels,sampleRate){
    if(!audioReadout) return;
    const ch=Number(sourceChannels||1);
    const sr=Number(sampleRate||48000);
    audioReadout.textContent=`2 ch output • ${(sr/1000).toFixed(sr%1000?1:0)} kHz • source ${ch} ch`;
  }

  // Camera: request and then enforce the largest exact 16:9 frame Chrome exposes.
  const md=navigator.mediaDevices;
  if(md && md.getUserMedia){
    const nativeGUM=md.getUserMedia.bind(md);
    md.getUserMedia=async constraints=>{
      const c={...(constraints||{})};
      if(c.video && typeof c.video==='object'){
        c.video={...c.video,aspectRatio:{ideal:16/9},resizeMode:{ideal:'crop-and-scale'}};
      }
      if(c.audio!==false){
        c.audio={
          channelCount:{ideal:2},
          sampleRate:{ideal:48000},
          sampleSize:{ideal:16},
          echoCancellation:false,
          noiseSuppression:false,
          autoGainControl:false
        };
      }

      const raw=await nativeGUM(c);
      const vt=raw.getVideoTracks()[0];
      if(vt && vt.applyConstraints){
        const caps=vt.getCapabilities?vt.getCapabilities():{};
        const requestedW=Number(c.video&&c.video.width&&c.video.width.ideal)||3840;
        const requestedH=Number(c.video&&c.video.height&&c.video.height.ideal)||2160;
        const maxW=Math.min(requestedW,Number(caps.width&&caps.width.max)||requestedW);
        const maxH=Math.min(requestedH,Number(caps.height&&caps.height.max)||requestedH);
        let k=Math.floor(Math.min(maxW/16,maxH/9));
        if(k%2) k-=1; // exact 16:9 with even H.264-friendly dimensions
        if(k>0){
          const shape={
            width:{ideal:16*k},
            height:{ideal:9*k},
            aspectRatio:{exact:16/9},
            resizeMode:'crop-and-scale'
          };
          if(c.video&&c.video.frameRate) shape.frameRate=c.video.frameRate;
          try{ await vt.applyConstraints(shape); }
          catch(err){
            console.warn('v2.1 exact 16:9 unavailable; retrying ideal.',err);
            shape.aspectRatio={ideal:16/9};
            try{ await vt.applyConstraints(shape); }catch(err2){ console.warn('v2.1 16:9 optimization unavailable.',err2); }
          }
        }
      }

      // Build a two-channel 48 kHz audio track. If Chrome exposes only mono,
      // duplicate it to dual-mono rather than falsely inventing spatial information.
      const at=raw.getAudioTracks()[0];
      if(!at) return raw;
      const sourceSettings=at.getSettings?at.getSettings():{};
      const sourceChannels=Number(sourceSettings.channelCount||1);
      const sampleRate=Number(sourceSettings.sampleRate||48000);
      setAudioReadout(sourceChannels,sampleRate);
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return raw;
      try{
        const ctx=new AC({sampleRate:48000});
        if(ctx.state==='suspended') await ctx.resume();
        const source=ctx.createMediaStreamSource(new MediaStream([at]));
        const splitter=ctx.createChannelSplitter(2);
        const merger=ctx.createChannelMerger(2);
        const dest=ctx.createMediaStreamDestination();
        source.connect(splitter);
        splitter.connect(merger,0,0);
        if(sourceChannels>=2) splitter.connect(merger,1,1);
        else splitter.connect(merger,0,1);
        merger.connect(dest);
        const stereo=dest.stream.getAudioTracks()[0];
        if(!stereo) return raw;
        const out=new MediaStream([...raw.getVideoTracks(),stereo]);
        const realGetTracks=out.getTracks.bind(out);
        const cleanup={stop:()=>{
          try{at.stop();}catch(e){}
          try{source.disconnect();splitter.disconnect();merger.disconnect();dest.disconnect();}catch(e){}
          try{ctx.close();}catch(e){}
        }};
        // app.js uses getTracks() only to stop the camera; include cleanup there.
        out.getTracks=()=>[...realGetTracks(),cleanup];
        return out;
      }catch(err){
        console.warn('v2.1 stereo output path unavailable; using browser audio track.',err);
        return raw;
      }
    };
  }

  // Recorder: move the video target from ~40 Mbps to ~50 Mbps (native Pixel sample ~48.5)
  // and request standards-based H.264/AAC MP4 before falling back to Chrome's default.
  if(window.MediaRecorder){
    const NativeMR=window.MediaRecorder;
    function V21MediaRecorder(stream,options={}){
      const o={...(options||{})};
      const vs=stream&&stream.getVideoTracks&&stream.getVideoTracks()[0];
      const s=vs&&vs.getSettings?vs.getSettings():{};
      if(Math.max(Number(s.width||0),Number(s.height||0))>=3000) o.videoBitsPerSecond=50000000;
      else o.videoBitsPerSecond=Math.max(Number(o.videoBitsPerSecond||0),16000000);
      o.audioBitsPerSecond=192000;
      const aacTypes=[
        'video/mp4;codecs="avc1.640033,mp4a.40.2"',
        'video/mp4;codecs="avc1.4D4033,mp4a.40.2"',
        'video/mp4;codecs="avc1.640028,mp4a.40.2"'
      ];
      const aac=aacTypes.find(t=>NativeMR.isTypeSupported(t));
      if(aac) o.mimeType=aac;
      return new NativeMR(stream,o);
    }
    V21MediaRecorder.prototype=NativeMR.prototype;
    Object.setPrototypeOf(V21MediaRecorder,NativeMR);
    V21MediaRecorder.isTypeSupported=NativeMR.isTypeSupported.bind(NativeMR);
    window.MediaRecorder=V21MediaRecorder;
  }

  async function reapplyLandscapeShape(){
    const preview=$('preview');
    const stream=preview&&preview.srcObject;
    const vt=stream&&stream.getVideoTracks&&stream.getVideoTracks()[0];
    if(!vt||!vt.applyConstraints) return;
    const caps=vt.getCapabilities?vt.getCapabilities():{};
    const maxW=Math.min(3840,Number(caps.width&&caps.width.max)||3840);
    const maxH=Math.min(2160,Number(caps.height&&caps.height.max)||2160);
    let k=Math.floor(Math.min(maxW/16,maxH/9));
    if(k%2) k-=1;
    if(k<=0) return;
    try{
      await vt.applyConstraints({width:{ideal:16*k},height:{ideal:9*k},aspectRatio:{exact:16/9},resizeMode:'crop-and-scale'});
    }catch(e){}
  }
  let orientTimer=null;
  const schedule=()=>{
    clearTimeout(orientTimer);
    orientTimer=setTimeout(reapplyLandscapeShape,350);
  };
  window.addEventListener('orientationchange',schedule);
  window.addEventListener('resize',schedule);
})();
