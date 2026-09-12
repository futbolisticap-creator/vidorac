export const CONTACT_EMAIL = "footyhub.es@gmail.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

export function getContactFormEndpoint(): string | null {
  const configuredEndpoint = process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT?.trim();
  if (!configuredEndpoint) return null;

  try {
    const endpoint = new URL(configuredEndpoint);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.hostname !== "formspree.io" ||
      !/^\/f\/[a-zA-Z0-9]+\/?$/.test(endpoint.pathname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      return null;
    }
    return endpoint.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
