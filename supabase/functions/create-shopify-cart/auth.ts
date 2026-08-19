export function getAcceptedPublicKeys(
  legacyAnonKey: string | undefined,
  publishableKeysJson: string | undefined,
): Set<string> {
  const acceptedKeys = new Set<string>();
  if (legacyAnonKey) acceptedKeys.add(legacyAnonKey);

  if (publishableKeysJson) {
    const parsedKeys = JSON.parse(publishableKeysJson) as Record<string, unknown>;
    Object.values(parsedKeys).forEach((key) => {
      if (typeof key === 'string' && key) acceptedKeys.add(key);
    });
  }

  return acceptedKeys;
}

function getNamedKeys(keysJson: string | undefined): Record<string, string> {
  if (!keysJson) return {};
  try {
    const parsedKeys = JSON.parse(keysJson) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedKeys).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function getPreferredPublicKey(
  legacyAnonKey: string | undefined,
  publishableKeysJson: string | undefined,
): string | undefined {
  const namedKeys = getNamedKeys(publishableKeysJson);
  return namedKeys.default || Object.values(namedKeys)[0] || legacyAnonKey;
}

export function getPreferredSecretKey(
  legacyServiceRoleKey: string | undefined,
  secretKeysJson: string | undefined,
): string | undefined {
  const namedKeys = getNamedKeys(secretKeysJson);
  return namedKeys.default || Object.values(namedKeys)[0] || legacyServiceRoleKey;
}

export function getBearerToken(authorization: string | null): string | undefined {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

export function hasAcceptedPublicKey(
  apiKey: string | null,
  legacyAnonKey: string | undefined,
  publishableKeysJson: string | undefined,
): boolean {
  if (!apiKey) return false;

  try {
    return getAcceptedPublicKeys(legacyAnonKey, publishableKeysJson).has(apiKey);
  } catch {
    return false;
  }
}

export const isCheckoutReleaseEnabled = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === 'true';
