import React from 'react';
import { render, screen } from '@testing-library/react';
import ActivateAssistant from '../../pages/activateAssistant';

describe('ActivateAssistant', () => {
  it('renders static guide image and enable button', () => {
    render(<ActivateAssistant />);

    expect(screen.getByRole('button', { name: '立即启用' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '激活助理引导图' })).toBeInTheDocument();
  });
});
