"use client";

import type { ReactNode } from "react";
import { Warp } from "@paper-design/shaders-react";

const shaderColors = [
  "hsl(224, 92%, 7%)",
  "hsl(225, 68%, 44%)",
  "hsl(198, 100%, 24%)",
  "hsl(172, 100%, 72%)",
];

export function WarpShaderBackground() {
  return (
    <div className="absolute inset-0 bg-black">
      <Warp
        style={{ height: "100%", width: "100%" }}
        proportion={0.42}
        softness={1.15}
        distortion={0.28}
        swirl={0.86}
        swirlIterations={10}
        shape="checks"
        shapeScale={0.12}
        scale={1.05}
        rotation={0}
        speed={0.72}
        colors={shaderColors}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,255,238,0.12),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.18)_50%,rgba(0,0,0,0.76))]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  );
}

export default function WarpShaderHero({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <WarpShaderBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-8">
        {children ?? (
          <div className="w-full max-w-4xl space-y-8 text-center">
            <h1 className="text-balance font-sans text-5xl font-light text-white md:text-7xl">
              Elegant Shader Backgrounds
            </h1>

            <p className="mx-auto max-w-3xl font-sans text-xl font-light leading-relaxed text-white/90 md:text-2xl">
              Beautiful, performant shader effects that enhance your content
              without overwhelming it.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <button className="rounded-full border border-white/30 bg-white/20 px-8 py-4 font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30">
                Get Started
              </button>
              <button className="rounded-full bg-white px-8 py-4 font-medium text-gray-800 transition-transform duration-300 hover:scale-105">
                View Examples
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
