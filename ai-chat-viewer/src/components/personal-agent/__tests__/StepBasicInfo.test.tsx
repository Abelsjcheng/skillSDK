import React, { useMemo, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StepBasicInfo } from '../StepBasicInfo';
import { DEFAULT_AVATARS } from '../constants';
import { canProceedNext, validateAvatarFile } from '../../../utils/personalAgentValidation';

const Noop = () => {};

const StepBasicInfoHarness: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarType, setAvatarType] = useState<'default' | 'custom'>('default');
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATARS[0].id);
  const [avatarError, setAvatarError] = useState('');
  const [customPreview, setCustomPreview] = useState<string | undefined>();
  const canNext = useMemo(() => canProceedNext(name, description), [name, description]);

  return (
    <StepBasicInfo
      defaultAvatars={DEFAULT_AVATARS}
      selectedAvatarType={avatarType}
      selectedAvatarId={avatarId}
      customAvatarPreview={customPreview}
      avatarError={avatarError}
      name={name}
      description={description}
      canNext={canNext}
      onSelectDefaultAvatar={(id) => {
        setAvatarType('default');
        setAvatarId(id);
      }}
      onAvatarUpload={(file) => {
        const result = validateAvatarFile(file);
        if (!result.valid) {
          setAvatarError(result.reason || '');
          return;
        }
        setAvatarType('custom');
        setCustomPreview('blob://preview');
        setAvatarError('');
      }}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onClose={Noop}
      onCancel={Noop}
      onNext={Noop}
    />
  );
};

describe('StepBasicInfo', () => {
  it('disables next button when required fields are empty and enables after filling', () => {
    render(<StepBasicInfoHarness />);

    const nextButton = screen.getByRole('button', { name: '下一步' });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveClass('is-disabled');

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '一个可以帮我回答问题的助手' } });

    expect(nextButton).not.toBeDisabled();
    expect(nextButton).toHaveClass('is-active');
  });

  it('updates selected class when selecting default avatar', () => {
    render(<StepBasicInfoHarness />);

    const avatar2Button = screen.getByLabelText('选择默认头像 avatar-2');
    fireEvent.click(avatar2Button);

    expect(avatar2Button).toHaveClass('is-selected');
  });

  it('shows validation error when uploading invalid file', () => {
    render(<StepBasicInfoHarness />);

    const input = screen.getByTestId('avatar-upload-input') as HTMLInputElement;
    const invalidFile = new File([new Uint8Array(10)], 'avatar.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(screen.getByText('仅支持JPG/PNG格式')).toBeInTheDocument();
  });
});

