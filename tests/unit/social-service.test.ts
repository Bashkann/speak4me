import type { SocialRepository } from '../../src/repositories/social-repository';
import { SocialService } from '../../src/services/social-service';

const user = (id: string) => ({ id, handle: `user_${id}`, displayName: `User ${id}` });

class MemorySocial {
  users = new Map([['a', user('a')], ['b', user('b')], ['c', user('c')]]);
  relations: Array<any> = [];

  findUser(id: string) { return Promise.resolve(this.users.get(id) ?? null); }
  findRelation(first: string, second: string) {
    return Promise.resolve(this.relations.find((row) => [row.requesterId, row.addresseeId].includes(first)
      && [row.requesterId, row.addresseeId].includes(second)) ?? null);
  }
  listAccepted(id: string) { return Promise.resolve(this.relations.filter((row) => row.status === 'ACCEPTED' && [row.requesterId, row.addresseeId].includes(id))); }
  listPending(id: string) { return Promise.resolve(this.relations.filter((row) => row.status === 'PENDING' && [row.requesterId, row.addresseeId].includes(id))); }
  searchUsers(id: string) { return Promise.resolve([...this.users.values()].filter((candidate) => candidate.id !== id)); }
  createRequest(requesterId: string, addresseeId: string) {
    const row = {
      id: `friend-${this.relations.length + 1}`,
      requesterId,
      addresseeId,
      requester: this.users.get(requesterId)!,
      addressee: this.users.get(addresseeId)!,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.relations.push(row);
    return Promise.resolve(row);
  }
  acceptRequest(id: string, addresseeId: string) {
    const row = this.relations.find((value) => value.id === id && value.addresseeId === addresseeId && value.status === 'PENDING');
    if (row) row.status = 'ACCEPTED';
    return Promise.resolve({ count: row ? 1 : 0 });
  }
  declineRequest() { return Promise.resolve({ count: 1 }); }
  removeFriend() { return Promise.resolve({ count: 1 }); }
  blockUser(requesterId: string, addresseeId: string) {
    this.relations = this.relations.filter((row) => !([row.requesterId, row.addresseeId].includes(requesterId)
      && [row.requesterId, row.addresseeId].includes(addresseeId)));
    const row = { id: 'blocked', requesterId, addresseeId, status: 'BLOCKED' };
    this.relations.push(row);
    return Promise.resolve(row);
  }
  unblockUser(requesterId: string, addresseeId: string) {
    const before = this.relations.length;
    this.relations = this.relations.filter((row) => !(row.requesterId === requesterId && row.addresseeId === addresseeId && row.status === 'BLOCKED'));
    return Promise.resolve({ count: before - this.relations.length });
  }
}

describe('SocialService', () => {
  it('creates and accepts a friend request only for the addressee', async () => {
    const repository = new MemorySocial();
    const service = new SocialService(repository as unknown as SocialRepository);
    const request = await service.request('a', 'b');

    await expect(service.accept('a', request.id)).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    await expect(service.accept('b', request.id)).resolves.toEqual({ status: 'ACCEPTED' });
    await expect(service.friends('a')).resolves.toEqual([
      expect.objectContaining({ id: 'b', handle: 'user_b', online: false }),
    ]);
  });

  it('rejects self requests, duplicates, and any request across a block', async () => {
    const repository = new MemorySocial();
    const service = new SocialService(repository as unknown as SocialRepository);

    await expect(service.request('a', 'a')).rejects.toMatchObject({ code: 'INVALID_USER' });
    await service.request('a', 'b');
    await expect(service.request('a', 'b')).rejects.toMatchObject({ code: 'REQUEST_EXISTS' });
    await service.block('b', 'a');
    await expect(service.request('a', 'b')).rejects.toMatchObject({ code: 'SOCIAL_ACTION_BLOCKED' });
    await expect(service.request('b', 'a')).rejects.toMatchObject({ code: 'SOCIAL_ACTION_BLOCKED' });
  });

  it('only lets the blocker remove their block', async () => {
    const repository = new MemorySocial();
    const service = new SocialService(repository as unknown as SocialRepository);
    await service.block('a', 'b');

    await expect(service.unblock('b', 'a')).rejects.toMatchObject({ code: 'BLOCK_NOT_FOUND' });
    await expect(service.unblock('a', 'b')).resolves.toBeUndefined();
  });
});
