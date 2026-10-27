(function () {
  "use strict";

  const config = {
    enabled: true,
    threshold: 0.78,
    intensity: 0.42,
    scale: 0.5,
  };

  const state = {
    gl: null,
    width: 0,
    height: 0,
    scene: null,
    bright: null,
    blur: null,
    program: null,
    vao: null,
    failed: false,
  };

  const vertexSource = `#version 300 es
  precision highp float;

  out vec2 vUv;

  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;

  in vec2 vUv;
  out vec4 outColor;

  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform int uPass;
  uniform vec2 uTexel;
  uniform float uThreshold;
  uniform float uIntensity;

  void main() {
    vec3 c = texture(uScene, vUv).rgb;

    if (uPass == 0) {
      float brightness = max(max(c.r, c.g), c.b);
      float weight = smoothstep(
        uThreshold,
        uThreshold + 0.25,
        brightness
      );

      outColor = vec4(c * weight, 1.0);

    } else if (uPass == 1 || uPass == 2) {
      vec2 axis = uPass == 1
        ? vec2(uTexel.x, 0.0)
        : vec2(0.0, uTexel.y);

      vec3 sum = c * 0.227027;

      sum += texture(
        uScene,
        vUv + axis * 1.384615
      ).rgb * 0.316216;

      sum += texture(
        uScene,
        vUv - axis * 1.384615
      ).rgb * 0.316216;

      sum += texture(
        uScene,
        vUv + axis * 3.230769
      ).rgb * 0.070270;

      sum += texture(
        uScene,
        vUv - axis * 3.230769
      ).rgb * 0.070270;

      outColor = vec4(sum, 1.0);

    } else {
      vec3 bloom = texture(uBloom, vUv).rgb;

      outColor = vec4(
        c + bloom * uIntensity,
        1.0
      );
    }
  }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error("Shader allocation failed");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);

      gl.deleteShader(shader);

      throw new Error(message || "Shader compile failed");
    }

    return shader;
  }

  function createProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);

    let fs;
    let program;

    try {
      fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);

      program = gl.createProgram();

      if (!program) {
        throw new Error("Program allocation failed");
      }

      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
      }

      return program;
    } catch (error) {
      if (program) {
        gl.deleteProgram(program);
      }

      throw error;
    } finally {
      gl.deleteShader(vs);

      if (fs) {
        gl.deleteShader(fs);
      }
    }
  }

  function createTarget(gl, width, height, withDepth) {
    const target = {
      framebuffer: gl.createFramebuffer(),
      texture: gl.createTexture(),
      depth: null,
      width,
      height,
    };

    if (!target.framebuffer || !target.texture) {
      throw new Error("Bloom framebuffer allocation failed");
    }

    gl.bindTexture(gl.TEXTURE_2D, target.texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      target.texture,
      0,
    );

    if (withDepth) {
      target.depth = gl.createRenderbuffer();

      if (!target.depth) {
        throw new Error("Bloom depth allocation failed");
      }

      gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth);

      gl.renderbufferStorage(
        gl.RENDERBUFFER,
        gl.DEPTH_COMPONENT24,
        width,
        height,
      );

      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        target.depth,
      );
    }

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Bloom framebuffer incomplete");
    }

    return target;
  }

  function deleteTarget(gl, target) {
    if (!target) return;

    if (target.depth) {
      gl.deleteRenderbuffer(target.depth);
    }

    if (target.texture) {
      gl.deleteTexture(target.texture);
    }

    if (target.framebuffer) {
      gl.deleteFramebuffer(target.framebuffer);
    }
  }

  function dispose() {
    const gl = state.gl;

    if (gl && !gl.isContextLost()) {
      deleteTarget(gl, state.scene);
      deleteTarget(gl, state.bright);
      deleteTarget(gl, state.blur);

      if (state.program) {
        gl.deleteProgram(state.program);
      }

      if (state.vao) {
        gl.deleteVertexArray(state.vao);
      }
    }

    state.gl = null;
    state.width = 0;
    state.height = 0;
    state.scene = null;
    state.bright = null;
    state.blur = null;
    state.program = null;
    state.vao = null;
  }

  function prepare(gl, width, height) {
    if (!config.enabled || state.failed || !gl || gl.isContextLost()) {
      return false;
    }

    if (
      state.gl === gl &&
      state.width === width &&
      state.height === height &&
      state.scene
    ) {
      return true;
    }

    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);

    const previousRenderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING);

    try {
      dispose();

      state.gl = gl;
      state.program = createProgram(gl);
      state.vao = gl.createVertexArray();

      if (!state.vao) {
        throw new Error("Bloom VAO allocation failed");
      }

      const smallWidth = Math.max(1, Math.floor(width * config.scale));

      const smallHeight = Math.max(1, Math.floor(height * config.scale));

      state.scene = createTarget(gl, width, height, true);

      state.bright = createTarget(gl, smallWidth, smallHeight, false);

      state.blur = createTarget(gl, smallWidth, smallHeight, false);

      state.width = width;
      state.height = height;

      return true;
    } catch (error) {
      console.warn("[Bloom3D] Disabled after initialization failure:", error);

      dispose();
      state.failed = true;

      return false;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

      gl.bindTexture(gl.TEXTURE_2D, previousTexture);

      gl.bindRenderbuffer(gl.RENDERBUFFER, previousRenderbuffer);
    }
  }

  function begin(gl, width, height) {
    if (!prepare(gl, width, height)) {
      return false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.scene.framebuffer);

    gl.viewport(0, 0, width, height);

    return true;
  }

  function finish() {
    const gl = state.gl;

    if (!gl || !state.scene || gl.isContextLost()) {
      return;
    }

    const previousViewport = gl.getParameter(gl.VIEWPORT);

    const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);

    const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

    const previousDepthTest = gl.isEnabled(gl.DEPTH_TEST);

    const previousBlend = gl.isEnabled(gl.BLEND);

    const previousCull = gl.isEnabled(gl.CULL_FACE);

    const previousScissor = gl.isEnabled(gl.SCISSOR_TEST);

    const previousDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

    const previousColorMask = gl.getParameter(gl.COLOR_WRITEMASK);

    const textures = [];

    for (let unit = 0; unit < 2; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit);

      textures.push(gl.getParameter(gl.TEXTURE_BINDING_2D));
    }

    try {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.SCISSOR_TEST);

      gl.depthMask(false);
      gl.colorMask(true, true, true, true);

      gl.useProgram(state.program);
      gl.bindVertexArray(state.vao);

      const uniform = (name) => gl.getUniformLocation(state.program, name);

      gl.uniform1i(uniform("uScene"), 0);
      gl.uniform1i(uniform("uBloom"), 1);

      gl.uniform1f(uniform("uThreshold"), config.threshold);

      gl.uniform1f(uniform("uIntensity"), config.intensity);

      gl.uniform2f(
        uniform("uTexel"),
        1 / state.bright.width,
        1 / state.bright.height,
      );

      function pass(target, input, index, extra = null) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);

        gl.viewport(
          0,
          0,
          target ? target.width : state.width,
          target ? target.height : state.height,
        );

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, input);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, extra);

        gl.uniform1i(uniform("uPass"), index);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      pass(state.bright, state.scene.texture, 0);

      pass(state.blur, state.bright.texture, 1);

      pass(state.bright, state.blur.texture, 2);

      pass(null, state.scene.texture, 3, state.bright.texture);
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.viewport(...previousViewport);
      gl.bindVertexArray(previousVao);
      gl.useProgram(previousProgram);

      for (let unit = 0; unit < 2; unit++) {
        gl.activeTexture(gl.TEXTURE0 + unit);

        gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
      }

      gl.activeTexture(previousActiveTexture);

      gl.depthMask(previousDepthMask);
      gl.colorMask(...previousColorMask);

      if (previousDepthTest) {
        gl.enable(gl.DEPTH_TEST);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      if (previousBlend) {
        gl.enable(gl.BLEND);
      } else {
        gl.disable(gl.BLEND);
      }

      if (previousCull) {
        gl.enable(gl.CULL_FACE);
      } else {
        gl.disable(gl.CULL_FACE);
      }

      if (previousScissor) {
        gl.enable(gl.SCISSOR_TEST);
      } else {
        gl.disable(gl.SCISSOR_TEST);
      }
    }
  }

  window.bloomSystem3D = Object.freeze({
    begin,
    finish,
    dispose,

    setEnabled(value) {
      if (typeof value !== "boolean") {
        return false;
      }

      config.enabled = value;

      if (!value) {
        dispose();
      }

      return true;
    },

    setIntensity(value) {
      if (!Number.isFinite(value) || value < 0 || value > 2) {
        return false;
      }

      config.intensity = value;

      return true;
    },

    getState() {
      return {
        enabled: config.enabled,
        ready: Boolean(state.scene),
        failed: state.failed,
        intensity: config.intensity,
        threshold: config.threshold,
        scale: config.scale,
      };
    },
  });
})();
