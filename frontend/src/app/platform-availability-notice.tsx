import {
  instagramAvailabilityCopy,
  platformStatus,
  unavailablePlatformCopy,
  type PlatformId,
} from "./platform-status";

export default function PlatformAvailabilityNotice({
  platform,
  context = "analyzer",
}: {
  platform: PlatformId;
  context?: "analyzer" | "landing";
}) {
  const status = platformStatus[platform];
  if (status.status === "available") return null;
  if (platform === "instagram") {
    if (context !== "landing") return null;
    return (
      <aside className="platform-availability-notice platform-availability-notice-landing" role="status">
        <div>
          <p className="platform-availability-eyebrow">Instagram availability</p>
          <h2>{instagramAvailabilityCopy.title}</h2>
          <p>{instagramAvailabilityCopy.text}</p>
          <p className="platform-availability-secondary">{instagramAvailabilityCopy.secondary}</p>
        </div>
      </aside>
    );
  }
  if (status.enabled) return null;

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
