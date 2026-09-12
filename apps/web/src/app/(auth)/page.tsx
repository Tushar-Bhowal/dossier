"use client";

import React, { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { login, register, ApiError } from "@/lib/api";
import { useMe } from "@/hooks/use-me";

// three.js is loaded from a CDN at runtime, so it brings no types with it. This describes only the
// surface the background actually touches — enough for real type checking without adding a ~600KB
// dependency to the bundle for a decorative effect.
interface ThreeDisposable {
  dispose(): void;
}
interface ThreeScene {
  add(object: object): void;
}
type ThreeCamera = object;
interface ThreeRenderer extends ThreeDisposable {
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number): void;
  render(scene: ThreeScene, camera: ThreeCamera): void;
}
interface ThreeNamespace {
  WebGLRenderer: new (params: {
    canvas: HTMLCanvasElement;
    alpha?: boolean;
    antialias?: boolean;
  }) => ThreeRenderer;
  Scene: new () => ThreeScene;
  OrthographicCamera: new (
    left: number,
    right: number,
    top: number,
    bottom: number,
    near: number,
    far: number,
  ) => ThreeCamera;
  Vector2: new (x: number, y: number) => { set(x: number, y: number): void };
  Vector3: new (x: number, y: number, z: number) => object;
  ShaderMaterial: new (params: Record<string, unknown>) => ThreeDisposable;
  PlaneGeometry: new (width: number, height: number) => ThreeDisposable;
  Mesh: new (geometry: ThreeDisposable, material: ThreeDisposable) => object;
  GLSL3: unknown;
  CustomBlending: unknown;
  SrcAlphaFactor: unknown;
  OneFactor: unknown;
}

function AuthContent() {
  const searchParams = useSearchParams();
  const paramMode = searchParams?.get("mode");
  const defaultIsLogin = paramMode === "login";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isCheckingAuth } = useMe();

  // Redirect to /kits if already logged in
  useEffect(() => {
    if (!isCheckingAuth && user) {
      router.replace("/kits");
    }
  }, [user, isCheckingAuth, router]);

  // Adjusted during render rather than from an effect: an effect would paint the previous tab
  // first and correct it on the next frame.
  const [lastMode, setLastMode] = useState(paramMode);
  if (paramMode !== lastMode) {
    setLastMode(paramMode);
    if (paramMode === "login") {
      setIsLogin(true);
    } else if (paramMode === "register") {
      setIsLogin(false);
    }
  }

  // Three.js animated WebGL dot matrix background
  useEffect(() => {
    let active = true;
    let renderer: ThreeRenderer | undefined;
    let geometry: ThreeDisposable | undefined;
    let material: ThreeDisposable | undefined;
    let scene: ThreeScene | undefined;
    let camera: ThreeCamera | undefined;
    let animationId: number;
    let cleanUpResize: (() => void) | null = null;

    const initThree = (THREE: ThreeNamespace) => {
      if (!canvasRef.current || !active) return;
      const canvas = canvasRef.current;

      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch (e) {
        console.warn("WebGL not supported or context error", e);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const uniforms = {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth * 2, window.innerHeight * 2) },
        u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
        u_colors: {
          value: [
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(0.984, 0.255, 0.157), // #FB4128
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(0.984, 0.45, 0.2),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(0.984, 0.255, 0.157),
          ],
        },
        u_total_size: { value: 20.0 },
        u_dot_size: { value: 6.0 },
        u_reverse: { value: 0 },
      };

      material = new THREE.ShaderMaterial({
        vertexShader: `
          precision mediump float;
          uniform vec2 u_resolution;
          out vec2 fragCoord;
          void main() {
            gl_Position = vec4(position, 1.0);
            fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }
        `,
        fragmentShader: `
          precision mediump float;
          in vec2 fragCoord;

          uniform float u_time;
          uniform float u_opacities[10];
          uniform vec3 u_colors[6];
          uniform float u_total_size;
          uniform float u_dot_size;
          uniform vec2 u_resolution;
          uniform int u_reverse;

          out vec4 fragColor;

          float PHI = 1.61803398874989484820459;
          float random(vec2 xy) {
              return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
          }

          void main() {
              vec2 st = fragCoord.xy;
              st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
              st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

              float opacity = step(0.0, st.x) * step(0.0, st.y);

              vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

              float frequency = 5.0;
              float show_offset = random(st2);
              float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
              opacity *= u_opacities[int(rand * 10.0)];
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

              vec3 color = u_colors[int(show_offset * 6.0)];

              float animation_speed_factor = 3.0;
              vec2 center_grid = u_resolution / 2.0 / u_total_size;
              float dist_from_center = distance(center_grid, st2);

              float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

              float current_timing_offset = timing_offset_intro;
              opacity *= step(current_timing_offset, u_time * animation_speed_factor);
              opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

              fragColor = vec4(color, opacity);
              fragColor.rgb *= fragColor.a;
          }
        `,
        uniforms: uniforms,
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        transparent: true,
      });

      geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const startTime = performance.now();
      const renderFrame = () => {
        if (!renderer || !scene || !camera) return;
        uniforms.u_time.value = (performance.now() - startTime) / 1000.0;
        renderer.render(scene, camera);
      };

      if (prefersReducedMotion) {
        uniforms.u_time.value = 3.0; // Static render of dot canvas
        renderer.render(scene, camera);
      } else {
        const animate = () => {
          if (!active) return;
          animationId = requestAnimationFrame(animate);
          renderFrame();
        };
        animate();
      }

      const handleResize = () => {
        if (!renderer || !scene || !camera) return;
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.u_resolution.value.set(window.innerWidth * 2, window.innerHeight * 2);
        if (prefersReducedMotion) {
          renderer.render(scene, camera);
        }
      };
      window.addEventListener("resize", handleResize);

      cleanUpResize = () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    const loadedThree = () => (window as unknown as { THREE?: ThreeNamespace }).THREE;

    const alreadyLoaded = loadedThree();
    if (alreadyLoaded) {
      initThree(alreadyLoaded);
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => {
        const three = loadedThree();
        if (active && three) {
          initThree(three);
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      active = false;
      if (cleanUpResize) cleanUpResize();
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) renderer.dispose();
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    };
  }, []);

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (!isLogin && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const loggedInUser = await login(email, password);
        queryClient.setQueryData(["me"], loggedInUser);
        router.push("/kits");
      } else {
        const registeredUser = await register(email, password);
        queryClient.setQueryData(["me"], registeredUser);
        router.push("/kits");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode(targetLogin: boolean) {
    setError(null);
    setIsLogin(targetLogin);
    window.history.replaceState(null, "", targetLogin ? "/?mode=login" : "/?mode=register");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.85rem",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#000",
    color: "#fff",
    fontSize: "0.875rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const Logo = (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "0.85rem",
      }}
    >
      <Image
        src="/logo.png"
        alt="Dossier Logo"
        width={52}
        height={52}
        priority
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );

  const Footer = (
    <div
      style={{
        marginTop: "1.25rem",
        fontSize: "0.75rem",
        color: "#666",
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      By proceeding, you agree to Dossier&apos;s
      <br />
      <span style={{ color: "#888", textDecoration: "underline" }}>Terms of Service</span> and{" "}
      <span style={{ color: "#888", textDecoration: "underline" }}>Privacy Policy</span>.
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000",
        color: "#fff",
        fontFamily: "var(--font-sans), 'Inter', -apple-system, sans-serif",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      {/* WebGL Dot canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "radial-gradient(circle at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.95) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "#121212",
          borderRadius: 12,
          padding: "2.25rem 2rem",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 10px 40px rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "1px solid #222",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {Logo}
          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              marginBottom: "0.25rem",
              letterSpacing: "-0.025em",
            }}
          >
            {isLogin ? "Sign in to Dossier" : "Sign up for Dossier"}
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1.25rem", lineHeight: 1.5 }}>
            {isLogin ? "Welcome back to your interview prep kits." : "Create an account to start building your prep kits."}
          </p>

          {error && (
            <div
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                marginBottom: "1rem",
                borderRadius: 6,
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: "0.8rem",
                textAlign: "left",
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleAuthSubmit}
            style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}
            noValidate
          >
            <input
              style={inputStyle}
              type="email"
              placeholder="name@work-email.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder={isLogin ? "Password" : "Password (min 8 characters)"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.75rem",
                marginTop: "0.35rem",
                borderRadius: 6,
                border: "none",
                background: submitting ? "rgba(251, 65, 40, 0.6)" : "#FB4128",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background-color 0.2s ease, opacity 0.2s ease, transform 0.1s ease",
                boxShadow: "0 2px 12px rgba(251, 65, 40, 0.35)",
              }}
            >
              {submitting ? (isLogin ? "Signing in…" : "Creating account…") : (isLogin ? "Sign In" : "Sign Up")}
            </button>
          </form>

          <div style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#888" }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => toggleMode(!isLogin)}
              style={{
                color: "#FB4128",
                fontWeight: 500,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </div>
          {Footer}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-black" />}>
      <AuthContent />
    </Suspense>
  );
}
