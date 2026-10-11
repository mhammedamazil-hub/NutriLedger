import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(disposeStores);

describe('navigation and app shell', () => {
  it('shows the dashboard with new-user empty states', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing logged yet today/)).toBeInTheDocument();
    expect(screen.getByText('No daily target set')).toBeInTheDocument();
    expect(screen.getByText('Estimate unavailable')).toBeInTheDocument();
    expect(screen.getByText('No entries in the last 7 days')).toBeInTheDocument();
    // No fabricated numbers: today's calories are a real zero from an empty diary.
    expect(screen.getByText('0', { selector: 'span' })).toBeInTheDocument();
  });

  it('navigates to every section from the main navigation', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    const sidebar = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    const targets: Array<[string, string]> = [
      ['Food Diary', 'Food diary'],
      ['Calculator', 'Energy calculator'],
      ['Progress', 'Progress'],
      ['AI Nutrition', 'AI nutrition assistant'],
      ['Settings', 'Settings'],
      ['Dashboard', 'Today'],
    ];
    for (const [link, heading] of targets) {
      await user.click(within(sidebar).getByRole('link', { name: link }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(within(sidebar).getByRole('link', { name: link })).toHaveAttribute('aria-current', 'page');
    }
  });

  it('has a mobile bottom navigation with five sections and a settings shortcut', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    const bottom = navs[navs.length - 1]!;
    expect(within(bottom).getAllByRole('link')).toHaveLength(5);
    expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBeGreaterThanOrEqual(2);
  });

  it('renders a not-found page for unknown routes with a way back', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/not found/i);
    expect(screen.getAllByRole('link', { name: /dashboard|today/i }).length).toBeGreaterThan(0);
  });

  it('provides a skip link to the main content', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main');
  });
});
