import type { UploadRepository } from '../../src/repositories/upload-repository';
import { UploadService } from '../../src/services/upload-service';
import { testConfig } from '../helpers';

describe('UploadService feature gate', () => {
  it('stays disabled and does not create grants without storage configuration', async () => {
    const repository = { create: jest.fn() };
    const service = new UploadService(repository as unknown as UploadRepository, testConfig);

    expect(service.featureConfig()).toEqual({
      enabled: false,
      maxBytes: 5 * 1024 * 1024,
      contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    await expect(service.sign('user-1', { contentType: 'image/png', sizeBytes: 1024 }))
      .rejects.toMatchObject({ code: 'IMAGE_UPLOADS_DISABLED' });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
