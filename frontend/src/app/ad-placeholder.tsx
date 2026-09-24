type AdPlaceholderProps = {
  format?: "banner" | "rectangle" | "sidebar";
  placement?: "left-rail" | "right-rail" | "home-inline-1" | "home-inline-2" | "downloader-inline";
  className?: string;
};

const dimensions = {
  banner: "Horizontal placement",
  rectangle: "Compact placement",
  sidebar: "Vertical placement",
};

export default function AdPlaceholder({
  format = "banner",
  placement = "downloader-inline",
  className = "",
}: AdPlaceholderProps) {
  const showDevelopmentPlaceholder = process.env.NODE_ENV !== "production";

  if (!showDevelopmentPlaceholder) return null;

  return (
    <aside
      className={`ad-placeholder ad-${format} ${className}`}
      aria-label={`Advertisement placeholder: ${placement}`}
      data-ad-placement={placement}
    >
      <span className="ad-description">Advertisement</span>
      <span className="ad-dimensions">Reserved ad space · {dimensions[format]}</span>
    </aside>
  );
}
