"use client";

import { FormEvent, useRef, useState } from "react";
import { CONTACT_EMAIL, CONTACT_MAILTO, getContactFormEndpoint } from "../contact-config";

type ContactFields = {
  email: string;
  subject: string;
  message: string;
  honeypot: string;
};

type FieldErrors = Partial<Record<"email" | "subject" | "message", string>>;
type SubmitStatus = "idle" | "sending" | "success" | "error";

const initialFields: ContactFields = { email: "", subject: "", message: "", honeypot: "" };

function validateFields(fields: ContactFields): FieldErrors {
  const errors: FieldErrors = {};
  const email = fields.email.trim();
  const subject = fields.subject.trim();
  const message = fields.message.trim();

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 254) errors.email = "Email must be 254 characters or fewer.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (!subject) errors.subject = "Enter a subject.";
  else if (subject.length < 3) errors.subject = "Subject must be at least 3 characters.";
  else if (subject.length > 120) errors.subject = "Subject must be 120 characters or fewer.";

  if (!message) errors.message = "Enter a message.";
  else if (message.length < 10) errors.message = "Message must be at least 10 characters.";
  else if (message.length > 5000) errors.message = "Message must be 5,000 characters or fewer.";

  return errors;
}

export default function ContactForm() {
  const endpoint = getContactFormEndpoint();
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const submittingRef = useRef(false);

  if (!endpoint) {
    return (
      <div className="contact-form-fallback" role="status">
        <h2>Contact form is temporarily unavailable.</h2>
        <p>You can email us directly at <a className="information-email" href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
      </div>
    );
  }
  const formEndpoint = endpoint;

  function updateField(field: keyof ContactFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    if (field !== "honeypot" && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (status !== "idle" && status !== "sending") setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validateFields(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    submittingRef.current = true;
    setStatus("sending");
    try {
      const payload = new FormData();
      payload.set("email", fields.email.trim());
      payload.set("subject", fields.subject.trim());
      payload.set("message", fields.message.trim());
      payload.set("source", "Vidorac contact page");
      payload.set("_gotcha", fields.honeypot);

      const response = await fetch(formEndpoint, {
        method: "POST",
        body: payload,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Formspree returned HTTP ${response.status}`);

      setFields(initialFields);
      setErrors({});
      setStatus("success");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(error instanceof Error ? error.message : "Contact form request failed");
      }
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="contact-field">
        <label htmlFor="contact-email">Your email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          value={fields.email}
          onChange={(event) => updateField("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
          disabled={status === "sending"}
        />
        {errors.email && <p id="contact-email-error" className="contact-field-error">{errors.email}</p>}
      </div>

      <div className="contact-field">
        <label htmlFor="contact-subject">Subject</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          placeholder="What do you need help with?"
          minLength={3}
          maxLength={120}
          value={fields.subject}
          onChange={(event) => updateField("subject", event.target.value)}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          disabled={status === "sending"}
        />
        {errors.subject && <p id="contact-subject-error" className="contact-field-error">{errors.subject}</p>}
      </div>

      <div className="contact-field">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          placeholder="Describe your question, problem or feedback..."
          minLength={10}
          maxLength={5000}
          value={fields.message}
          onChange={(event) => updateField("message", event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : "contact-message-help"}
          disabled={status === "sending"}
        />
        <p id="contact-message-help" className="contact-field-help">{fields.message.length.toLocaleString()} / 5,000</p>
        {errors.message && <p id="contact-message-error" className="contact-field-error">{errors.message}</p>}
      </div>

      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="_gotcha"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fields.honeypot}
          onChange={(event) => updateField("honeypot", event.target.value)}
        />
      </div>

      <button className="contact-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : status === "error" ? "Try again" : "Send message"}
      </button>

      <div className="contact-form-status" aria-live="polite" aria-atomic="true">
        {status === "success" && (
          <div className="contact-status contact-status-success">
            <h3>Message sent successfully.</h3>
            <p>Thanks for contacting Vidorac. We&apos;ll get back to you when possible.</p>
          </div>
        )}
        {status === "error" && (
          <div className="contact-status contact-status-error">
            <h3>We couldn&apos;t send your message.</h3>
            <p>Please try again, or email us directly at <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.</p>
          </div>
        )}
      </div>
    </form>
  );
}
