import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import PersonalAssistantCreator from '../PersonalAssistantCreator';

const TEXT = {
  nameLabel: '\u540d\u79f0',
  descLabel: '\u7b80\u4ecb',
  next: '\u4e0b\u4e00\u6b65',
  prev: '\u4e0a\u4e00\u6b65',
  closeCreate: '\u5173\u95ed\u521b\u5efa\u4e2a\u4eba\u52a9\u7406',
  cancel: '\u53d6\u6d88',
  customAssistant: '\u81ea\u5b9a\u4e49\u52a9\u624b',
  confirm: '\u786e\u5b9a',
  chooseDefaultAvatar2: '\u9009\u62e9\u9ed8\u8ba4\u5934\u50cf avatar-2',
};

describe('PersonalAssistantCreator', () => {
  const callMethodMock = jest.fn();
  const closeMock = jest.fn();

  beforeEach(() => {
    callMethodMock.mockReset();
    closeMock.mockReset();

    callMethodMock.mockImplementation((_method: string, payload: { funName: string; params: any }) => {
      if (payload.funName === 'getAgentType') {
        return {
          content: [
            { name: 'assistant-writing', icon: 'https://example.com/a.png', bizRobotId: '8041241' },
            { name: 'assistant-meeting', icon: 'https://example.com/b.png', bizRobotId: '8041242' },
          ],
        };
      }

      if (payload.funName === 'createDigitalTwin') {
        return {
          robotId: 'r1',
          partnerAccount: 'x00_1',
          message: 'success',
        };
      }

      if (payload.funName === 'getWeAgentDetails') {
        return {
          weAgentDetailsArray: [
            {
              name: 'assistant-writing',
              icon: 'https://example.com/a.png',
              desc: 'detail',
              moduleId: 'M1',
              appKey: 'app-key',
              appSecret: 'app-secret',
              partnerAccount: 'x00_1',
              createdBy: 'u1',
              creatorName: 'creator',
              creatorNameEn: 'creator',
              ownerWelinkId: 'u2',
              ownerName: 'owner',
              ownerNameEn: 'owner',
              ownerDeptName: 'dept',
              ownerDeptNameEn: 'dept',
              bizRobotId: '8041241',
              weCodeUrl: 'h5://123456/html/index.html',
            },
          ],
        };
      }

      if (payload.funName === 'openWeAgentCUI') {
        return { status: 'success' };
      }

      return undefined;
    });

    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: callMethodMock,
        remote: {
          getCurrentWindow: () => ({
            close: closeMock,
          }),
        },
      },
      configurable: true,
      writable: true,
    });

    window.location.hash = '/createAssistant';
  });

  afterEach(() => {
    delete (window as any).Pedestal;
    window.location.hash = '';
  });

  it('switches to step2 after filling required fields and clicking next', async () => {
    render(<PersonalAssistantCreator />);

    fireEvent.change(screen.getByLabelText(TEXT.nameLabel), { target: { value: 'assistanta' } });
    fireEvent.change(screen.getByLabelText(TEXT.descLabel), { target: { value: 'desca' } });

    fireEvent.click(screen.getByRole('button', { name: TEXT.next }));
    expect(await screen.findByRole('button', { name: TEXT.prev })).toBeInTheDocument();
  });

  it('goes back to step1 when clicking previous button on step2', async () => {
    render(<PersonalAssistantCreator />);

    fireEvent.click(screen.getByRole('listitem', { name: TEXT.chooseDefaultAvatar2 }));
    fireEvent.change(screen.getByLabelText(TEXT.nameLabel), { target: { value: 'assistantb' } });
    fireEvent.change(screen.getByLabelText(TEXT.descLabel), { target: { value: 'descb' } });
    fireEvent.click(screen.getByRole('button', { name: TEXT.next }));
    fireEvent.click(await screen.findByRole('button', { name: TEXT.prev }));

    expect(screen.getByLabelText(TEXT.nameLabel)).toHaveValue('assistantb');
    expect(screen.getByLabelText(TEXT.descLabel)).toHaveValue('descb');
    expect(screen.getByRole('listitem', { name: TEXT.chooseDefaultAvatar2 })).toHaveClass('is-selected');
  });

  it('calls Pedestal close when clicking close and cancel', () => {
    render(<PersonalAssistantCreator />);

    fireEvent.click(screen.getByRole('button', { name: TEXT.closeCreate }));
    fireEvent.click(screen.getByRole('button', { name: TEXT.cancel }));

    expect(closeMock).toHaveBeenCalledTimes(2);
  });

  it('calls createDigitalTwin with custom payload when clicking confirm', async () => {
    render(<PersonalAssistantCreator />);

    fireEvent.change(screen.getByLabelText(TEXT.nameLabel), { target: { value: 'assistantc' } });
    fireEvent.change(screen.getByLabelText(TEXT.descLabel), { target: { value: 'descc' } });
    fireEvent.click(screen.getByRole('button', { name: TEXT.next }));
    fireEvent.click(await screen.findByLabelText(TEXT.customAssistant));
    fireEvent.click(screen.getByRole('button', { name: TEXT.confirm }));

    await waitFor(() => {
      const createCall = callMethodMock.mock.calls.find((call) => call[1]?.funName === 'createDigitalTwin');
      expect(createCall).toBeTruthy();
      expect(createCall[1].params).toEqual({
        name: 'assistantc',
        icon: expect.any(String),
        description: 'descc',
        weCrewType: 0,
      });
    });
  });

  it('calls Pedestal owner bridge when from is not weAgent', async () => {
    render(<PersonalAssistantCreator />);

    fireEvent.change(screen.getByLabelText(TEXT.nameLabel), { target: { value: 'assistante' } });
    fireEvent.change(screen.getByLabelText(TEXT.descLabel), { target: { value: 'desce' } });
    fireEvent.click(screen.getByRole('button', { name: TEXT.next }));
    fireEvent.click(await screen.findByLabelText(TEXT.customAssistant));
    fireEvent.click(screen.getByRole('button', { name: TEXT.confirm }));

    await waitFor(() => {
      const ownerCall = callMethodMock.mock.calls.find((call) => call[1]?.owner === 'x00_1');
      expect(ownerCall).toBeTruthy();
      expect(ownerCall?.[0]).toBe('method://agentSkills/handleSdk');
      expect(ownerCall?.[1]).toEqual({ owner: 'x00_1' });
    });
  });

  it('calls createDigitalTwin with internal payload and bizRobotId', async () => {
    render(<PersonalAssistantCreator />);

    fireEvent.change(screen.getByLabelText(TEXT.nameLabel), { target: { value: 'assistantd' } });
    fireEvent.change(screen.getByLabelText(TEXT.descLabel), { target: { value: 'descd' } });
    fireEvent.click(screen.getByRole('button', { name: TEXT.next }));

    const assistantButton = await screen.findByRole('button', { name: 'assistant-writing' });
    fireEvent.click(assistantButton);
    fireEvent.click(screen.getByRole('button', { name: TEXT.confirm }));

    await waitFor(() => {
      const createCall = callMethodMock.mock.calls.find((call) => call[1]?.funName === 'createDigitalTwin');
      expect(createCall).toBeTruthy();
      expect(createCall[1].params).toEqual({
        name: 'assistantd',
        icon: expect.any(String),
        description: 'descd',
        weCrewType: 1,
        bizRobotId: '8041241',
      });
    });
  });

  it('is not exported from lib entry and has standalone page entry', () => {
    const libFilePath = path.resolve(__dirname, '../../lib/index.ts');
    const libSource = fs.readFileSync(libFilePath, 'utf8');
    expect(libSource).not.toContain('export { PersonalAssistantCreator };');

    const pageEntryPath = path.resolve(__dirname, '../../pages/createAssistant.tsx');
    expect(fs.existsSync(pageEntryPath)).toBe(true);
  });
});
