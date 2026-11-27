// VR (WebXR): the same scene in a headset. Controllers become the child's floating hands,
// the trigger interacts; sewing uses proximity grips and actual cloth movement,
// left stick walks, right stick turns in 30° steps, and words appear on a board in front of you.
// The page's own overlays (the black and white fades, the eyelids) are drawn inside the headset by a
// "veil" around your eyes, so every blink and fade the desktop shows is seen in VR too.
import * as THREE from 'three';
import {layoutCard,INTRO_TIMING,playerText} from '../ui/presentation.mjs';

// the veil: a small sphere around the eyes. It mirrors the page's fade (black or the warm white), the
// eyelids (closing from the top and bottom), and darkens the edge of sight a little while the stick moves you.
const VEIL_VS = `varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const VEIL_FS = `uniform float uFade; uniform vec3 uFadeCol; uniform float uLid; uniform float uTunnel; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // eyelids (1 = shut): the gap narrows toward the middle of the view, a little curved like the page's lids
  float open = 1.0 - uLid;
  float edge = open * 0.92 - 0.08 + 0.22 * d.x * d.x * open;
  float lid = uLid > 0.001 ? smoothstep(edge - 0.12, edge + 0.02, abs(d.y)) : 0.0;
  // comfort vignette while the stick carries you: only the outer part of sight
  float ang = acos(clamp(-d.z, -1.0, 1.0));
  float tun = uTunnel * smoothstep(0.42, 0.95, ang);
  float a = max(lid, tun);
  float outA = uFade + (1.0 - uFade) * a;
  vec3 col = outA > 0.0001 ? uFadeCol * uFade / outA : vec3(0.0);
  gl_FragColor = vec4(col, outA);
  #include <colorspace_fragment>
}`;
const smooth = (k) => k * k * (3 - 2 * k);
const FADE_S = 1.2; // the page's fade takes 1.2 s (style.css #fade)

export class XRRig {
  constructor({ renderer, camera, player, interactor, hands, bagCtl, ui }) {
    Object.assign(this, { renderer, camera, player, interactor, hands, bagCtl, ui });
    this.active = false;
    this.session = null;
    this.blurred = false;
    this.frames = 0;
    this.ctrl = [0, 1].map((i) => renderer.xr.getController(i));
    this.grip = [0, 1].map((i) => renderer.xr.getControllerGrip(i));
    this.hand = [null, null]; // which controller is left / right (from handedness)
    this.state = [0, 1].map(() => ({
      trigger: 0,
      squeeze: 0,
      stick: [0, 0],
      turned: false,
      stickBtn: false,
    }));
    // a thin pointer ray on each controller (only drawn when it points at something usable)
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    this.rays = this.ctrl.map((c) => {
      const l = new THREE.Line(
        rayGeo,
        new THREE.LineBasicMaterial({ color: 0xf6e2b8, transparent: true, opacity: 0.55 }),
      );
      l.visible = false;
      c.add(l);
      return l;
    });
    this.ctrl.forEach((c, i) => {
      c.addEventListener('connected', (e) => {
        c.userData.handed = e.data.handedness;
        c.userData.gp = e.data.gamepad;
        this._map();
      });
      c.addEventListener('disconnected', () => {
        c.userData.handed = null;
        c.userData.gp = null;
        this._map();
      });
      c.addEventListener('selectstart', () => {
        if (this.endReady) {
          // Prologue: continue into the story. Finale: leave VR back to the page.
          if (this.endKind === 'prologue' && this.onPrologueContinue) {
            const next = this.onPrologueContinue;
            this.onPrologueContinue = null;
            this.endReady=false;this.prologueLeaving=true;
            next();
            return;
          }
          this.exit();
          return;
        }
        if (this.blurred||this.endMode) return;
        this.pressFrom = i;
        this.interactor.pressXR(c);
        if (this.interactor.pressed) this.buzz(i); // the controller answers every use with a small tap
      });
      c.addEventListener('selectend', () => {
        this.interactor.releaseXR();
      });
      player.dolly.add(c, this.grip[i]);
    });
    // caption board: thoughts, subtitles and hints floating in front of you
    this.capCanvas = document.createElement('canvas');
    this.capCanvas.width = 1024;
    this.capCanvas.height = 512;
    this.capTex = new THREE.CanvasTexture(this.capCanvas);
    this.capTex.colorSpace = THREE.SRGBColorSpace;
    this.board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.6),
      new THREE.MeshBasicMaterial({
        map: this.capTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.board.position.set(0, -0.35, -1.65);
    this.board.rotation.x = 0;
    this.board.renderOrder = 99;
    this.board.visible = false;
    this.board.frustumCulled = false;
    camera.add(this.board);
    this.instructionCanvas=document.createElement('canvas');
    this.instructionCanvas.width=1024;this.instructionCanvas.height=256;
    this.instructionTex=new THREE.CanvasTexture(this.instructionCanvas);this.instructionTex.colorSpace=THREE.SRGBColorSpace;
    this.instructionBoard=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),new THREE.MeshBasicMaterial({map:this.instructionTex,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));
    this.instructionBoard.position.set(0,.38,-1.65);this.instructionBoard.renderOrder=99;
    this.instructionBoard.frustumCulled=false;this.instructionBoard.visible=false;camera.add(this.instructionBoard);
    this.lastCap = '';
    const curve = document.querySelector('#title .thread path');
    this.progressPath = new Path2D(curve.getAttribute('d'));
    this.progressLength = curve.getTotalLength();
    // the veil (fades, eyelids, comfort vignette)
    this.veilMat = new THREE.ShaderMaterial({
      vertexShader: VEIL_VS,
      fragmentShader: VEIL_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      uniforms: {
        uFade: { value: 0 },
        uFadeCol: { value: new THREE.Color(0x000000) },
        uLid: { value: 0 },
        uTunnel: { value: 0 },
      },
    });
    this.veil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), this.veilMat);
    this.veil.renderOrder = 100;
    this.veil.frustumCulled = false;
    this.veil.visible = false;
    camera.add(this.veil);
    this.fadeLin = 0;
    this.tunnel = 0;
    this.fadeEl = document.getElementById('fade');
    this.lidEl = document.getElementById('eyelids');
    this.white = new THREE.Color(0xf3e6cc);
    this.black = new THREE.Color(0x000000);
    // the end card, shown in the dark in front of you before you take the headset off
    this.endCanvas = document.createElement('canvas');
    this.endCanvas.width = 1024;
    this.endCanvas.height = 1024;
    this.endTex = new THREE.CanvasTexture(this.endCanvas);
    this.endTex.colorSpace = THREE.SRGBColorSpace;
    this.endBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 1.45),
      new THREE.MeshBasicMaterial({
        map: this.endTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.endBoard.renderOrder = 101;
    this.endBoard.visible = false;
    this.endBoard.frustumCulled = false;
    camera.add(this.endBoard);
    this.endMode = false;
    this.endReady = false;
    this.endKind = null; // 'finale' | 'prologue'
    this.endIds = null;
    this.onPrologueContinue = null;
    this.endT = 0;
    this.endAlpha = {};
  }
  _map() {
    this.hand = [null, null];
    this.ctrl.forEach((c, i) => {
      if (c.userData.handed === 'left') this.hand[0] = i;
      if (c.userData.handed === 'right') this.hand[1] = i;
    });
    if (this.hand[1] === null) this.hand[1] = this.hand[0] === 0 ? 1 : 0;
    if (this.hand[0] === null) this.hand[0] = this.hand[1] === 0 ? 1 : 0;
    if (this.active) this._attach();
  }
  _attach() {
    this.hands.xr = {
      grips: [this.grip[this.hand[0]], this.grip[this.hand[1]]],
      squeeze: [0, 0],
      trigger: [0, 0],
    };
    this.bagCtl.setHolder(this.grip[this.hand[1]], true);
  }
  static async supported() {
    try {
      return !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')));
    } catch (e) {
      return false;
    }
  }
  // must be called straight from the click (the browser only opens the headset from a user gesture)
  async enter(onStart, onEnd) {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor'],
    });
    this.renderer.xr.setFramebufferScaleFactor(1.0);
    // most headsets give a floor-level space; if one doesn't, fall back to 'local' (the height is set from your eyes anyway)
    this.refSpace = 'local-floor';
    try {
      await session.requestReferenceSpace('local-floor');
    } catch (e) {
      this.refSpace = 'local';
    }
    this.renderer.xr.setReferenceSpaceType(this.refSpace);
    await this.renderer.xr.setSession(session);
    this.session = session;
    this.active = true;
    this.calib = 1;
    this.frames = 0;
    this.blurred = false;
    this._lastEye = undefined;
    this.standingHeadY=undefined;
    this.bodyHeight=1.65;
    this.player.xrPostureLock=false;
    this.player.xrRecalibrate=false;
    this.player.xrPoseOK = false;
    this.player.xrPending = null;
    this.endMode = false;
    this.endReady = false;
    this.endKind = null;
    this.endIds = null;
    this.onPrologueContinue = null;
    this.endBoard.visible = false;
    this.fadeLin = 1;
    this.tunnel = 0; // open on black; the story fades in
    this._map();
    this._attach();
    this.interactor.xrMode = true;
    this.board.visible = true;
    this.veil.visible = true;
    this.lastCap = '';
    session.addEventListener('visibilitychange', () => {
      // the headset's system menu: hold the story and the sound until you come back
      const vis = session.visibilityState === 'visible';
      this.blurred = !vis;
      const ac = THREE.AudioContext.getContext();
      if (!vis) {
        this.interactor.releaseXR();
        try {
          ac.suspend();
        } catch (e) {
          /* ignore */
        }
      } else {
        try {
          ac.resume();
        } catch (e) {
          /* ignore */
        }
      }
    });
    session.addEventListener('end', () => {
      this.active = false;
      this.session = null;
      this.hands.xr = null;
      this.interactor.xrMode = false;
      this.interactor.release();
      this.board.visible = false;
      this.instructionBoard.visible=false;
      this.veil.visible = false;
      this.endBoard.visible = false;
      this.endMode = false;
      this.endReady = false;
      this.endKind = null;
      this.endIds = null;
      this.onPrologueContinue = null;
      this.rays.forEach((r) => {
        r.visible = false;
      });
      this.blurred = false;
      try {
        THREE.AudioContext.getContext().resume();
      } catch (e) {
        /* ignore */
      }
      this.bagCtl.setHolder(this.camera, false);
      this.player.dolly.position.y = 0;
      this.player.dolly.rotation.y = 0; // the desktop view turns the camera, not the play space
      this.player.xrPending = null;
      this.player.xrPoseOK = false;
      this.player.xrPostureLock=false;
      onEnd && onEnd();
    });
    onStart && onStart();
  }
  buzz(i, strength = 0.35, ms = 35) {
    const gp = this.ctrl[i] && this.ctrl[i].userData.gp,
      h = gp && gp.hapticActuators && gp.hapticActuators[0];
    try {
      if (h && h.pulse) h.pulse(strength, ms);
    } catch (e) {
      /* no haptics */
    }
  }
  exit() {
    if (this.session) {
      this.endReady = false;
      this.session.end().catch(() => {
        /* already ended */
      });
    }
  }
  recalibrate() {
    if (this.player.xrPostureLock) return;
    this.calib = 1;
  }
  interactionPose() {
    const p=this.player,frame=this.renderer.xr.getFrame(),space=this.renderer.xr.getReferenceSpace();
    const headTracked=!!(frame&&space&&frame.getViewerPose(space));
    const valid=this.active&&!this.blurred&&!this.endMode&&p.xrPoseOK&&headTracked;
    p.dolly.updateWorldMatrix(true,true);
    const head=this.camera.getWorldPosition(new THREE.Vector3()),forward=this.camera.getWorldDirection(new THREE.Vector3());
    forward.y=0;if(forward.lengthSq()<1e-4)forward.set(-Math.sin(p.yaw),0,-Math.cos(p.yaw));forward.normalize();
    return {valid,head,headLocal:this.camera.position.clone(),standingHeadY:this.standingHeadY,
      bodyHeight:this.bodyHeight||1.65,forward,right:new THREE.Vector3(-forward.z,0,forward.x),
      hands:this.hand.map(i=>{const g=this.grip[i],c=this.ctrl[i],s=this.state[i];return {
        tracked:valid&&!!c.userData.gp&&g.visible&&c.visible,
        position:new THREE.Vector3(0,-.01,.06).applyMatrix4(g.matrixWorld),
        local:g.position.clone(),quaternion:g.getWorldQuaternion(new THREE.Quaternion()),
        squeeze:s.squeeze,trigger:s.trigger};})};
  }
  /** Place the dark reading board ~1.7 m in front of the headset. */
  _placeEndBoard() {
    this.endBoard.position.set(0,0,-1.9);this.endBoard.rotation.set(0,0,0);
    this.endBoard.visible=true;this.board.visible=false;this.instructionBoard.visible=false;
  }
  finishPrologue(){
    this.endMode=false;this.endReady=false;this.endKind=null;this.prologueLeaving=false;
    this.endBoard.visible=false;this.board.visible=true;this.instructionBoard.visible=true;this.lastCap='';
  }

  // the end card: read the page's end card line by line and show it in the dark
  showEnd() {
    if (!this.active) return;
    this.endMode = true;
    this.endReady = false;
    this.endKind = 'finale';
    this.endIds = ['stat-0a', 'stat-0b', 'stat-1', 'stat-2', 'stat-3', 'stat-src', 'stat-fin'];
    this.onPrologueContinue = null;
    this.endT = 0;
    this.finT = 0;
    this.endAlpha = {};
    this._endKey = '';
    this._placeEndBoard();
  }
  // opening prologue: same board, story lines from #intro; trigger continues into play
  showPrologue(onContinue) {
    if (!this.active) return;
    this.endMode = true;
    this.endReady = false;
    this.endKind = 'prologue';
    this.endIds = ['pro-1', 'pro-2', 'pro-3', 'pro-4', 'pro-click'];
    this.prologueLeaving=false;
    this.onPrologueContinue = onContinue || null;
    this.endT = 0;
    this.finT = 0;
    this.endAlpha = {};
    this._endKey = '';
    this._placeEndBoard();
  }
  update(dt) {
    if (!this.active) return;
    const pl = this.player;
    this.frames++;
    // read the controllers (xr-standard mapping: 0 trigger, 1 grip, 3 thumbstick press; sticks on axes 2/3, or 0/1 on touchpad controllers)
    this.ctrl.forEach((c, i) => {
      const gp = c.userData.gp,
        st = this.state[i];
      if (!gp) {
        st.trigger = 0;
        st.squeeze = 0;
        st.stick = [0, 0];
        return;
      }
      const b = gp.buttons || [],
        ax = gp.axes || [];
      st.trigger = b[0] ? b[0].value : 0;
      st.squeeze = b[1] ? b[1].value : 0;
      st.stick = ax.length >= 4 ? [ax[2] || 0, ax[3] || 0] : [ax[0] || 0, ax[1] || 0];
      // press a thumbstick: set your height again (if you sat down or stood up)
      const sb = !!(b[3] && b[3].pressed);
      if (sb && !st.stickBtn) this.recalibrate();
      st.stickBtn = sb;
    });
    if (this.hands.xr) {
      this.hands.xr.squeeze = [this.state[this.hand[0]].squeeze, this.state[this.hand[1]].squeeze];
      this.hands.xr.trigger = [this.state[this.hand[0]].trigger, this.state[this.hand[1]].trigger];
    }
    // child height: place the floor so your eyes are where the child's are (re-done when the child stands up)
    const headY = this.camera.position.y;
    const posed = this.frames > 2 && (this.refSpace === 'local' || headY > 0.3);
    if (Math.abs(this._lastEye - pl.eye) > 0.02) {
      this.calib = 1;
    }
    if (this.calib > 0 && posed) {
      pl.dolly.position.y = pl.eye - headY;
      this.calib = 0;
      this._lastEye = pl.eye;
      if(pl.eye>=1.45&&!pl.xrPostureLock){this.standingHeadY=headY;this.bodyHeight=headY>1&&headY<2.3?headY:1.65;}
    }
    if(pl.xrRecalibrate&&!pl.xrPostureLock){this.calib=1;pl.xrRecalibrate=false;}
    // the first real head pose: put you where the story placed you, facing the way it wants
    if (posed && !pl.xrPoseOK) {
      pl.xrPoseOK = true;
      if (pl.xrPending) {
        const q = pl.xrPending;
        pl.xrPending = null;
        pl.place(q.x, q.z, q.yaw, q.eye);
      }
    }
    this._veil(dt);
    if (this.endMode) {
      this.rays.forEach((r) => {
        r.visible = false;
      });
      this._end(dt);
      pl.xrMove.set(0, 0, 0);
      return;
    }
    if (this.blurred) {
      pl.xrMove.set(0, 0, 0);
      return;
    }
    // left stick: walk (where you look); right stick: snap-turn 30°
    const L = this.state[this.hand[0]],
      Rt = this.state[this.hand[1]];
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dz = Math.abs(L.stick[1]) > 0.15 ? -L.stick[1] : 0,
      dx = Math.abs(L.stick[0]) > 0.15 ? L.stick[0] : 0;
    pl.xrMove.set(0, 0, 0).addScaledVector(fwd, dz).addScaledVector(right, dx);
    const turn = Rt.stick[0];
    if(pl.xrManipulating&&Math.abs(turn)>.7)Rt.turned=true;
    if (Math.abs(turn) > 0.7 && !Rt.turned && !pl.xrManipulating) {
      Rt.turned = true;
      // rotate the dolly about the head, not the play-area centre
      const head = new THREE.Vector3();
      this.camera.getWorldPosition(head);
      const a = (-Math.sign(turn) * Math.PI) / 6;
      pl.dolly.position
        .sub(head)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), a)
        .add(head);
      pl.dolly.rotation.y += a;
    }
    if (Math.abs(turn) < 0.3) Rt.turned = false;
    // pointer rays: show only when they rest on something usable
    let label = '';
    this.ctrl.forEach((c, i) => {
      const hit = this.interactor.peekXR(c);
      this.rays[i].visible = !!hit;
      if (hit) {
        this.rays[i].scale.z = hit.distance;
        if (!label && hit.target.label) label = hit.target.label;
      }
    });
    // caption board
    const cap = ['thought', 'subtitle', 'hint'].map((id) => {
      const el = document.getElementById(id);
      if (!el || !el.classList.contains('on')) return null;
      const who = el.querySelector('.who'),
        say = el.querySelector('.say');
      return { who: who ? who.textContent : '', text: say ? say.textContent : el.textContent };
    });
    const st = this.ui.state || {};
    const prog = st.progress > 0.001 && st.progress < 1 ? Math.round(st.progress * 50) / 50 : 0;
    const stam =
      st.stamina !== null && st.stamina !== undefined && st.stamina < 0.98
        ? Math.round(st.stamina * 50) / 50
        : -1;
    const key = JSON.stringify([cap, label, prog, stam]);
    if (key !== this.lastCap) {
      this.lastCap = key;
      this._draw(cap, label, prog, stam);
    }
  }
  // mirror the page's fade and eyelids, plus the comfort vignette
  _veil(dt) {
    const f = this.fadeEl,
      on = this.endMode || !!(f && f.classList.contains('on')); // the end card sits in the dark
    this.fadeLin = THREE.MathUtils.clamp(this.fadeLin + ((on ? 1 : -1) * dt) / FADE_S, 0, 1);
    const u = this.veilMat.uniforms;
    u.uFade.value = smooth(this.fadeLin);
    u.uFadeCol.value.copy(
      !this.endMode && f && f.classList.contains('white') ? this.white : this.black,
    );
    let lid = 0;
    if (this.lidEl) {
      lid = parseFloat(this.lidEl.style.getPropertyValue('--lid')) || 0;
    }
    u.uLid.value = THREE.MathUtils.clamp(lid, 0, 1);
    const pl = this.player,
      speed = pl.vel ? pl.vel.length() : 0;
    const want = pl.xrMove && pl.xrMove.lengthSq() > 0.0001 ? Math.min(1, speed / 3.3) * 0.55 : 0;
    this.tunnel += (want - this.tunnel) * Math.min(1, dt * 6);
    u.uTunnel.value = this.tunnel;
  }
  _wrap(g, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean),
      lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  _draw([thought, subtitle, hint], label, prog, stam) {
    const top=this.instructionCanvas.getContext('2d'),IW=this.instructionCanvas.width,IH=this.instructionCanvas.height;
    top.clearRect(0,0,IW,IH);top.textAlign='center';top.textBaseline='middle';
    const instruction=playerText(hint?.text||label||'');
    let size=34,lines=[];
    do{top.font=`400 ${size}px "Gowun Batang", Georgia, serif`;lines=this._wrap(top,instruction,IW-140);if(lines.length*size*1.4<IH-40)break;size-=2;}while(size>24);
    top.fillStyle='#f3ead8';top.shadowColor='rgba(0,0,0,.95)';top.shadowBlur=10;top.shadowOffsetY=2;
    lines.forEach((line,i)=>top.fillText(line,IW/2,(IH-lines.length*size*1.4)/2+(i+.5)*size*1.4));
    this.instructionTex.needsUpdate=true;
    this.instructionBoard.visible=this.active&&!this.endMode&&!!instruction;
    const g=this.capCanvas.getContext('2d'),W=this.capCanvas.width,H=this.capCanvas.height;
    g.clearRect(0,0,W,H);g.textAlign='center';g.textBaseline='middle';
    const bars=[];if(prog>0)bars.push({v:prog,sewing:true});if(stam>=0)bars.push({v:stam});
    let scale=1,blocks,total;
    for(let pass=0;pass<12;pass++){
      blocks=[];total=bars.length*70;
      if(thought?.text){const font=`italic 400 ${Math.round(38*scale)}px "Gowun Batang", Georgia, serif`;g.font=font;const rows=this._wrap(g,thought.text,W-140),line=50*scale;blocks.push({rows,font,line,height:rows.length*line+14,dialogue:false});total+=rows.length*line+14;}
      if(subtitle?.text){const font=`400 ${Math.round(36*scale)}px "Gowun Batang", Georgia, serif`;g.font=font;const rows=this._wrap(g,subtitle.text,W-160),line=48*scale;blocks.push({rows,font,line,height:rows.length*line+64*scale,dialogue:true,who:subtitle.who||'Around you'});total+=rows.length*line+64*scale;}
      if(total<H-40)break;scale*=.9;
    }
    let y=Math.max(20,(H-total)/2);
    for(const block of blocks){
      if(block.dialogue){g.font=block.font;const bw=Math.min(W-84,Math.max(260,...block.rows.map(row=>g.measureText(row).width+72))),bx=(W-bw)/2;g.shadowBlur=0;g.fillStyle='rgba(9,7,4,.78)';g.fillRect(bx,y,bw,block.height-8);g.fillStyle='#d2a46a';g.fillRect(bx,y,3,block.height-8);g.font=`400 ${Math.round(21*scale)}px "Gowun Batang", Georgia, serif`;g.fillStyle='#e3b77c';g.fillText(block.who.toUpperCase(),W/2,y+22*scale);}
      g.font=block.font;g.fillStyle=block.dialogue?'#fff4df':'#f3ead8';g.shadowColor='rgba(0,0,0,.9)';g.shadowBlur=block.dialogue?0:10;
      const textY=y+(block.dialogue?43*scale:0);
      block.rows.forEach((row,i)=>g.fillText(row,W/2,textY+(i+.5)*block.line));y+=block.height;
    }
    g.shadowBlur=0;
    for(const bar of bars){const bw=320,bx=(W-bw)/2;
      if(bar.sewing){g.fillStyle='#302b27';g.fillRect(bx,y+24,bw,10);g.fillStyle='#ece4d6';g.fillRect(bx,y+24,bw*Math.max(0,Math.min(1,bar.v)),10);}
      else{g.save();g.translate(bx,y);g.scale(bw/1656,bw/1656);g.translate(28,-400);g.lineWidth=12;g.lineCap='round';g.strokeStyle='rgba(210,58,44,.22)';g.stroke(this.progressPath);g.setLineDash([this.progressLength*Math.max(0,Math.min(1,bar.v)),this.progressLength+1]);g.strokeStyle='#d23a2c';g.stroke(this.progressPath);g.restore();}y+=70;
    }
    this.captionLayout={instruction:{lines,boxed:false},narrative:{height:total,bottom:y,scale},separate:true};
    this.capTex.needsUpdate=true;
  }
  _end(dt) {
    this.endT+=dt;const groups=[];let cue=false;
    for(const id of this.endIds||[]){const el=document.getElementById(id);if(!el||el.hidden)continue;
      const a=Number(getComputedStyle(el).opacity);
      if(id==='stat-fin'){cue=el.classList.contains('on');const title=el.querySelector('h2');if(title)groups.push({id,a,kind:'title',el:title});for(const p of el.querySelectorAll('p'))groups.push({id,a,kind:'small',el:p});}
      else{if(id==='pro-click')cue=el.classList.contains('on');groups.push({id,a,kind:id==='pro-title'?'title':/pro-click|stat-src/.test(id)?'small':'stat',el});}
    }
    this.finT=cue&&!this.prologueLeaving?this.finT+dt:0;
    if(this.finT>2.5&&!this.prologueLeaving)this.endReady=true;
    const g=this.endCanvas.getContext('2d'),W=this.endCanvas.width,H=this.endCanvas.height;
    if(this.endKind!=='prologue'){
      if(!this.exitCue){this.exitCue=document.createElement('span');this.exitCue.textContent='Pull the trigger to leave VR';}
      groups.push({id:'exit-cue',a:THREE.MathUtils.clamp((this.finT-2.5)/.8,0,1),kind:'small',el:this.exitCue});
    }
    const layout=layoutCard(g,groups,W,H),exit=this.ui.state.introExit;
    g.clearRect(0,0,W,H);g.textAlign='left';g.textBaseline='middle';
    let hero=null;
    for(const block of layout.blocks){block.rows.forEach((row,i)=>{let x=(W-row.width)/2;for(const token of row.tokens){
      g.font=token.font;const y=block.y+(i+.5)*block.line;
      if(token.hero){hero={x:x+token.width/2,y,font:token.font,width:token.width};}
      else{g.globalAlpha=block.id==='pro-3'&&exit?Number(getComputedStyle(document.querySelector('#pro-3 .intro-copy')).opacity):block.a;g.fillStyle=token.strong?'#d23a2c':block.kind==='small'?'#bfb7a9':'#ece4d6';g.fillText(token.word,x,y);}
      x+=token.width;
    }});}
    if(hero){
      const move=exit?smooth(THREE.MathUtils.clamp((performance.now()-exit.bodyEnd)/INTRO_TIMING.titleMove,0,1)):0;
      const size=Number(hero.font.match(/([\d.]+)px/)[1]),fontSize=THREE.MathUtils.lerp(size,76,move);
      const x=THREE.MathUtils.lerp(hero.x,W/2,move),y=THREE.MathUtils.lerp(hero.y,H/2,move);
      g.font=hero.font.replace(/[\d.]+px/,fontSize+'px');g.textAlign='center';g.fillStyle='#d23a2c';
      g.globalAlpha=exit?Number(getComputedStyle(document.querySelector('#pro-title')).opacity):Number(getComputedStyle(document.querySelector('#pro-3')).opacity);
      const text=move>0?'The Long Way Home':'the long way home';g.fillText(text,x,y);
      layout.hero={x,y,size:fontSize,alpha:g.globalAlpha,text,width:g.measureText(text).width,move};
    }
    g.globalAlpha=1;this.endLayout=layout;this.endTex.needsUpdate=true;
  }
}
