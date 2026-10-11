import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Notice } from './Notice';

interface Props {
  children: ReactNode;
  /** Short description of the area, e.g. "This chart". */
  label: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Contains rendering failures to one area so the rest of the app — and the
 * user's saved data — stays accessible. No stack traces are shown.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`NutriLedger: ${this.props.label} failed to render.`, error.name, info.componentStack?.split('\n')[1]?.trim());
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Notice tone="warning" title={`${this.props.label} could not be displayed.`} role="status">
            Your saved records are not affected. Try reloading the page.
          </Notice>
        )
      );
    }
    return this.props.children;
  }
}
