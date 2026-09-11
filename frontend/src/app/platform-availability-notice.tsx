import { platformStatus, unavailablePlatformCopy, type PlatformId } from "./platform-status";

export default function PlatformAvailabilityNotice({
  platform,
  context = "analyzer",
}: {
  platform: PlatformId;
  context?: "analyzer" | "landing";
}) {
  if (platformStatus[platform].enabled) return null;

  return (
    <aside className={`platform-availability-notice platform-availability-notice-${context}`} role="status">
      <div>
        <p className="platform-availability-eyebrow">YouTube availability</p>
        <h2>{unavailablePlatformCopy.title}</h2>
        <p>{context === "landing" ? unavailablePlatformCopy.landingText : unavailablePlatformCopy.text}</p>
        <p className="platform-availability-secondary">
          {context === "landing" ? unavailablePlatformCopy.landingSecondary : unavailablePlatformCopy.secondary}
        </p>
      </div>
    </aside>
  );
}
