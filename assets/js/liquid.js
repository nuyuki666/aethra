/* ==========================================================================
   Aethra — liquid marble backdrop
   Domain-warped fBm rendered on a full-screen WebGL quad.
   Degrades to the CSS blob fallback if WebGL is missing or motion is reduced.
   ========================================================================== */
(function () {
  "use strict";

  var host = document.querySelector(".backdrop");
  if (!host) return;

  var canvas = host.querySelector(".backdrop__canvas");
  if (!canvas) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl =
    canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" }) ||
    canvas.getContext("experimental-webgl");

  if (!gl) return; // CSS fallback stays visible

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",

    "float hash(vec2 p){",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",

    "float noise(vec2 p){",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  float a = hash(i);",
    "  float b = hash(i + vec2(1.0, 0.0));",
    "  float c = hash(i + vec2(0.0, 1.0));",
    "  float d = hash(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",

    "float fbm(vec2 p){",
    "  float v = 0.0;",
    "  float amp = 0.5;",
    "  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);",
    "  for (int i = 0; i < 5; i++) {",
    "    v += amp * noise(p);",
    "    p = rot * p * 2.02;",
    "    amp *= 0.5;",
    "  }",
    "  return v;",
    "}",

    "void main(){",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec2 uv = frag / u_res;",
    "  vec2 p = (frag - 0.5 * u_res) / u_res.y;",
    "  p *= 1.45;",
    "  p += u_mouse * 0.09;",

    "  float t = u_time * 0.028;",

    // two levels of domain warping -> marbled, liquid-metal flow
    "  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t), fbm(p + vec2(5.2, 1.3) - t * 0.8));",
    "  vec2 r = vec2(",
    "    fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.6),",
    "    fbm(p + 2.6 * q + vec2(8.3, 2.8) - t * 0.45)",
    "  );",
    "  float f = fbm(p + 3.2 * r);",

    // broad silver body
    "  float body = smoothstep(0.18, 0.92, f);",
    // bright veins where the field folds
    "  float fold = f + 0.42 * r.y + 0.18 * q.x;",
    "  float veins = pow(1.0 - abs(sin(fold * 8.5)), 13.0);",
    // faint secondary filament layer for depth
    "  float film = pow(1.0 - abs(sin(fold * 3.1 + 1.4)), 22.0);",

    "  float lum = 0.032 + body * 0.105 + veins * 0.50 + film * 0.20;",

    // vignette so UI text always sits on a calm field
    "  vec2 c = uv - 0.5;",
    "  float vig = 1.0 - smoothstep(0.28, 0.92, length(c * vec2(1.05, 1.25)));",
    "  lum *= mix(0.40, 1.0, vig);",

    // slight cool cast, matching the neutral ramp
    "  vec3 col = lum * vec3(0.90, 0.95, 1.04);",
    "  col += vec3(0.028, 0.032, 0.040);",

    // dithering kills banding in the large dark areas
    "  float dither = (hash(frag + fract(u_time)) - 0.5) / 255.0;",
    "  col += dither;",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uTime = gl.getUniformLocation(prog, "u_time");
  var uMouse = gl.getUniformLocation(prog, "u_mouse");

  // Cap the device pixel ratio: the shader is fill-rate bound, not detail bound.
  var DPR_CAP = 1.5;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    var w = Math.round(host.clientWidth * dpr);
    var h = Math.round(host.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }

  var mouse = { x: 0, y: 0 };
  var target = { x: 0, y: 0 };

  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      function (e) {
        target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );
  }

  var running = true;
  var start = performance.now();
  var last = start;
  var clock = 0;

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  // Pause while fully scrolled past the viewport-fixed backdrop is still visible,
  // so we only guard against hidden tabs here.
  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;

    resize();

    mouse.x += (target.x - mouse.x) * 0.035;
    mouse.y += (target.y - mouse.y) * 0.035;
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uTime, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }

  function drawStill() {
    resize();
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uTime, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  host.classList.add("has-webgl");

  // Paint one frame synchronously: a tab that loads in the background gets
  // its rAF throttled, and we still want a rendered backdrop when it surfaces.
  clock = reduced ? 11.5 : 8;
  drawStill();
  canvas.classList.add("is-ready");

  // Recover from a zero-sized boot (hidden tab, late layout) and from any
  // resize while the animation loop is paused.
  if ("ResizeObserver" in window) new ResizeObserver(drawStill).observe(host);
  else window.addEventListener("resize", drawStill);
  if (!canvas.width || !canvas.height) setTimeout(drawStill, 300);

  if (!reduced) {
    last = performance.now();
    requestAnimationFrame(frame);
  }
})();
