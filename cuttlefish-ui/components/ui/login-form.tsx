"use client";

import type { FormEvent, JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";

const vertexSmokeySource = `
  attribute vec4 a_position;

  void main() {
    gl_Position = a_position;
  }
`;

const fragmentSmokeySource = `
  precision mediump float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec2 iMouse;
  uniform vec3 uColor;

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 centered = (2.0 * gl_FragCoord.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
    vec2 mouse = (iMouse / iResolution.xy) * 2.0 - 1.0;
    float time = iTime * 0.36;

    vec2 flow = centered;
    for (float i = 1.0; i < 7.0; i++) {
      flow.x += 0.34 / i * cos(i * 2.1 * flow.y + time + mouse.x * 1.8);
      flow.y += 0.34 / i * sin(i * 2.0 * flow.x + time + mouse.y * 1.8);
    }

    float veil = smoothstep(0.84, 0.18, abs(sin(flow.x + flow.y + time)));
    float vignette = smoothstep(0.92, 0.22, distance(uv, vec2(0.5)));
    vec3 color = uColor * veil * vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface SmokeyBackgroundProps {
  backdropBlurAmount?: BlurSize;
  color?: string;
  className?: string;
}

const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;

  return [r, g, b];
}

export function SmokeyBackground({
  backdropBlurAmount = "sm",
  color = "#0a4070",
  className = "",
}: SmokeyBackgroundProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl");

    if (!canvas || !gl) return;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSmokeySource);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "iResolution");
    const timeLocation = gl.getUniformLocation(program, "iTime");
    const mouseLocation = gl.getUniformLocation(program, "iMouse");
    const colorLocation = gl.getUniformLocation(program, "uColor");
    const [r, g, b] = hexToRgb(color);
    gl.uniform3f(colorLocation, r, g, b);

    const start = performance.now();
    let animationFrame = 0;

    const render = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      const mouse = mouseRef.current;
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(timeLocation, (performance.now() - start) / 1000);
      gl.uniform2f(
        mouseLocation,
        mouse.active ? mouse.x : width / 2,
        mouse.active ? height - mouse.y : height / 2
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrame = requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true,
      };
    };
    const handlePointerLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, [color]);

  return (
    <div className={`absolute inset-0 h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className={`absolute inset-0 ${blurClassMap[backdropBlurAmount]}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,255,238,0.14),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.18),rgba(5,5,5,0.78))]" />
    </div>
  );
}

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 650));
    router.push("/vault");
  };

  return (
    <section className="w-full max-w-[400px] rounded-2xl border border-white/15 bg-[#071015]/78 p-5 shadow-[0_24px_72px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-white">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-300">
          Sign in to open your private vault.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <User aria-hidden="true" size={16} />
            Email address
          </span>
          <input
            autoComplete="email"
            className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-white/[0.09] focus:ring-4 focus:ring-cyan-300/15"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Lock aria-hidden="true" size={16} />
            Password
          </span>
          <span className="relative block">
            <input
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-white/[0.09] focus:ring-4 focus:ring-cyan-300/15"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-300">
            <input
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-cyan-300/40"
              type="checkbox"
            />
            Remember me
          </label>
          <a className="font-medium text-cyan-200 transition hover:text-white" href="#">
            Forgot password?
          </a>
        </div>

        <button
          className="group flex h-11 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 shadow-[0_0_28px_rgba(0,255,238,0.22)] transition hover:bg-white hover:shadow-[0_0_42px_rgba(0,255,238,0.34)] focus:outline-none focus:ring-4 focus:ring-cyan-300/25 disabled:cursor-wait disabled:opacity-70"
          disabled={loading}
          id="login-submit-btn"
          type="submit"
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight
                aria-hidden="true"
                className="ml-2 h-5 w-5 transition group-hover:translate-x-1"
              />
            </>
          )}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          or
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        className="flex h-10 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.1] focus:outline-none focus:ring-4 focus:ring-cyan-300/15"
        type="button"
      >
        Continue with Google
      </button>

      <p className="mt-5 text-center text-sm text-slate-400">
        New to Cuttlefish?{" "}
        <a className="font-semibold text-cyan-200 transition hover:text-white" href="#">
          Request access
        </a>
      </p>
    </section>
  );
}
