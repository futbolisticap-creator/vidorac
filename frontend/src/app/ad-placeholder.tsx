type AdPlaceholderProps = {
  format?: "banner" | "rectangle" | "sidebar";
  className?: string;
};

const dimensions = {
  banner: "Horizontal placement",
  rectangle: "Compact placement",
  sidebar: "Vertical placement",
};

export default function AdPlaceholder({
  format = "banner",
  className = "",
}: AdPlaceholderProps) {
  return (
    <aside
      className={`ad-placeholder ad-${format} ${className}`}
      aria-label="Reserved advertising space"
    >
      <span className="ad-description">Reserved for future advertising</span>
      <span className="ad-dimensions">{dimensions[format]}</span>
    </aside>
  );
}
