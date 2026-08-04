export function needsOnboarding(user: { nativeLanguage: string | null; goals: string[]; interests: string[] }): boolean {
  return !user.nativeLanguage || user.goals.length === 0 || user.interests.length === 0;
}
