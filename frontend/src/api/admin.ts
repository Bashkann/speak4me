import { http } from '../lib/http';
import type { EnglishLevel, UserRole } from '../types/api';

export interface AdminStats { users: number; activeRooms: number; sessionsToday: number; queueLength: number }
export interface AdminUser { id: string; email: string; displayName: string; englishLevel: EnglishLevel; nativeLanguage: string | null; goals: string[]; interests: string[]; role: UserRole; suspendedAt: string | null; createdAt: string }
export interface AdminRoom { id: string; code: string; type: 'matchmade' | 'private'; status: string; currentRound: number | null; roundEndsAt: string | null; createdAt: string; participants: Array<{ userId: string; seat: number; pair: 'A' | 'B'; leftAt: string | null; user: { displayName: string; englishLevel: EnglishLevel } }> }
export interface AdminReport { id: string; reason: string; createdAt: string; resolvedAt: string | null; roomId: string; reporter: { id: string; displayName: string; email: string }; reportedUser: { id: string; displayName: string; email: string } }
export type TopicLevel = EnglishLevel | 'ALL';
export interface AdminTopic { id: string; textEn: string; level: TopicLevel; isActive: boolean }

export async function getAdminStats(): Promise<AdminStats> { return (await http.get<AdminStats>('/admin/stats')).data; }
export async function getAdminUsers(page: number, q: string): Promise<{ items: AdminUser[]; page: number; limit: number; total: number }> { return (await http.get('/admin/users', { params: { page, limit: 20, ...(q ? { q } : {}) } })).data; }
export async function updateAdminUser(id: string, input: { role?: UserRole; suspended?: boolean }): Promise<void> { await http.patch(`/admin/users/${id}`, input); }
export async function getAdminRooms(): Promise<AdminRoom[]> { return (await http.get<{ items: AdminRoom[] }>('/admin/rooms')).data.items; }
export async function closeAdminRoom(id: string): Promise<void> { await http.post(`/admin/rooms/${id}/close`); }
export async function getAdminReports(): Promise<AdminReport[]> { return (await http.get<{ items: AdminReport[] }>('/admin/reports')).data.items; }
export async function resolveAdminReport(id: string, resolved = true): Promise<void> { await http.patch(`/admin/reports/${id}`, { resolved }); }
export async function getAdminTopics(): Promise<AdminTopic[]> { return (await http.get<{ items: AdminTopic[] }>('/admin/topics')).data.items; }
export async function createAdminTopic(input: { textEn: string; level: TopicLevel }): Promise<void> { await http.post('/admin/topics', input); }
export async function updateAdminTopic(id: string, input: { textEn?: string; level?: TopicLevel; isActive?: boolean }): Promise<void> { await http.patch(`/admin/topics/${id}`, input); }
export async function deleteAdminTopic(id: string): Promise<void> { await http.delete(`/admin/topics/${id}`); }
