import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_AVATARS } from '../constants';
import { StepBasicInfo } from '../StepBasicInfo';

const noop = () => {};

describe('StepBasicInfo', () => {
  it('disables next button when required fields are empty and enables after filling', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={noop}
        onCancel={noop}
        onNext={noop}
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
        onClose={noop}
        onCancel={noop}
        onNext={noop}
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
    fireEvent.change(descriptionInput, { target: { value: '说明ABC😀' } });
    expect(descriptionInput).toHaveClass('is-invalid');
    expect(nextButton).toBeDisabled();

    fireEvent.change(descriptionInput, { target: { value: '说明ABC123，支持标点。' } });
    expect(nameInput).not.toHaveClass('is-invalid');
    expect(descriptionInput).not.toHaveClass('is-invalid');
    expect(nextButton).not.toBeDisabled();
  });

  it('disables next and highlights when name or description length is out of range', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={noop}
        onCancel={noop}
        onNext={noop}
      />,
    );

    const nameInput = screen.getByLabelText('名称');
    const descriptionInput = screen.getByLabelText('简介');
    const nextButton = screen.getByRole('button', { name: '下一步' });

    fireEvent.change(nameInput, { target: { value: '助' } });
    fireEvent.change(descriptionInput, { target: { value: '介绍内容' } });
    expect(nameInput).toHaveClass('is-invalid');
    expect(nextButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: '智能助手' } });
    fireEvent.change(descriptionInput, { target: { value: '介' } });
    expect(descriptionInput).toHaveClass('is-invalid');
    expect(nextButton).toBeDisabled();

    fireEvent.change(descriptionInput, { target: { value: '介绍内容，支持中英文标点。' } });
    expect(nameInput).not.toHaveClass('is-invalid');
    expect(descriptionInput).not.toHaveClass('is-invalid');
    expect(nextButton).not.toBeDisabled();
  });

  it('updates selected class when selecting default avatar', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={noop}
        onCancel={noop}
        onNext={noop}
      />,
    );

    const avatar2Button = screen.getByLabelText('选择默认头像 avatar-2');
    fireEvent.click(avatar2Button);

    expect(avatar2Button).toHaveClass('is-selected');
  });

  it('does not render cancel button on pc', () => {
    render(
      <StepBasicInfo
        defaultAvatars={DEFAULT_AVATARS}
        onClose={noop}
        onCancel={noop}
        onNext={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });
});
