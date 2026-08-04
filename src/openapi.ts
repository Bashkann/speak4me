import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './schemas/auth';
import { englishLevelSchema, errorSchema, idParamsSchema, paginationSchema } from './schemas/common';
import { updateMeSchema } from './schemas/me';
import { createRoomSchema, joinRoomSchema, reportSchema } from './schemas/rooms';
import { adminCreateTopicSchema, adminUpdateReportSchema, adminUpdateTopicSchema, adminUpdateUserSchema, adminUsersQuerySchema } from './schemas/admin';
import { conversationParamsSchema, messageHistorySchema, openConversationSchema, sendMessageSchema } from './schemas/chat';
import { friendRequestParamsSchema, friendUserParamsSchema, userSearchSchema, userTargetSchema } from './schemas/social';
import { signUploadSchema } from './schemas/uploads';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
registry.register('Error', errorSchema);
registry.register('EnglishLevel', englishLevelSchema);

const json = (schema: z.ZodTypeAny, description = 'Successful response') => ({
  description,
  content: { 'application/json': { schema } },
});
const errors = {
  400: json(errorSchema, 'Invalid request'),
  401: json(errorSchema, 'Authentication required'),
  403: json(errorSchema, 'Forbidden'),
  409: json(errorSchema, 'Conflict'),
};
const security = [{ bearerAuth: [] }];
const tokensSchema = z.object({ accessToken: z.string(), refreshToken: z.string() });

registry.registerPath({
  method: 'post', path: '/api/auth/register', tags: ['Auth'], summary: 'Register a user',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: { 201: json(tokensSchema.extend({ user: z.object({ id: z.string().uuid(), email: z.string().email(), handle: z.string(), displayName: z.string(), englishLevel: englishLevelSchema }) })), ...errors },
});
registry.registerPath({
  method: 'post', path: '/api/auth/login', tags: ['Auth'], summary: 'Log in',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: { 200: json(tokensSchema), ...errors },
});
registry.registerPath({
  method: 'post', path: '/api/auth/refresh', tags: ['Auth'], summary: 'Rotate a refresh token',
  request: { body: { content: { 'application/json': { schema: refreshSchema } } } },
  responses: { 200: json(tokensSchema), ...errors },
});
registry.registerPath({
  method: 'post', path: '/api/auth/logout', tags: ['Auth'], summary: 'Revoke a refresh token',
  request: { body: { content: { 'application/json': { schema: logoutSchema } } } },
  responses: { 204: { description: 'Logged out' }, ...errors },
});
registry.registerPath({
  method: 'get', path: '/api/auth/providers', tags: ['Auth'], summary: 'Check which social sign-in providers are configured',
  responses: { 200: json(z.object({ google: z.boolean() })) },
});
registry.registerPath({
  method: 'get', path: '/api/auth/google', tags: ['Auth'], summary: 'Start Google sign-in',
  responses: { 302: { description: 'Redirect to Google' }, 404: json(errorSchema, 'Google sign-in is not configured') },
});
registry.registerPath({
  method: 'get', path: '/api/auth/google/callback', tags: ['Auth'], summary: 'Google sign-in callback',
  request: { query: z.object({ code: z.string().optional(), state: z.string().optional() }) },
  responses: { 302: { description: 'Redirect to the frontend with tokens or an error' } },
});

const userSchema = z.object({
  id: z.string().uuid(), email: z.string().email(), handle: z.string(), displayName: z.string(), englishLevel: englishLevelSchema,
  nativeLanguage: z.string().nullable(), goals: z.array(z.string()), interests: z.array(z.string()), role: z.enum(['USER', 'ADMIN']), createdAt: z.string().datetime(),
  avatarUrl: z.string().nullable(), needsOnboarding: z.boolean(),
});
registry.registerPath({ method: 'get', path: '/api/me', tags: ['Me'], security, responses: { 200: json(userSchema), ...errors } });
registry.registerPath({
  method: 'patch', path: '/api/me', tags: ['Me'], security,
  request: { body: { content: { 'application/json': { schema: updateMeSchema } } } },
  responses: { 200: json(userSchema), ...errors },
});
registry.registerPath({
  method: 'get', path: '/api/me/sessions', tags: ['Me'], security,
  request: { query: paginationSchema },
  responses: { 200: json(z.object({ items: z.array(z.unknown()), page: z.number(), limit: z.number(), total: z.number() })), ...errors },
});
registry.registerPath({
  method: 'get', path: '/api/me/stats', tags: ['Me'], security,
  responses: { 200: json(z.object({ sessionsCompleted: z.number().int(), totalPracticeMinutes: z.number().int(), lastSessionDate: z.string().datetime().nullable() })), ...errors },
});
registry.registerPath({
  method: 'get', path: '/api/topics', tags: ['Topics'], security,
  request: { query: z.object({ level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ALL']).optional() }) },
  responses: { 200: json(z.object({ items: z.array(z.object({ id: z.string().uuid(), textEn: z.string(), level: z.string() })) })), ...errors },
});

for (const route of [
  { method: 'post' as const, path: '/api/matchmaking/queue', summary: 'Join queue', status: 201 },
  { method: 'delete' as const, path: '/api/matchmaking/queue', summary: 'Leave queue', status: 204 },
  { method: 'get' as const, path: '/api/matchmaking/status', summary: 'Get queue status', status: 200 },
]) {
  registry.registerPath({
    method: route.method, path: route.path, tags: ['Matchmaking'], security, summary: route.summary,
    responses: { [route.status]: route.status === 204 ? { description: 'No content' } : json(z.object({ state: z.enum(['idle', 'queued', 'matched']), roomId: z.string().uuid().optional() })), ...errors },
  });
}

const participantSchema = z.object({
  userId: z.string().uuid(), handle: z.string(), displayName: z.string(), englishLevel: englishLevelSchema, seat: z.number().int(), pair: z.enum(['A', 'B']), connected: z.boolean(),
});
const topicOfferSchema = z.object({ id: z.string().uuid(), textEn: z.string() });
const activeRoundSchema = z.object({
  roundNo: z.union([z.literal(1), z.literal(2)]), speakerUserId: z.string().uuid(), listenerUserId: z.string().uuid(),
  topic: topicOfferSchema.nullable(), endsAt: z.string().datetime(), swapsRemaining: z.number().int().nonnegative(),
  topicLocked: z.boolean(), canContinuePrevious: z.boolean(), previousTopic: topicOfferSchema.nullable(), continuedPrevious: z.boolean(),
});
const roomSchema = z.object({
  id: z.string().uuid(), code: z.string().length(6), type: z.enum(['matchmade', 'private']),
  status: z.enum(['waiting', 'ready', 'round1', 'break', 'round2', 'finished', 'aborted']),
  roundDurationSec: z.number().int(), capacity: z.literal(2), currentRound: z.number().int().nullable(), roundEndsAt: z.string().datetime().nullable(),
  currentTopic: z.string().nullable(), activeRound: activeRoundSchema.nullable(), participants: z.array(participantSchema),
});
registry.registerPath({
  method: 'post', path: '/api/rooms', tags: ['Rooms'], security, summary: 'Create a private room',
  request: { body: { content: { 'application/json': { schema: createRoomSchema } } } }, responses: { 201: json(roomSchema), ...errors },
});

registry.registerPath({ method: 'get', path: '/api/admin/stats', tags: ['Admin'], security, responses: { 200: json(z.object({ users: z.number(), activeRooms: z.number(), sessionsToday: z.number(), queueLength: z.number() })), ...errors } });
registry.registerPath({ method: 'get', path: '/api/admin/users', tags: ['Admin'], security, request: { query: adminUsersQuerySchema }, responses: { 200: json(z.object({ items: z.array(userSchema.extend({ suspendedAt: z.string().datetime().nullable() })), page: z.number(), limit: z.number(), total: z.number() })), ...errors } });
registry.registerPath({ method: 'patch', path: '/api/admin/users/{id}', tags: ['Admin'], security, request: { params: idParamsSchema, body: { content: { 'application/json': { schema: adminUpdateUserSchema } } } }, responses: { 200: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'get', path: '/api/admin/rooms', tags: ['Admin'], security, responses: { 200: json(z.object({ items: z.array(z.unknown()) })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/admin/rooms/{id}/close', tags: ['Admin'], security, request: { params: idParamsSchema }, responses: { 200: json(z.object({ closed: z.boolean() })), ...errors } });
registry.registerPath({ method: 'get', path: '/api/admin/reports', tags: ['Admin'], security, responses: { 200: json(z.object({ items: z.array(z.unknown()) })), ...errors } });
registry.registerPath({ method: 'patch', path: '/api/admin/reports/{id}', tags: ['Admin'], security, request: { params: idParamsSchema, body: { content: { 'application/json': { schema: adminUpdateReportSchema } } } }, responses: { 200: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'get', path: '/api/admin/topics', tags: ['Admin'], security, responses: { 200: json(z.object({ items: z.array(z.unknown()) })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/admin/topics', tags: ['Admin'], security, request: { body: { content: { 'application/json': { schema: adminCreateTopicSchema } } } }, responses: { 201: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'patch', path: '/api/admin/topics/{id}', tags: ['Admin'], security, request: { params: idParamsSchema, body: { content: { 'application/json': { schema: adminUpdateTopicSchema } } } }, responses: { 200: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'delete', path: '/api/admin/topics/{id}', tags: ['Admin'], security, request: { params: idParamsSchema }, responses: { 204: { description: 'Topic archived' }, ...errors } });
registry.registerPath({
  method: 'post', path: '/api/rooms/join', tags: ['Rooms'], security, summary: 'Join a private room',
  request: { body: { content: { 'application/json': { schema: joinRoomSchema } } } }, responses: { 200: json(roomSchema), ...errors },
});
registry.registerPath({ method: 'get', path: '/api/rooms/{id}', tags: ['Rooms'], security, request: { params: idParamsSchema }, responses: { 200: json(roomSchema), ...errors, 404: json(errorSchema, 'Not found') } });
registry.registerPath({ method: 'post', path: '/api/rooms/{id}/leave', tags: ['Rooms'], security, request: { params: idParamsSchema }, responses: { 204: { description: 'Left room' }, ...errors } });
registry.registerPath({ method: 'post', path: '/api/rooms/{id}/voice-token', tags: ['Voice'], security, request: { params: idParamsSchema }, responses: { 200: json(z.object({ token: z.string(), url: z.string().url(), canPublish: z.boolean() })), ...errors } });

const publicProfileSchema = z.object({ id: z.string().uuid(), handle: z.string(), displayName: z.string() });
const messageSchema = z.object({
  id: z.string().uuid(), conversationId: z.string().uuid(), senderId: z.string().uuid(), body: z.string(),
  imageUrl: z.string().url().nullable(), createdAt: z.string().datetime(), readAt: z.string().datetime().nullable(),
});
registry.registerPath({ method: 'get', path: '/api/friends', tags: ['Friends'], security, responses: { 200: json(z.array(publicProfileSchema.extend({ friendshipId: z.string().uuid(), online: z.boolean() }))), ...errors } });
registry.registerPath({ method: 'get', path: '/api/friends/requests', tags: ['Friends'], security, responses: { 200: json(z.object({ incoming: z.array(z.unknown()), outgoing: z.array(z.unknown()) })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/friends/request', tags: ['Friends'], security, request: { body: { content: { 'application/json': { schema: userTargetSchema } } } }, responses: { 201: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'post', path: '/api/friends/requests/{id}/accept', tags: ['Friends'], security, request: { params: friendRequestParamsSchema }, responses: { 200: json(z.object({ status: z.literal('ACCEPTED') })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/friends/requests/{id}/decline', tags: ['Friends'], security, request: { params: friendRequestParamsSchema }, responses: { 204: { description: 'Request declined' }, ...errors } });
registry.registerPath({ method: 'delete', path: '/api/friends/{userId}', tags: ['Friends'], security, request: { params: friendUserParamsSchema }, responses: { 204: { description: 'Friend removed' }, ...errors } });
registry.registerPath({ method: 'post', path: '/api/friends/block', tags: ['Friends'], security, request: { body: { content: { 'application/json': { schema: userTargetSchema } } } }, responses: { 200: json(z.object({ status: z.literal('BLOCKED') })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/friends/unblock', tags: ['Friends'], security, request: { body: { content: { 'application/json': { schema: userTargetSchema } } } }, responses: { 204: { description: 'Block removed' }, ...errors } });
registry.registerPath({ method: 'get', path: '/api/users/search', tags: ['Friends'], security, request: { query: userSearchSchema }, responses: { 200: json(z.array(publicProfileSchema.extend({ relationship: z.enum(['NONE', 'FRIEND', 'OUTGOING', 'INCOMING', 'BLOCKED']) }))), ...errors } });

registry.registerPath({ method: 'get', path: '/api/conversations', tags: ['Chat'], security, responses: { 200: json(z.array(z.object({ id: z.string().uuid(), partner: publicProfileSchema, lastMessage: messageSchema.nullable(), unreadCount: z.number().int(), updatedAt: z.string().datetime() }))), ...errors } });
registry.registerPath({ method: 'post', path: '/api/conversations', tags: ['Chat'], security, request: { body: { content: { 'application/json': { schema: openConversationSchema } } } }, responses: { 201: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'get', path: '/api/conversations/{id}/messages', tags: ['Chat'], security, request: { params: conversationParamsSchema, query: messageHistorySchema }, responses: { 200: json(z.object({ items: z.array(messageSchema), nextBefore: z.string().datetime().nullable() })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/conversations/{id}/messages', tags: ['Chat'], security, request: { params: conversationParamsSchema, body: { content: { 'application/json': { schema: sendMessageSchema } } } }, responses: { 201: json(messageSchema), ...errors } });
registry.registerPath({ method: 'post', path: '/api/conversations/{id}/read', tags: ['Chat'], security, request: { params: conversationParamsSchema }, responses: { 200: json(z.unknown()), ...errors } });
registry.registerPath({ method: 'get', path: '/api/uploads/config', tags: ['Chat'], security, responses: { 200: json(z.object({ enabled: z.boolean(), maxBytes: z.number().int(), contentTypes: z.array(z.string()) })), ...errors } });
registry.registerPath({ method: 'post', path: '/api/uploads/sign', tags: ['Chat'], security, request: { body: { content: { 'application/json': { schema: signUploadSchema } } } }, responses: { 201: json(z.object({ uploadId: z.string().uuid(), uploadUrl: z.string().url(), publicUrl: z.string().url(), expiresAt: z.string().datetime(), headers: z.record(z.string()) })), ...errors } });
registry.registerPath({
  method: 'post', path: '/api/reports', tags: ['Reports'], security,
  request: { body: { content: { 'application/json': { schema: reportSchema } } } },
  responses: { 201: json(z.object({ id: z.string().uuid(), createdAt: z.string().datetime() })), ...errors },
});
registry.registerPath({ method: 'get', path: '/healthz', tags: ['System'], responses: { 200: json(z.object({ status: z.literal('ok') })) } });

export const openApiDocument = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: '3.0.3',
  info: { title: 'English Speaking Rooms API', version: '2.0.0', description: 'REST and Socket.IO backend that splits four matched learners into independent two-person speaking sessions.' },
  servers: [{ url: '/' }],
});
