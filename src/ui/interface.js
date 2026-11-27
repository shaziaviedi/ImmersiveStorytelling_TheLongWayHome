// DOM captions and menus also supply the text and progress mirrored by the VR rig.
import {INTRO_TIMING,playerText} from './presentation.mjs';
const $ = (selector) => document.querySelector(selector);

export function createUI(settings, isXR) {
  const timers = {};
  let finaleTasks=[];
  let prologueTasks=[],cancelExit=null;
  const later=(fn,ms)=>{const id=setTimeout(fn,ms);prologueTasks.push(id);return id;};
  // Hints bypass the typing effect so an instruction is readable as soon as it appears.
  const TYPING_SPEED = { thought: 30, subtitle: 38 }; // characters per second
  const typing = {};
  function typeCaption(element, id, text) {
    clearInterval(typing[id]);
    // Spoken captions use the scene-authored 'Speaker: line' convention; thoughts have no speaker tag.
    const speaker = id === 'subtitle' && /^([A-Z][A-Za-z ]{1,18}): (.*)$/.exec(text);
    element.innerHTML = '';
    if (id === 'subtitle') {
      const label = document.createElement('span');
      label.className = 'who';
      label.textContent = speaker ? speaker[1] : 'Around you';
      element.appendChild(label);
    }
    if (speaker) text = speaker[2];
    const body = document.createElement('span');
    body.className = 'say';
    element.appendChild(body);
    const characters = [...text];
    let nextCharacter = 0;
    const tick = () => {
      if (nextCharacter >= characters.length) {
        clearInterval(typing[id]);
        return;
      }
      const letter = document.createElement('i');
      letter.textContent = characters[nextCharacter++];
      body.appendChild(letter);
    };
    tick();
    typing[id] = setInterval(tick, 1000 / TYPING_SPEED[id]);
    element.dataset.full = (speaker ? speaker[1] + ': ' : '') + text;
    return characters.length / TYPING_SPEED[id];
  }
  // In a headset the same hints are worded for the controllers (the desktop text is never changed)
  const VR_HINTS = {
    'Look around with the mouse · click the glowing fabric on your left':
      'Reach to the fabric on your left · hold a grip to pick it up',
    'Hold the mouse button on the machine to push the fabric through':
      'Carry the fabric to the needle · keep gripping and slowly push it forward',
    'W A S D to walk · hold Shift to run · find your bag (look for the glow)':
      'Left stick to walk (all the way to run) · right stick to turn · find your bag (look for the glow)',
    'Hold Q to look inside your bag · then go home':
      'Squeeze a grip to look inside your bag · then go home',
    'Click the fabric on your left': 'Reach to the fabric · hold a grip, carry it to the needle, then push forward',
    'Hold the mouse button on the machine': 'Keep gripping · push the fabric forward through the needle',
    'Click the supervisor at his desk': 'Point at the supervisor · pull the trigger',
    'Click the door to go outside': 'Point at the door · pull the trigger',
    'Hold E to hold out your hands': 'Sit comfortably and extend both hands · hold both triggers for the accessible alternative',
    'Hold the bag to your chest to hide the light and stay still':
      'Squeeze a grip to hug the bag and hide the light and stay still',
  };
  const controllerHint = (t) =>
    VR_HINTS[t] ||
    String(t)
      .replace(/Hold the mouse button/g, 'Hold the trigger')
      .replace(/\bClick\b/g, 'Pull the trigger')
      .replace(/\bclick\b/g, 'pull the trigger')
      .replace(/\b(Hold|Press) [QR]\b/g, 'Squeeze a grip')
      .replace(/\b(Hold|Press) E\b/g, 'Hold the trigger')
      .replace(/\b[Hh]old C\b/g, 'squeeze both grips')
      .replace(/W A S D/g, 'Left stick')
      .replace(/[Hh]old Shift/g, 'push the stick all the way')
      .replace(/ with the mouse/g, '');
  const ui = {
    state: { progress: 0, stamina: null,prologueId:0,introExit:null,prologueStart:null }, // shared with XR
    show(id, on) {
      if(id==='endcard'&&!on){finaleTasks.forEach(clearTimeout);finaleTasks=[];}
      $('#' + id).classList.toggle('show', on);
    },
    text(id, text, secs) {
      text=playerText(text);
      const el = $('#' + id);
      clearTimeout(timers[id]);
      if (!text) {
        clearInterval(typing[id]);
        el.classList.remove('on');
        return;
      }
      let typeT = 0;
      if (TYPING_SPEED[id]) typeT = typeCaption(el, id, text);
      else el.textContent = text;
      el.classList.add('on');
      if (secs)
        timers[id] = setTimeout(() => el.classList.remove('on'), (secs + typeT * 0.85) * 1000); // stays up long enough to read once typed
    },
    // a small ring that ripples out from the crosshair when you use something (click feedback)
    pulse() {
      const c = $('#crosshair');
      if (!c) return;
      c.classList.remove('tap');
      void c.offsetWidth;
      c.classList.add('tap');
    },
    hint(t, s) {
      const text=playerText(t&&isXR()?controllerHint(t):t);
      if(text&&$('#hint').classList.contains('on')&&$('#hint').textContent===text)return;
      if (settings.hints || !t) ui.text('hint', text, s);
      ui.state.hintAction=/left stick|W A S D|hold Shift|push the stick/i.test(text)?'walk':null;
    },
    observeAction(action){if(ui.state.hintAction===action)ui.hint('');},
    clearGuidance(){ui.hint('');ui.label('');},
    thought(t, s) {
      ui.text('thought', t, s);
    },
    subtitle(t, s) {
      ui.text('subtitle', t, s);
    },
    fade(on, white = false) {
      const f = $('#fade');
      f.classList.toggle('white', white);
      f.classList.toggle('on', on);
    },
    progress(k) {
      ui.state.progress = k;
      const el = $('#ring');
      el.style.setProperty('--progress', k);
      el.setAttribute('aria-valuenow', Math.round(k * 100));
      el.classList.toggle('on', k > 0.001 && k < 1);
    },
    label(t) {
      const hot=!!t;
      t=$('#hint').classList.contains('on')?'':playerText(t);
      const el = $('#label');
      el.textContent = t || '';
      el.classList.toggle('on', !!t);
      $('#crosshair').classList.toggle('hot', hot);
    },
    stamina(v) {
      ui.state.stamina = v;
      const el = $('#stamina');
      el.classList.toggle('on', v !== null && v < 0.98);
      if (v !== null) el.style.setProperty('--progress', v);
    },
    finale(extra) {
      finaleTasks.forEach(clearTimeout);finaleTasks=[];
      // the Extra edition first says what tomorrow holds
      ['stat-0a', 'stat-0b'].forEach((id) => {
        $('#' + id).hidden = !extra;
      });
      const ids = [
        ...(extra ? ['stat-0a', 'stat-0b'] : []),
        'stat-1',
        'stat-2',
        'stat-3',
        'stat-src',
        'stat-fin',
      ];
      ids.forEach((id) => $('#' + id).classList.remove('on'));
      ids.forEach((id, i) => finaleTasks.push(setTimeout(() => $('#' + id).classList.add('on'), 900 + i * 2600)));
    },
    /** Opening context. Returns ms until the continue cue, preserving the reading window. */
    prologue() {
      ui.clearPrologue();
      ui.state.prologueStart=performance.now();
      const story = ['pro-1', 'pro-2', 'pro-3', 'pro-4'];
      const all = [...story, 'pro-click'];
      all.forEach((id) => {
        const el = $('#' + id);
        if (el) el.classList.remove('on');
      });
      const start = 800;
      const step = 2400;
      story.forEach((id, i) =>
        later(() => {
          const el = $('#' + id);
          if (el) el.classList.add('on');
        }, start + i * step),
      );
      return start + (story.length+1) * step;
    },
    dismissPrologue(){
      if(ui.state.introExit)return Promise.resolve(false);
      const start=performance.now(),intro=$('#intro'),title=$('#pro-title');
      const box=title.getBoundingClientRect(),font=parseFloat(getComputedStyle(title).fontSize);
      const bodyEnd=start+INTRO_TIMING.bodyFade,moveEnd=bodyEnd+INTRO_TIMING.titleMove;
      ui.state.introExit={start,bodyEnd,moveEnd,titleFade:moveEnd+INTRO_TIMING.titleHold,x:box.left+box.width/2,y:box.top+box.height/2,font};
      for(const id of ['pro-1','pro-2','pro-3','pro-4','pro-click'])$('#'+id).style.transition='none';
      // Reserve the inline footprint so lifting the actual phrase never reflows its sentence.
      const slot=document.createElement('span');slot.className='intro-title-slot';slot.style.display='inline-block';slot.style.width=box.width+'px';slot.style.height=box.height+'px';slot.style.verticalAlign='bottom';title.before(slot);
      title.classList.add('intro-hero');
      intro.classList.remove('ready');intro.classList.add('departing');
      ui.presentationFrame();
      return new Promise(resolve=>{
        cancelExit=()=>resolve(false);
        later(()=>title.classList.remove('on'),INTRO_TIMING.bodyFade+INTRO_TIMING.titleMove+INTRO_TIMING.titleHold);
        later(()=>{ui.presentationFrame();cancelExit=null;resolve(true);},INTRO_TIMING.bodyFade+INTRO_TIMING.titleMove+INTRO_TIMING.titleHold+INTRO_TIMING.titleFade);
      });
    },
    presentationFrame(){
      const exit=ui.state.introExit;
      if(!exit){
        if(ui.state.prologueStart!==null){
          const elapsed=performance.now()-ui.state.prologueStart;
          ['pro-1','pro-2','pro-3','pro-4','pro-click'].forEach((id,i)=>{const el=$('#'+id),at=i===4?12800:800+i*2400;el.style.transition='none';el.style.opacity=Math.max(0,Math.min(1,(elapsed-at)/1600));});
        }
        return;
      }
      const now=performance.now(),clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>v*v*(3-2*v);
      const body=1-smooth(clamp((now-exit.start)/INTRO_TIMING.bodyFade));
      for(const id of ['pro-1','pro-2','pro-4','pro-click'])$('#'+id).style.opacity=body;
      document.querySelectorAll('#pro-3 .intro-copy').forEach(el=>el.style.opacity=body);
      const title=$('#pro-title'),move=smooth(clamp((now-exit.bodyEnd)/INTRO_TIMING.titleMove));
      title.textContent=move>0?'The Long Way Home':'the long way home';
      title.style.opacity=1-smooth(clamp((now-exit.titleFade)/INTRO_TIMING.titleFade));
      title.style.left=(exit.x+(innerWidth/2-exit.x)*move)+'px';
      title.style.top=(exit.y+(innerHeight/2-exit.y)*move)+'px';
      const hero=Math.min(60,innerWidth*.078),size=exit.font+(hero-exit.font)*move;
      title.style.fontSize=size+'px';

    },
    clearPrologue() {
      prologueTasks.forEach(clearTimeout);prologueTasks=[];
      if(cancelExit){cancelExit();cancelExit=null;}
      ui.state.prologueId++;ui.state.introExit=null;ui.state.prologueStart=null;
      ['pro-title','pro-1', 'pro-2', 'pro-3', 'pro-4', 'pro-click'].forEach((id) => {
        const el = $('#' + id);
        if (el) {el.classList.remove('on');el.style.opacity='';el.style.transform='';el.style.transition='';}
      });
      $('#pro-title').classList.remove('intro-hero');$('#pro-title').textContent='the long way home';$('#pro-title').removeAttribute('style');
      document.querySelectorAll('.intro-title-slot').forEach(el=>el.remove());
      document.querySelectorAll('#pro-3 .intro-copy').forEach(el=>el.style.opacity='');
      const intro = $('#intro');
      if (intro) intro.classList.remove('ready','departing','title-only');
    },
    error(m) {
      $('#error').textContent = playerText(m);
    },
  };

  return ui;
}
