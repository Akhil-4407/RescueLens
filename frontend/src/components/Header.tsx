import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Shield, Cpu, Activity } from 'lucide-react';
import { useMission } from '../state/MissionContext';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { images, isProcessingQueue, activeService } = useMission();

  // Close menu on resize to desktop (>900px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  // Close menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Toggle body.menu-open class
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [mobileMenuOpen]);

  const navItems = [
    { label: 'Mission', path: '/mission' },
    { label: 'Detection', path: '/detection' },
    { label: 'Image Queue', path: '/queue' },
    { label: 'Reports', path: '/reports' },
  ];

  return (
    <>
      <header
        id="app-header"
        className="sticky top-0 z-40 w-full bg-black/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3 transition-colors"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* LEFT: RESCUE EYE Logo with technical shield/eye inline SVG */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <NavLink
              to="/mission"
              id="header-brand-logo"
              className="flex items-center gap-2.5 group text-white decoration-transparent focus:outline-none"
            >
              {/* Technical shield-eye inline SVG mark */}
              <div className="relative w-8 h-8 flex items-center justify-center rounded border border-white/25 bg-gradient-to-b from-white/15 to-white/5 shadow-inner transition-transform group-hover:scale-105">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-white"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  {/* Outer shield perimeter */}
                  <path
                    d="M12 2L4 5V11C4 16.5 7.5 21.2 12 22C16.5 21.2 20 16.5 20 11V5L12 2Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Eye pupil optical scanner */}
                  <path
                    d="M7 12C8.5 9.8 10.2 8.8 12 8.8C13.8 8.8 15.5 9.8 17 12C15.5 14.2 13.8 15.2 12 15.2C10.2 15.2 8.5 14.2 7 12Z"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <circle cx="12" cy="12" r="1.75" fill="white" />
                </svg>
                {/* Micro optical crosshair pin */}
                <div className="absolute inset-0 border border-white/10 pointer-events-none rounded" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold tracking-tight text-base text-white uppercase font-sans">
                    RESCUE EYE
                  </span>
                </div>
                <span className="text-[10px] tracking-widest text-[#9a9a9a] uppercase font-mono hidden sm:inline-block">
                  ON-DEVICE RESCUE INTELLIGENCE
                </span>
              </div>
            </NavLink>
          </div>

          {/* CENTER: Desktop Navigation Pills (Hidden <= 900px) */}
          <nav
            id="desktop-nav"
            className="hidden md:flex items-center gap-2 lg:gap-2.5"
            aria-label="Main Navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                id={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={({ isActive }) =>
                  `nav-pill metallic-shine ${
                    isActive ? 'nav-pill-active' : ''
                  }`
                }
              >
                <span>{item.label}</span>
                {item.path === '/queue' && images.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/15 text-white font-mono">
                    {images.length}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT: ON-DEVICE Status & Settings / Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-[160px]">
            {/* ON-DEVICE status indicator */}
            <div
              id="status-indicator-badge"
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] border border-white/15 bg-white/5 backdrop-blur-md text-[11px] text-white/90"
              title="Computer Vision execution is verified client-side on-device with zero cloud APIs"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isProcessingQueue ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isProcessingQueue ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="hidden sm:inline font-medium tracking-normal text-xs">
                ON-DEVICE
              </span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-[#d8d8d8] font-mono uppercase">
                {activeService.name === 'MockInferenceService' ? 'DEMO INFERENCE' : 'TFLITE DROP-IN'}
              </span>
            </div>

            {/* Settings & Architecture diagnostics trigger */}
            <button
              id="btn-nav-settings"
              onClick={() => navigate('/settings')}
              aria-label="System Diagnostics & Architecture"
              title="System Diagnostics & Model Architecture"
              className={`p-2 rounded-[7px] border border-white/20 text-[#d8d8d8] hover:text-white hover:border-white/50 bg-white/5 transition-all ${
                location.pathname === '/settings' ? 'border-white text-white bg-white/15' : ''
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Button (visible <= 900px) */}
            <button
              id="btn-mobile-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col items-center justify-center w-[42px] h-[42px] rounded-[7px] border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              <div className="w-5 flex flex-col gap-1 items-center justify-center">
                <span
                  className={`block h-0.5 w-5 bg-white transition-transform duration-300 ${
                    mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition-opacity duration-200 ${
                    mobileMenuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition-transform duration-300 ${
                    mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen Mobile Navigation Menu (<= 900px) */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-between p-6 transition-all duration-300 animate-in fade-in"
          style={{
            backgroundColor: 'rgba(8, 8, 8, 0.94)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Mobile Header Bar with Close */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white font-sans text-base uppercase">
                RESCUE EYE
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#d8d8d8] font-mono">
                ON-DEVICE CV
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-[42px] h-[42px] rounded-[7px] border border-white/30 bg-white/10 text-white flex items-center justify-center font-mono text-lg"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-4 my-auto">
            {navItems.map((item) => (
              <button
                key={item.path}
                id={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full py-4 px-6 rounded-[8px] text-left font-medium text-lg flex items-center justify-between border transition-all ${
                  location.pathname === item.path
                    ? 'btn-metallic-primary'
                    : 'btn-metallic-ghost'
                }`}
              >
                <span>{item.label}</span>
                {item.path === '/queue' && images.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-white/20 font-mono">
                    {images.length} FRAMES
                  </span>
                )}
              </button>
            ))}

            <button
              onClick={() => {
                navigate('/settings');
                setMobileMenuOpen(false);
              }}
              className="w-full py-4 px-6 rounded-[8px] text-left font-medium text-lg flex items-center justify-between border btn-metallic-ghost"
            >
              <span>Diagnostics & Engine</span>
              <Settings className="w-5 h-5 text-[#9a9a9a]" />
            </button>
          </div>

          {/* Mobile Footer Status */}
          <div className="border-t border-white/10 pt-4 text-center">
            <p className="text-[11px] font-mono text-[#9a9a9a] uppercase tracking-wider">
              [B-03] ON-DEVICE CV ARCHITECTURE • ZERO CLOUD VISION
            </p>
          </div>
        </div>
      )}
    </>
  );
};
