import { CONTACT_EMAIL, CONTACT_MAILTO } from "../contact-config";
import InformationPage from "../information-page";
import { informationMetadata } from "../seo";
import ContactForm from "./contact-form";

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
      intro="Have a question, found a bug or want to send feedback? Send us a message below."
    >
      <section className="contact-form-section" aria-label="Send Vidorac a message">
        <ContactForm />
      </section>

      <section>
        <h2>Prefer email?</h2>
        <p>You can also contact us directly at <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
        <a className="information-button information-button-secondary" href={CONTACT_MAILTO} aria-label={`Email Vidorac at ${CONTACT_EMAIL}`}>Email Vidorac</a>
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
        <a className="information-button information-button-secondary" href={`${CONTACT_MAILTO}?subject=Copyright%20or%20removal%20request`}>Email about copyright</a>
      </section>
    </InformationPage>
  );
}
