function normalizeApiBaseUrl(value: string | undefined): string {
  const configuredValue = value?.trim();
  if (!configuredValue) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required.");
  }

  try {
    const parsed = new URL(configuredValue);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) origin.");
    }
    return configuredValue.replace(/\/+$/, "");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_PUBLIC_")) {
      throw error;
    }
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid URL.");
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
);
