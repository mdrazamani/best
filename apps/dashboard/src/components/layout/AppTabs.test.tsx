import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppTabs } from './AppTabs';

describe('AppTabs', () => {
  it('shows sidebar buttons', () => {
    render(<AppTabs active="dashboard" onChange={vi.fn()} />);

    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(9);
  });
});
