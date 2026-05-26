import { buildOpenWeAgentCUIParams } from '../hwext';

describe('buildOpenWeAgentCUIParams', () => {
  it('uses from=weAgent instead of robotId for myAgent external uri', () => {
    const result = buildOpenWeAgentCUIParams('h5://external-app/index.html#weAgentCUI', 'x00_1', {
      robotId: 'robot_1',
      bizRobotTag: 'myAgent',
    });

    expect(result.weAgentUri).toContain('wecodePlace=weAgent');
    expect(result.weAgentUri).toContain('from=weAgent');
    expect(result.weAgentUri).not.toContain('robotId=');
  });

  it('keeps robotId for non-myAgent external uri', () => {
    const result = buildOpenWeAgentCUIParams('h5://external-app/index.html#weAgentCUI', 'x00_1', {
      robotId: 'robot_1',
      bizRobotTag: 'generalAgent',
    });

    expect(result.weAgentUri).toContain('wecodePlace=weAgent');
    expect(result.weAgentUri).toContain('robotId=robot_1');
    expect(result.weAgentUri).not.toContain('from=weAgent');
  });
});
