import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { NavigationCard } from './navigation-card';

describe('NavigationCard', () => {
  const mockIcon = <svg data-testid="test-icon" />;

  it('renders title and description', () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description text"
          href="/test"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description text')).toBeInTheDocument();
  });

  it('renders the provided icon', () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description"
          href="/test"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('links to the correct href', () => {
    render(
      <MemoryRouter>
        <NavigationCard
          title="Test Title"
          description="Test description"
          href="/test-path"
          icon={mockIcon}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/test-path');
  });
});
