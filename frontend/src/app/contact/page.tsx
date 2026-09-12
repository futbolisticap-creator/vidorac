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
      showRelatedLinks={false}
    >
      <section className="contact-form-section" aria-label="Send Vidorac a message">
        <ContactForm />
        <p className="contact-direct-email">
          Prefer to email us directly?{" "}
          <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </InformationPage>
  );
}
