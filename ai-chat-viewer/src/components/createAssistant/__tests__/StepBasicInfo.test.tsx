import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StepBasicInfo } from '../StepBasicInfo';
import { DEFAULT_AVATARS } from '../constants';
import { showToast } from '../../../utils/toast';

jest.mock('../../../utils/toast', () => ({
  showToast: jest.fn(),
}));

const Noop = () => {};
const mockedShowToast = showToast as jest.MockedFunction<typeof showToast>;

describe('StepBasicInfo', () => {
  beforeEach(() => {
    mockedShowToast.mockClear();
  });

  it('disables next button when required fields are empty and enables after filling', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={Noop}
        onCancel={Noop}
        onNext={Noop}
      />,
    );

    const nextButton = screen.getByRole('button', { name: '下一步' });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveClass('is-disabled');

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '一个可以帮我回答问题的助手' } });

    expect(nextButton).not.toBeDisabled();
    expect(nextButton).toHaveClass('is-active');
  });

  it('highlights input in red and disables next when unsupported characters are entered', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={Noop}
        onCancel={Noop}
        onNext={Noop}
      />,
    );

    const nameInput = screen.getByLabelText('名称');
    const descriptionInput = screen.getByLabelText('简介');
    const nextButton = screen.getByRole('button', { name: '下一步' });

    fireEvent.change(nameInput, { target: { value: '智能助手@' } });
    fireEvent.change(descriptionInput, { target: { value: '说明ABC123' } });
    expect(nameInput).toHaveClass('is-invalid');
    expect(nextButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: '智能助手1' } });
    fireEvent.change(descriptionInput, { target: { value: '说明ABC#' } });
    expect(descriptionInput).toHaveClass('is-invalid');
    expect(nextButton).toBeDisabled();

    fireEvent.change(descriptionInput, { target: { value: '说明ABC123' } });
    expect(nameInput).not.toHaveClass('is-invalid');
    expect(descriptionInput).not.toHaveClass('is-invalid');
    expect(nextButton).not.toBeDisabled();
  });

  it('updates selected class when selecting default avatar', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={Noop}
        onCancel={Noop}
        onNext={Noop}
      />,
    );

    const avatar2Button = screen.getByLabelText('选择默认头像 avatar-2');
    fireEvent.click(avatar2Button);

    expect(avatar2Button).toHaveClass('is-selected');
  });

  it('shows toast when uploading invalid format file', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={Noop}
        onCancel={Noop}
        onNext={Noop}
      />,
    );

    const input = screen.getByTestId('avatar-upload-input') as HTMLInputElement;
    const invalidFile = new File([new Uint8Array(10)], 'avatar.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(mockedShowToast).toHaveBeenCalledWith('仅支持JPG/PNG格式', {
      toastClassName: 'digital-twin-toast',
      hideClassName: 'digital-twin-toast-hide',
    });
    expect(screen.queryByText('仅支持JPG/PNG格式')).not.toBeInTheDocument();
  });

  it('shows toast when uploading file larger than 2MB and keeps current selection', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={Noop}
        onCancel={Noop}
        onNext={Noop}
      />,
    );

    const defaultAvatarButton = screen.getByLabelText('选择默认头像 avatar-2');
    fireEvent.click(defaultAvatarButton);
    expect(defaultAvatarButton).toHaveClass('is-selected');

    const input = screen.getByTestId('avatar-upload-input') as HTMLInputElement;
    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024)], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(mockedShowToast).toHaveBeenCalledWith('图片大小需小于2MB', {
      toastClassName: 'digital-twin-toast',
      hideClassName: 'digital-twin-toast-hide',
    });
    expect(screen.queryByText('图片大小需小于2MB')).not.toBeInTheDocument();
    expect(defaultAvatarButton).toHaveClass('is-selected');
    expect(screen.getByLabelText('上传自定义头像')).not.toHaveClass('is-selected');
  });
});

