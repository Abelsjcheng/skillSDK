import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivateAssistant from '../../pages/activateAssistant';

describe('ActivateAssistant', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
  });

  it('renders guide image and select button', () => {
    render(
      <MemoryRouter>
        <ActivateAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '选择助理' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '激活助理引导图' })).toBeInTheDocument();
  });
});
