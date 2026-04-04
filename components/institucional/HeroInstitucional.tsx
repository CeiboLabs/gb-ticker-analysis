"use client";

import { useState, useEffect, useRef } from "react";

const STATS = [
  { value: 57, suffix: "+", label: "Años de experiencia" },
  { value: 1967, suffix: "", label: "Miembros de la BVM" },
  { value: 100, suffix: "%", label: "Regulado por BCU" },
  { value: 6, suffix: "", label: "Productos de inversión" },
];

function AnimatedCounter({
  value,
  suffix,
  duration = 2000,
  started,
}: {
  value: number;
  suffix: string;
  duration?: number;
  started: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const end = value;
    const stepTime = Math.max(Math.floor(duration / end), 16);
    const increment = Math.max(1, Math.floor(end / (duration / stepTime)));

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration, started]);

  return (
    <span>
      {started ? count.toLocaleString() : 0}
      {suffix}
    </span>
  );
}

export function HeroInstitucional() {
  const [mounted, setMounted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[#03065E] text-white px-6 pt-24 pb-0 relative overflow-hidden">
      {/* Gradient orbs */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
          animationDelay: "-5s",
        }}
      />
      <div
        className="absolute top-[30%] left-[60%] w-[300px] h-[300px] rounded-full animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Decorative lines */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.04]"
        viewBox="0 0 1200 800"
        fill="none"
      >
        <path d="M0 400 Q300 350 600 400 T1200 380" stroke="#C9A84C" strokeWidth="1" />
        <path d="M0 450 Q400 400 800 450 T1200 430" stroke="#fff" strokeWidth="0.5" />
        <path d="M0 500 Q350 460 700 500 T1200 480" stroke="#C9A84C" strokeWidth="0.5" />
      </svg>

      {/* Headline */}
      <h1
        className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-center max-w-4xl leading-[1.1] mb-6 relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s ease-out 0.3s",
        }}
      >
        Tu puerta local al mercado financiero{" "}
        <span className="gradient-text">internacional</span>
      </h1>

      {/* Subheadline */}
      <p
        className="text-base sm:text-lg text-white/55 text-center max-w-xl mb-10 relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.8s ease-out 0.5s",
        }}
      >
        Un amplio ecosistema de inversión con casi seis décadas gestionando
        activos financieros para miles de uruguayos y extranjeros.
      </p>

      {/* CTA buttons */}
      <div
        className="flex flex-col sm:flex-row gap-4 relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.8s ease-out 0.7s",
        }}
      >
        <a
          href="/servicios"
          className="group bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold px-8 py-3.5 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300 text-center"
        >
          Conocer Más
          <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
        </a>
        <a
          href="/contacto"
          className="glass border-white/15 text-white font-medium px-8 py-3.5 rounded-xl text-sm hover:bg-white/10 hover:border-white/25 transition-all duration-300 text-center"
        >
          Contactanos
        </a>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-28 sm:bottom-32 flex flex-col items-center text-white/15 animate-bounce z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 1.2s",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>

      {/* Stats bar */}
      <div
        ref={statsRef}
        className="w-full mt-auto relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 0.9s",
        }}
      >
        <div className="glass border-t border-white/10 border-b-0 border-l-0 border-r-0">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center py-7 sm:py-9 px-4">
                <div className="text-2xl sm:text-3xl font-bold gradient-text mb-1">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    started={statsVisible}
                  />
                </div>
                <div className="text-[10px] sm:text-xs text-white/35 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
