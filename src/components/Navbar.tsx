// src/components/Navbar.tsx
import React from 'react';

interface NavbarProps {
  onNavigate: (view: 'library' | 'scan' | 'dashboard') => void;
  currentView: 'library' | 'scan' | 'dashboard' | 'detail';
  onSignOut: () => void;
  userEmail: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  currentView,
  onSignOut,
  userEmail,
}) => {
  const viewBase = currentView === 'detail' ? 'library' : currentView;

  const buttonClass = (name: string) =>
    viewBase === name ? 'primary' : 'outline';

  return (
    <header className="navbar">
      <div>
        <strong>My Library</strong>
      </div>
      <div className="nav-buttons">
        <button
          className={buttonClass('dashboard')}
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={buttonClass('library')}
          onClick={() => onNavigate('library')}
        >
          Library
        </button>
        <button
          className={buttonClass('scan')}
          onClick={() => onNavigate('scan')}
        >
          Scan
        </button>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          {userEmail}
        </span>
        <button onClick={onSignOut}>Sign out</button>
      </div>
    </header>
  );
};