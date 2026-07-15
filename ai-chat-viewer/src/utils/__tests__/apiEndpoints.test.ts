import * as constants from '../../constants';
import { buildDeleteHistorySessionUrl } from '../apiEndpoints';

describe('apiEndpoints', () => {
  let isProEnvSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    isProEnvSpy = jest.spyOn(constants, 'isProEnv');
  });

  afterEach(() => {
    isProEnvSpy.mockRestore();
  });

  it('builds the production delete session url', () => {
    isProEnvSpy.mockReturnValue(true);

    expect(buildDeleteHistorySessionUrl('session/1')).toBe(
      'https://www.example.com/mag/api/skill/sessions/session%2F1',
    );
  });

  it('builds the uat delete session url', () => {
    isProEnvSpy.mockReturnValue(false);

    expect(buildDeleteHistorySessionUrl('session/1')).toBe(
      'https://www.example-beta.com/mag/api/skill/sessions/session%2F1',
    );
  });
});
