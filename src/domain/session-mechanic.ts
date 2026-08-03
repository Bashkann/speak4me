export function swapsRemaining(topicSwapCount: number, topicOfferCap: number): number {
  return Math.max(0, topicOfferCap - 1 - topicSwapCount);
}

export function topicOfferLocked(topicSwapCount: number, topicOfferCap: number): boolean {
  return swapsRemaining(topicSwapCount, topicOfferCap) === 0;
}

export function swapRoles<T extends string>(speakerUserId: T, listenerUserId: T) {
  return { nextSpeakerUserId: listenerUserId, nextListenerUserId: speakerUserId };
}
