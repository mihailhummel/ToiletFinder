import React from 'react'
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Error boundary component to catch and display errors
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null, errorInfo: React.ErrorInfo | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ 
          padding: '20px', 
          fontFamily: 'Arial, sans-serif',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#dc2626' }}>Something went wrong</h1>
          <details style={{ 
            whiteSpace: 'pre-wrap', 
            backgroundColor: '#f3f4f6',
            padding: '15px',
            borderRadius: '5px',
            marginTop: '20px'
          }}>
            <summary>Show error details</summary>
            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
              {this.state.error?.toString()}
            </p>
            <p style={{ color: '#4b5563' }}>
              {this.state.errorInfo?.componentStack}
            </p>
          </details>
          <div style={{ marginTop: '20px' }}>
            <p>Try the following:</p>
            <ol style={{ lineHeight: '1.6' }}>
              <li>Clear your browser cache and reload the page</li>
              <li>Check the browser console for more details (F12)</li>
              <li>Visit <a href="/test-supabase.html" style={{ color: '#2563eb' }}>the test page</a> to check Supabase connection</li>
            </ol>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '15px'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add error boundary around the app
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
