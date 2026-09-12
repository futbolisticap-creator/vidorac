import InformationPage, { CONTACT_EMAIL, CONTACT_MAILTO } from "../information-page";
import { informationMetadata } from "../seo";

export const metadata = informationMetadata({
  title: "Contact Vidorac | Vidorac Beta",
  description: "Contact Vidorac with questions, feedback, bug reports, copyright concerns or general enquiries.",
  slug: "contact",
});

export default function ContactPage() {
  return (
    <InformationPage
      eyebrow="Contact"
      title="Contact Vidorac"
      intro="Need to get in touch with Vidorac? For questions, feedback, bug reports, copyright concerns or general enquiries, you can contact us by email."
    >
      <section>
        <h2>Email</h2>
        <p>Write to us at <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
        <a className="information-button" href={CONTACT_MAILTO} aria-label={`Email Vidorac at ${CONTACT_EMAIL}`}>Email Vidorac</a>
      </section>

      <section>
        <h2>Feedback</h2>
        <p>Have an idea or found something that could be improved? We&apos;re building Vidorac in public beta and would love to hear what you think.</p>
        <a className="information-button information-button-secondary" href={`${CONTACT_MAILTO}?subject=Vidorac%20feedback`}>Send feedback</a>
      </section>

      <section>
        <h2>Copyright &amp; removal requests</h2>
        <p>If you believe content accessible through Vidorac infringes your rights or should not be processed by the service, contact us at <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
        <p>Please include:</p>
        <ul>
          <li>The URL involved.</li>
          <li>A description of the issue.</li>
          <li>Proof or an explanation of your rights when applicable.</li>
          <li>Your preferred contact information.</li>
        </ul>
      </section>
    </InformationPage>
  );
}
