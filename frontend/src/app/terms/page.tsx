import InformationPage, { CONTACT_EMAIL, CONTACT_MAILTO } from "../information-page";
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
      intro="These terms describe the responsible use of Vidorac during its public beta."
    >
      <p className="information-updated">Last updated: September 2026</p>

      <section>
        <h2>Service</h2>
        <p>Vidorac is a public beta tool for processing publicly accessible media from supported platforms.</p>
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
        <p>Vidorac is not affiliated with YouTube, TikTok, Instagram, X, Reddit or Facebook. Their trademarks belong to their respective owners, and use of those platforms remains subject to their applicable terms.</p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>Vidorac is currently a beta service. Availability is not guaranteed, and platform changes may temporarily affect supported sites, formats or qualities. The service may be changed, interrupted or unavailable while improvements are made.</p>
      </section>

      <section>
        <h2>Your responsibility</h2>
        <p>You are responsible for how you use downloaded or processed content and for complying with applicable law, copyright requirements and third-party terms.</p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>Vidorac is provided as a public beta without guarantees of uninterrupted or error-free availability. We aim to keep the service useful and reliable, but cannot promise that every source, platform or format will always work.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>Vidorac may update the service and these Terms as the beta develops. The latest revision date will be shown on this page.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these Terms can be sent to <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </InformationPage>
  );
}
