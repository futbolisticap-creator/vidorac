type AdPlaceholderProps = {
  format?: "banner" | "rectangle" | "sidebar";
  className?: string;
};

const dimensions = {
  banner: "728 × 90",
  rectangle: "300 × 250",
  sidebar: "160 × 600",
};

export default function AdPlaceholder({
  format = "banner",
  className = "",
}: AdPlaceholderProps) {
  return (
    <aside
      className={`ad-placeholder ad-${format} ${className}`}
      aria-label="Advertisement placeholder"
    >
      <span className="ad-description">Advertisement</span>
      <span className="ad-dimensions">{dimensions[format]}</span>
    </aside>
  );
}
