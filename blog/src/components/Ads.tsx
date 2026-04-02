const VerticalAd = ({ className = "" }: { className?: string }) => (
  <a
    href="https://toaletna.com"
    target="_blank"
    rel="noopener noreferrer"
    className={`relative flex items-center justify-center rounded-xl overflow-hidden group block ${className}`}
  >
    {/* Ad image fills the entire slot */}
    <img
      src="/blog/ad-vertical.png"
      alt="Toaletna.com — Интерактивна карта на тоалетните в България"
      className="absolute inset-0 w-full h-full object-cover object-top"
      draggable={false}
    />

    {/* Subtle dark overlay on hover for depth */}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />

    {/* CTA button centered */}
    <span className="relative z-10 inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-bold text-white top-3.5
      bg-blue-600
      shadow-[0_0_16px_rgba(37,99,235,0.7)]
      group-hover:bg-blue-500
      group-hover:shadow-[0_0_28px_rgba(37,99,235,0.95)]
      group-hover:scale-105
      transition-all duration-300 ease-out
      select-none
      whitespace-nowrap
    ">
      Към Картата
    </span>
  </a>
);

export const Ad1 = ({ className = "" }: { className?: string }) => (
  <VerticalAd className={className} />
);

export const Ad2 = ({ className = "" }: { className?: string }) => (
  <VerticalAd className={className} />
);
