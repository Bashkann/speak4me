import { openApiDocument } from '../../src/openapi';

describe('OpenAPI document', () => {
  it('documents all required REST paths and Bearer authentication', () => {
    const paths = openApiDocument.paths ?? {};
    expect(paths['/api/auth/register']).toBeDefined();
    expect(paths['/api/matchmaking/queue']).toBeDefined();
    expect(paths['/api/rooms/{id}/voice-token']).toBeDefined();
    expect(paths['/api/reports']).toBeDefined();
    expect(openApiDocument.components?.securitySchemes?.bearerAuth).toBeDefined();
  });
});
