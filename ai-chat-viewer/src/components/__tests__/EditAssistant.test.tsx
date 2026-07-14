import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditAssistant from '../../pages/editAssistant';
import EditAssistantContent from '../assistant/EditAssistantContent';
import i18n from '../../i18n/config';
import type { WeAgentDetails } from '../../types/bridge';

const mockDetail: WeAgentDetails = {
  name: 'AssistantA',
  icon: '',
  desc: 'Assistant description',
  moduleId: 'module_1',
  appKey: 'app_key_1',
  appSecret: 'app_secret_1',
  partnerAccount: 'x00_1',
  createdBy: 'u1',
  creatorName: 'creator-zh',
  creatorWorkId: '10001',
  creatorW3Account: 'creator_w3',
  creatorNameEn: 'creator-en',
  ownerWelinkId: 'u2',
  ownerW3Account: 'owner_w3',
  ownerName: 'owner-zh',
  ownerNameEn: 'owner-en',
  ownerDeptName: 'dept-zh',
  ownerDeptNameEn: 'dept-en',
  id: 'robot_1',
  bizRobotId: '',
  bizRobotTag: '',
  bizRobotName: '',
  bizRobotNameEn: '',
  weCodeUrl: 'h5://123456/html/index.html',
};

function renderEditAssistant(initialEntry: {
  pathname: string;
  search?: string;
  state?: unknown;
}): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/editAssistant" element={<EditAssistant />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditAssistant', () => {
  beforeEach(async () => {
    window.localStorage.setItem('language', '2052');
    await i18n.changeLanguage('zh');
  });

  afterEach(() => {
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
    delete (window as any).Pedestal;
    window.localStorage.removeItem('language');
    jest.resetAllMocks();
  });

  it('loads details by partnerAccount and updates without notify callback', async () => {
    const getAssistantDetails = jest.fn(async () => ({
      weAgentDetailsArray: [mockDetail],
    }));
    const updateWeAgent = jest.fn(async () => ({ updateResult: 'success' }));
    const navigateBack = jest.fn();

    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getAssistantDetails,
        updateWeAgent,
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'HWH5', {
      value: {
        addEventListener: jest.fn(),
        navigateBack,
      },
      configurable: true,
      writable: true,
    });

    renderEditAssistant({
      pathname: '/editAssistant',
      search: '?partnerAccount=x00_1',
    });

    expect(await screen.findByDisplayValue('AssistantA')).toBeInTheDocument();
    expect(getAssistantDetails).toHaveBeenCalledWith({ partnerAccount: 'x00_1' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: i18n.t('createAssistant.confirm') }));

    await waitFor(() => {
      expect(updateWeAgent).toHaveBeenCalledWith({
        partnerAccount: 'x00_1',
        name: 'AssistantA',
        icon: '',
        description: 'Assistant description',
      });
      expect(navigateBack).toHaveBeenCalled();
    });
  });

  it('uses getAssistantDetails when opened from assistant detail', async () => {
    const getAssistantDetails = jest.fn(async () => ({
      weAgentDetailsArray: [mockDetail],
    }));
    const updateWeAgent = jest.fn(async () => ({ updateResult: 'success' }));
    const navigateBack = jest.fn();

    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getAssistantDetails,
        updateWeAgent,
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'HWH5', {
      value: {
        addEventListener: jest.fn(),
        navigateBack,
      },
      configurable: true,
      writable: true,
    });

    renderEditAssistant({
      pathname: '/editAssistant',
      search: '?partnerAccount=x00_1',
      state: {
        source: 'assistantDetail',
        detail: mockDetail,
      },
    });

    expect(await screen.findByDisplayValue('AssistantA')).toBeInTheDocument();
    expect(getAssistantDetails).toHaveBeenCalledWith({ partnerAccount: 'x00_1' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: i18n.t('createAssistant.confirm') }));

    await waitFor(() => {
      expect(updateWeAgent).toHaveBeenCalledWith({
        partnerAccount: 'x00_1',
        name: 'AssistantA',
        icon: '',
        description: 'Assistant description',
      });
      expect(navigateBack).toHaveBeenCalled();
    });
  });

  it('uses the create-assistant PC layout for the packaged edit route', async () => {
    const getAssistantDetails = jest.fn(async () => ({
      weAgentDetailsArray: [mockDetail],
    }));

    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getAssistantDetails,
        updateWeAgent: jest.fn(async () => ({ updateResult: 'success' })),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'HWH5', {
      value: {
        addEventListener: jest.fn(),
        close: jest.fn(),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn(async (method: string) => {
          if (method === 'method://agentSkillsDialog/getAssistantDetails') {
            return { weAgentDetailsArray: [mockDetail] };
          }
          if (method === 'method://agentSkillsDialog/updateWeAgent') {
            return { updateResult: 'success' };
          }
          return {};
        }),
      },
      configurable: true,
      writable: true,
    });

    const { container } = render(
      <EditAssistantContent
        isPcMiniApp
        source="external"
        partnerAccount="x00_1"
        onClose={jest.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('AssistantA')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('digital-twin-creator', 'is-pc');
    expect(container.firstElementChild).not.toHaveClass('digital-twin-creator--assistant-edit');
    expect(screen.getByText('修改助手信息')).toHaveClass('digital-twin__title');
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument();
  });
});
