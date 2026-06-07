import React from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
}

/**
 * The single, unified app loading screen.
 *
 * Brand logo centered in a circle with a sweeping circular progress ring.
 * Intentionally dependency-free (no context / i18n) so it can render at any
 * point in the boot sequence, and it mirrors the pre-React loader in
 * client/index.html so the hand-off from initial HTML → React is seamless.
 * Keep the two in sync (markup + the `.app-loader` styles in index.css).
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="app-loader" role="status" aria-label="Loading">
      <div className="app-loader__stage">
        <div className="app-loader__spinner">
          <svg className="app-loader__ring" viewBox="0 0 160 160" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="app-loader-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1976D2" stopOpacity="0" />
                <stop offset="100%" stopColor="#1976D2" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="80" cy="80" r="74" stroke="#E6EEF7" strokeWidth="6" />
            {/* Sweeping arc */}
            <circle
              cx="80"
              cy="80"
              r="74"
              stroke="url(#app-loader-grad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="130 335"
            />
          </svg>
        </div>
        <div className="app-loader__logo">
          <img src="/newlogo.png" alt="Toaletna.com" />
        </div>
      </div>
    </div>
  );
};
