import { CONTACT_EMAIL, CONTACT_MAILTO } from "../contact-config";
import InformationPage from "../information-page";
import { informationMetadata } from "../seo";

export const metadata = informationMetadata({
  title: "Privacy Policy | Vidorac",
  description: "Learn what information Vidorac may process, how temporary media is handled and which third-party services help operate the public beta.",
  slug: "privacy",
});

export default function PrivacyPage() {
  return (
    <InformationPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains how Vidorac currently handles information when you use the public beta."
    >
      <p className="information-updated">Last updated: September 2026</p>

      <section>
        <h2>Information Vidorac may process</h2>
        <p>When you use Vidorac, the service may process:</p>
        <ul>
          <li>The public media URL you submit.</li>
          <li>Technical data needed to receive and complete your request.</li>
          <li>Basic network and server information that may appear in technical logs, such as an IP address, user agent, timestamp and error details.</li>
        </ul>
      </section>

      <section>
        <h2>Contact form</h2>
        <p>When you submit the contact form, Vidorac processes the information you provide, such as your email address, subject and message, for the purpose of responding to your enquiry. The form is processed using Formspree, a third-party form provider. Formspree handles submitted information according to its own policies.</p>
      </section>

      <section>
        <h2>No user accounts</h2>
        <p>Vidorac currently does not require registration, user accounts or passwords.</p>
      </section>

      <section>
        <h2>Temporary media and downloads</h2>
        <p>Files prepared by the backend are temporary and are generated only to complete a requested download or media operation. They are removed after delivery when applicable, after failed processing, or by automatic cleanup. Prepared download identifiers currently expire after approximately 15 minutes.</p>
      </section>

      <section>
        <h2>Donations</h2>
        <p>The donation interface is provided by Ko-fi and its payment providers. When you open or use the donation panel, those services may process information according to their own privacy policies. Vidorac does not directly process payment card information or payment credentials.</p>
        <a className="information-inline-link" href="https://ko-fi.com/vidorac" target="_blank" rel="noopener noreferrer">Visit Vidorac on Ko-fi</a>
      </section>

      <section>
        <h2>Third-party infrastructure</h2>
        <p>Vidorac uses third-party services to operate, including Cloudflare Pages for the website, Render for backend infrastructure, and Ko-fi and its payment providers for optional donations. These providers may process technical data according to their own policies.</p>
      </section>

      <section>
        <h2>External platforms</h2>
        <p>Vidorac processes public TikTok URLs to analyze available videos, photo slideshows and audio. Vidorac is not affiliated with TikTok or ByteDance, and their own terms and privacy policies continue to apply.</p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Vidorac itself currently does not require account or login cookies, and its application code does not set cookies for user accounts or download histories. Infrastructure or external services may use their own cookies or similar technologies according to their policies.</p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>Media files are temporary, and Vidorac does not intentionally build permanent histories of user downloads. Technical logs may be retained by infrastructure providers according to their operational needs and policies.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For privacy questions, email <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
      </section>

      <section>
        <h2>Updates</h2>
        <p>This policy may be updated as Vidorac evolves. The date at the top of this page will indicate the latest revision.</p>
      </section>
    </InformationPage>
  );
}
