"use client";

import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const KO_FI_EMBED_PARAMETERS =
  "hidefeed=true&widget=true&embed=true&preview=true";

type DonationModalContextValue = {
  openDonationModal: (trigger: HTMLElement) => void;
};

const DonationModalContext = createContext<DonationModalContextValue | null>(null);

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

function getKoFiEmbedUrl(supportUrl: string): string {
  const url = new URL(supportUrl);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = KO_FI_EMBED_PARAMETERS;
  return url.toString();
}

export function DonationProvider({
  children,
  supportUrl,
}: {
  children: ReactNode;
  supportUrl: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDonationModal = useCallback((trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setIsIframeLoaded(false);
    setIsOpen(true);
  }, []);

  const closeDonationModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDonationModal();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerRef.current?.focus();
    };
  }, [closeDonationModal, isOpen]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab" && event.target === event.currentTarget) {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  };

  const embedUrl = supportUrl ? getKoFiEmbedUrl(supportUrl) : null;

  return (
    <DonationModalContext.Provider value={{ openDonationModal }}>
      <div
        className="donation-app-content"
        inert={isOpen ? true : undefined}
        aria-hidden={isOpen ? "true" : undefined}
      >
        {children}
      </div>
      {isOpen && supportUrl && embedUrl ? (
        <div
          className="donation-modal-backdrop"
          data-testid="donation-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDonationModal();
          }}
        >
          <div
            ref={dialogRef}
            className="donation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-modal-title"
            aria-describedby="donation-modal-description"
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
          >
            <header className="donation-modal-header">
              <div>
                <h2 id="donation-modal-title">Support Vidorac</h2>
                <p id="donation-modal-description">
                  Your support helps us keep Vidorac running and continue improving it.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="donation-modal-close"
                aria-label="Close donation panel"
                onClick={closeDonationModal}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="donation-iframe-container">
              {!isIframeLoaded ? (
                <p className="donation-loading" role="status">Loading Ko-fi...</p>
              ) : null}
              <iframe
                id="kofiframe"
                className="donation-iframe"
                src={embedUrl}
                title="Support Vidorac on Ko-fi"
                width="100%"
                height="712"
                onLoad={() => setIsIframeLoaded(true)}
              />
            </div>

            <p className="donation-fallback">
              If the panel does not load, you can{" "}
              <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                Open Ko-fi
              </a>
              .
            </p>
          </div>
        </div>
      ) : null}
    </DonationModalContext.Provider>
  );
}

export function useDonationModal() {
  const context = useContext(DonationModalContext);
  if (!context) throw new Error("useDonationModal must be used within DonationProvider");
  return context;
}
