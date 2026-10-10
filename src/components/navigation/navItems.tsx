import { Bot, Calculator, LayoutDashboard, LineChart, NotebookPen, Settings } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  /** Shown in the mobile bottom bar (Settings lives in the top bar on phones). */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', shortLabel: 'Today', icon: <LayoutDashboard aria-hidden="true" />, mobile: true },
  { to: '/diary', label: 'Food Diary', shortLabel: 'Diary', icon: <NotebookPen aria-hidden="true" />, mobile: true },
  { to: '/calculator', label: 'Calculator', shortLabel: 'Calculator', icon: <Calculator aria-hidden="true" />, mobile: true },
  { to: '/progress', label: 'Progress', shortLabel: 'Progress', icon: <LineChart aria-hidden="true" />, mobile: true },
  { to: '/ai', label: 'AI Nutrition', shortLabel: 'AI', icon: <Bot aria-hidden="true" />, mobile: true },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: <Settings aria-hidden="true" />, mobile: false },
];
