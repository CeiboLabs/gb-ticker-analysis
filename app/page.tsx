"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { ReportDemo } from "@/components/landing/ReportDemo";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Footer } from "@/components/landing/Footer";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

export default function LandingPage() {
  const router = useRouter();

  // Backward compat: redirect /?ticker=X to /analyze?ticker=X
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticker");
    if (t) {
      router.replace(`/analyze?ticker=${encodeURIComponent(t)}`);
    }
  }, [router]);

  function handleSearch(ticker: string) {
    router.push(`/analyze?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`);
  }

  return (
    <main>
      <HeroSection onSearch={handleSearch} />
      <ReportDemo />
      <ScrollReveal>
        <FeatureGrid />
      </ScrollReveal>
      <ScrollReveal>
        <HowItWorks />
      </ScrollReveal>
      <Footer onSearch={handleSearch} />
    </main>
  );
}
