import type { Metadata } from "next";
import { DropTrap } from "@/components/landing/drop-trap";
import { HeroSection } from "@/components/landing/hero-section";

export const metadata: Metadata = {
  title: "Drop",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/drop",
  },
};

export default function DropPage() {
  return (
    <>
      <DropTrap />
      <HeroSection trapped />
    </>
  );
}