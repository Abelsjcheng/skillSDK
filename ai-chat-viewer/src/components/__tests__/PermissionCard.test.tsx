import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionCard } from '../PermissionCard';
import type { MessagePart } from '../../types';
import { replyPermission } from '../../utils/hwext';

jest.mock('../../utils/hwext', () => {
  const actual = jest.requireActual('../../utils/hwext');
  return {
    ...actual,
    replyPermission: jest.fn(),
  };
});

function createPermissionPart(): MessagePart {
  return {
    partId: 'permission-part-1',
    type: 'permission',
    content: 'Need permission to write a markdown file',
    isStreaming: false,
    permissionId: 'perm-1',
    permType: 'file_write',
    toolName: 'write_file',
  };
}

describe('PermissionCard', () => {
  it('keeps the card visible after allowing permission', async () => {
    const replyPermissionMock = replyPermission as jest.MockedFunction<typeof replyPermission>;
    replyPermissionMock.mockResolvedValue({
      welinkSessionId: 'session-1',
      permissionId: 'perm-1',
      response: 'once',
    });

    const user = userEvent.setup();
    const { container } = render(
      <PermissionCard
        part={createPermissionPart()}
        welinkSessionId="session-1"
      />,
    );

    const allowButton = container.querySelector('.permission-card__btn--allow');
    expect(allowButton).toBeInTheDocument();

    await user.click(allowButton as HTMLButtonElement);

    await waitFor(() => {
      expect(replyPermissionMock).toHaveBeenCalledWith({
        welinkSessionId: 'session-1',
        permId: 'perm-1',
        response: 'once',
      });
    });

    expect(container.querySelector('.permission-card')).toBeInTheDocument();
    expect(container.querySelector('.permission-card__result')).toBeInTheDocument();
    expect(container.querySelector('.permission-card__actions')).not.toBeInTheDocument();
    expect(container.querySelector('.permission-card__result-label')?.textContent).toBe('已确认');
    expect(container.querySelector('.permission-card .permission-card__actions')).not.toBeInTheDocument();
  });
});
