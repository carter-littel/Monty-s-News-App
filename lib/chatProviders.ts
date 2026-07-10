export const CHAT_PROVIDER_ORDER: ChatProvider[] = ["claude", "gemini", "openai"];

export function isProviderEnabled(preferences: DesktopPreferences, provider: ChatProvider): boolean {
  if (provider === "claude") return Boolean(preferences.claudeEnabled);
  if (provider === "openai") return Boolean(preferences.openaiEnabled);
  return Boolean(preferences.geminiEnabled);
}

export function enabledProviders(preferences: DesktopPreferences | null): ChatProvider[] {
  if (!preferences) return [];
  return CHAT_PROVIDER_ORDER.filter((provider) => isProviderEnabled(preferences, provider));
}
