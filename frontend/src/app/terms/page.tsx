import { CONTACT_EMAIL, CONTACT_MAILTO } from "../contact-config";
import InformationPage from "../information-page";
import { informationMetadata } from "../seo";

export const metadata = informationMetadata({
  title: "Terms of Use | Vidorac",
  description: "Read the terms that apply when using Vidorac to process publicly accessible media from supported platforms.",
  slug: "terms",
});

export default function TermsPage() {
  return (
    <InformationPage
      eyebrow="Legal"
      title="Terms of Use"
      intro="These terms describe the responsible use of Vidorac."
    >
      <p className="information-updated">Last updated: September 2026</p>

      <section>
        <h2>Service</h2>
        <p>Vidorac is a tool for processing publicly accessible media from supported platforms, including TikTok, Instagram, Facebook, Reddit and X.</p>
      </section>

      <section>
        <h2>Permitted use</h2>
        <p>You should only download or process content that:</p>
        <ul>
          <li>You own.</li>
          <li>You have permission to use.</li>
          <li>You are otherwise legally entitled to access and use.</li>
        </ul>
      </section>

      <section>
        <h2>Private and restricted content</h2>
        <p>Vidorac does not intentionally provide access to private content, authentication-only content or DRM-protected content. Do not use the service to attempt to bypass access controls.</p>
      </section>

      <section>
        <h2>Third-party platforms</h2>
        <p>Vidorac is independent and is not affiliated with or endorsed by TikTok, Instagram, Facebook, Reddit, X or their owners. Their trademarks belong to their respective owners, and use of each platform remains subject to its applicable terms.</p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>Availability is not guaranteed, and changes made by supported platforms may temporarily affect formats or qualities. The service may be changed, interrupted or unavailable while improvements are made.</p>
      </section>

      <section>
        <h2>Your responsibility</h2>
        <p>You are responsible for how you use downloaded or processed content and for complying with applicable law, copyright requirements and third-party terms.</p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>Vidorac is provided without guarantees of uninterrupted or error-free availability. We aim to keep the service useful and reliable, but cannot promise that every source, platform or format will always work.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>Vidorac may update the service and these Terms as the service develops. The latest revision date will be shown on this page.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these Terms can be sent to <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </InformationPage>
  );
}
