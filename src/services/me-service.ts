import type { EnglishLevel, User } from '@prisma/client';
import { needsOnboarding } from '../domain/onboarding';
import { AppError } from '../lib/errors';
import { UserRepository } from '../repositories/user-repository';

export class MeService {
  constructor(private readonly users: UserRepository) {}

  async get(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return this.publicUser(user);
  }

  async update(userId: string, data: { displayName?: string; englishLevel?: EnglishLevel; nativeLanguage?: string | null; goals?: string[]; interests?: string[] }) {
    const user = await this.users.updateProfile(userId, data);
    return this.publicUser(user);
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      englishLevel: user.englishLevel,
      nativeLanguage: user.nativeLanguage,
      goals: user.goals,
      interests: user.interests,
      role: user.role,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
      needsOnboarding: needsOnboarding(user),
    };
  }

  stats(userId: string) {
    return this.users.stats(userId);
  }

  async sessions(userId: string, page: number, limit: number) {
    const { rooms, total } = await this.users.finishedSessions(userId, page, limit);
    return {
      items: rooms.map((room) => ({
        roomId: room.id,
        date: room.finishedAt,
        durationSec: room.roundDurationSec * 2,
        topics: room.rounds.length
          ? room.rounds.map((round) => round.topic?.textEn).filter(Boolean)
          : [room.topicRound1?.textEn, room.topicRound2?.textEn].filter(Boolean),
        partners: room.participants
          .filter((participant) => participant.userId !== userId)
          .map((participant) => ({
            id: participant.user.id,
            handle: participant.user.handle,
            displayName: participant.user.displayName,
          })),
      })),
      page,
      limit,
      total,
    };
  }
}
