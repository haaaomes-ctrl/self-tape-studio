import { Eye } from "lucide-react";

/**
 * Circular orbit animation used while a take is being analysed.
 * Dark navy panel with two counter-rotating rings, a glass lens core,
 * and an inner scan sweep. Respects prefers-reduced-motion.
 */
export function OrbitHero() {
  return (
    <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-xl bg-brand-navy">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-violet/25 blur-[80px] animate-pulse motion-reduce:animate-none" />
      <div
        className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-royal/25 blur-[80px] animate-pulse motion-reduce:animate-none"
        style={{ animationDelay: "1s" }}
      />

      {/* Orbit */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-40 w-40 rounded-full border-2 border-brand-violet/40 border-l-transparent border-b-transparent motion-safe:animate-spin motion-reduce:hidden"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute h-32 w-32 rounded-full border-2 border-brand-royal/40 border-r-transparent border-t-transparent motion-safe:animate-spin motion-reduce:hidden"
          style={{ animationDuration: "6s", animationDirection: "reverse" }}
        />

        {/* Core lens */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md">
          <Eye className="h-8 w-8 text-brand-off-white" strokeWidth={1.75} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-brand-royal/40 to-transparent motion-safe:animate-[orbitScan_2.4s_ease-in-out_infinite] motion-reduce:hidden" />
        </div>
      </div>

      <style>{`
        @keyframes orbitScan {
          0%, 100% { transform: translateY(-100%); opacity: 0; }
          50% { transform: translateY(100%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
