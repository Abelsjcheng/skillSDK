import React from 'react';
import { readFileSync } from 'fs';
import { fireEvent, render, screen } from '@testing-library/react';
import ResponsiveConfirmModal from '../system/ResponsiveConfirmModal';
import * as constants from '../../constants';

describe('ResponsiveConfirmModal', () => {
  let isPcMiniAppSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    document.body.innerHTML = '';
    isPcMiniAppSpy = jest.spyOn(constants, 'isPcMiniApp');
  });

  afterEach(() => {
    isPcMiniAppSpy.mockRestore();
  });

  it('renders the PC modal with header, no mask, and configurable action styles', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    isPcMiniAppSpy.mockReturnValue(true);

    render(
      <ResponsiveConfirmModal
        open
        title="确认删除对话吗？"
        description="删除对话后不可恢复"
        confirmText="删除"
        confirmBackgroundColor="#f36f64"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('提示')).toBeInTheDocument();
    expect(document.querySelector('.responsive-confirm-modal__mask')).not.toBeInTheDocument();
    expect(document.querySelector('.responsive-confirm-modal__panel')).toHaveClass('responsive-confirm-modal__panel');
    const confirmButton = screen.getByRole('button', { name: '删除' });
    expect(confirmButton).toHaveStyle({ backgroundColor: '#f36f64', color: '#fff' });

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the mobile modal without header and closes when the mask is clicked', () => {
    const onClose = jest.fn();
    const onCancel = jest.fn();
    isPcMiniAppSpy.mockReturnValue(false);

    render(
      <ResponsiveConfirmModal
        open
        headerTitle="自定义标题"
        title="确认删除对话吗？"
        cancelBackgroundColor="#111"
        mobileConfirmTextColor="#f36f64"
        onClose={onClose}
        onCancel={onCancel}
      />,
    );

    expect(screen.queryByText('自定义标题')).not.toBeInTheDocument();
    expect(document.querySelector('.responsive-confirm-modal__mask')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确定' })).toHaveStyle({ color: '#f36f64' });
    const cancelButton = document.querySelector('.responsive-confirm-modal__action--cancel') as HTMLButtonElement;
    expect(cancelButton.style.backgroundColor).toBe('');

    fireEvent.click(document.querySelector('.responsive-confirm-modal__mask') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('can render mobile without a mask', () => {
    isPcMiniAppSpy.mockReturnValue(false);

    render(
      <ResponsiveConfirmModal
        open
        title="确认删除对话吗？"
        showMask={false}
        onClose={jest.fn()}
      />,
    );

    expect(document.querySelector('.responsive-confirm-modal__mask')).not.toBeInTheDocument();
  });

  it('uses compact PC header title typography', () => {
    const styles = readFileSync(`${process.cwd()}/src/styles/ResponsiveConfirmModal.less`, 'utf8');
    const headerTitleRule =
      /\.responsive-confirm-modal--pc \.responsive-confirm-modal__header-title\s*\{[^}]*\}/s
        .exec(styles)?.[0] ?? '';

    expect(headerTitleRule).toContain('font-size: 12px;');
    expect(headerTitleRule).not.toContain('font-weight:');
  });
});
