import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  User,
  LogOut,
  LogIn,
  Download,
  X,
  Instagram,
  Linkedin,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type InfoModalType = 'about' | 'guides' | 'contacts' | null;

const BLOG_URL = 'https://toaletna.com/blog';
const CONTACT_EMAIL = 'contact@toaletna.com';

const PIN_COLORS = {
  babyChanging: '#ff66c4',
  gasStation: '#ff3131',
  public: '#5170ff',
  mall: '#38b6ff',
  cafe: '#ffbd59',
  portable: '#00bf63',
  other: '#ad52ec',
} as const;

/* ------------------------------------------------------------------ */
/* Small reusable teardrop pin (for the map legend)                    */
/* ------------------------------------------------------------------ */
const LegendPin: React.FC<{ color: string }> = ({ color }) => (
  <div className="relative w-[38px] h-[38px] flex-shrink-0 flex items-center justify-center transition-transform sm:hover:scale-105">
    <div
      className="w-[38px] h-[38px] rounded-[50%_50%_0_50%] rotate-45 flex items-center justify-center shadow-[inset_0_-2px_8px_rgba(0,0,0,0.15)] ring-1 ring-black/5"
      style={{ backgroundColor: color }}
    >
      <div className="w-[28px] h-[28px] bg-white rounded-full -rotate-45 flex items-center justify-center shadow-sm relative">
        <span className="text-[12px] font-bold text-slate-800 leading-none absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-[45%] tracking-tight">
          WC
        </span>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Desktop inline nav links                                            */
/* ------------------------------------------------------------------ */
interface DesktopNavLinksProps {
  onOpenModal: (modal: InfoModalType) => void;
}

export const DesktopNavLinks: React.FC<DesktopNavLinksProps> = ({ onOpenModal }) => {
  const { t } = useLanguage();

  const linkClasses =
    'px-2.5 py-1.5 text-sm font-semibold text-gray-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap';

  return (
    <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
      <a href={BLOG_URL} target="_blank" rel="noreferrer" className={linkClasses}>
        {t('nav.blog')}
      </a>
      <button type="button" className={linkClasses} onClick={() => onOpenModal('about')}>
        {t('nav.about')}
      </button>
      <button type="button" className={linkClasses} onClick={() => onOpenModal('guides')}>
        {t('nav.guides')}
      </button>
      <button type="button" className={linkClasses} onClick={() => onOpenModal('contacts')}>
        {t('nav.contacts')}
      </button>
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Profile button + dropdown navigation                                */
/* ------------------------------------------------------------------ */
interface ProfileMenuProps {
  user: any;
  isAdmin?: boolean;
  isMobile?: boolean;
  onOpenModal: (modal: InfoModalType) => void;
  onSignOut: () => void;
  onInstallApp: () => void;
  onLoginClick: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  user,
  isAdmin,
  isMobile,
  onOpenModal,
  onSignOut,
  onInstallApp,
  onLoginClick,
}) => {
  const { t, language } = useLanguage();
  const bg = language === 'bg';
  const [open, setOpen] = useState(false);
  // Falls back to the User icon if the Google avatar fails to load (e.g. a 429
  // from lh3.googleusercontent.com), so we never show a broken image.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset the failure flag whenever the user / photo changes.
  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.photoURL]);
  const showAvatar = !!user?.photoURL && !avatarFailed;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    // On desktop (where the nav links live in the navbar) the profile button
    // simply opens the login modal when signed out. The full navigation
    // dropdown is reserved for mobile / tablet.
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop && !user) {
      onLoginClick();
      return;
    }
    setOpen((prev) => !prev);
  };

  const openModal = (modal: InfoModalType) => {
    setOpen(false);
    onOpenModal(modal);
  };

  const showInstall =
    isMobile &&
    typeof window !== 'undefined' &&
    !window.matchMedia('(display-mode: standalone)').matches;

  const itemClasses =
    'w-full px-4 py-2.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center justify-center';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={t('nav.menu')}
        aria-expanded={open}
        className="w-9 h-9 rounded-full bg-gray-100 p-0 overflow-hidden flex items-center justify-center border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none"
      >
        {showAvatar ? (
          <img
            src={user!.photoURL!}
            alt={user?.displayName || 'User'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <User className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-14 right-0 w-64 max-w-[min(15rem,calc(100vw-2.5rem))]',
            'bg-white rounded-2xl shadow-xl shadow-slate-900/15 border border-slate-100 overflow-hidden z-[2000]',
            'animate-in fade-in slide-in-from-top-2 duration-200',
            'lg:top-14 lg:right-0 lg:w-72 lg:max-w-[calc(100vw-32px)]'
          )}
        >
          {/* Profile preview */}
          {user ? (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 shadow-md flex-shrink-0">
                {showAvatar ? (
                  <img
                    src={user!.photoURL!}
                    alt={user?.displayName || 'User'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate text-[15px]">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-[12px] text-slate-500 truncate">{user?.email}</p>
                {isAdmin && (
                  <span className="inline-block mt-0.5 text-[11px] text-blue-600 font-bold">
                    Admin
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLoginClick();
              }}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 shadow-md flex-shrink-0">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-[15px] flex items-center gap-1.5">
                  <LogIn className="w-4 h-4 text-blue-600" />
                  {t('nav.signIn')}
                </p>
                <p className="text-[12px] text-slate-500">{t('login.requiredMessage')}</p>
              </div>
            </button>
          )}

          {/* Navigation (mobile / tablet only — desktop shows these in the navbar) */}
          <div className="py-1.5 flex flex-col lg:hidden">
            <button type="button" className={itemClasses} onClick={() => { setOpen(false); window.open(BLOG_URL, '_blank', 'noreferrer'); }}>
              {t('nav.blog')}
            </button>
            <button type="button" className={itemClasses} onClick={() => openModal('about')}>
              {t('nav.about')}
            </button>
            <button type="button" className={itemClasses} onClick={() => openModal('guides')}>
              {t('nav.guides')}
            </button>
            <button type="button" className={itemClasses} onClick={() => openModal('contacts')}>
              {t('nav.contacts')}
            </button>
          </div>

          {/* Actions */}
          <div className="p-3 pt-2 border-t border-slate-100 flex flex-col gap-2">
            {showInstall && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onInstallApp();
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] py-2.5 rounded-xl shadow-[0_4px_10px_rgba(37,99,235,0.2)] active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                {t('nav.download')}
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-[13px] py-2.5 rounded-xl active:scale-[0.98] transition-all"
              >
                <LogOut className="w-4 h-4" />
                {t('user.signOut')}
              </button>
            )}
          </div>

          {/* Legal / privacy footer links (reachable from the profile menu) */}
          <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
            {[
              { href: '/privacy', label: bg ? 'Поверителност' : 'Privacy' },
              { href: '/terms', label: bg ? 'Условия' : 'Terms' },
              { href: '/cookies', label: bg ? 'Бисквитки' : 'Cookies' },
              { href: '/cookie-settings', label: bg ? 'Настройки' : 'Cookie settings' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Info modals (About / Guides / Contacts)                             */
/* ------------------------------------------------------------------ */
interface InfoModalsProps {
  activeModal: InfoModalType;
  onClose: () => void;
}

export const InfoModals: React.FC<InfoModalsProps> = ({ activeModal, onClose }) => {
  const { t } = useLanguage();
  const [isEmailCopied, setIsEmailCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(CONTACT_EMAIL);
    setIsEmailCopied(true);
    setTimeout(() => setIsEmailCopied(false), 2000);
  };

  if (!activeModal) return null;

  const overlay = (
    <div
      className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    />
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 sm:hover:text-slate-600 transition-colors"
    >
      <X size={18} />
    </button>
  );

  /* ---- Contacts ---- */
  if (activeModal === 'contacts') {
    return (
      <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {overlay}
        <div className="relative w-full sm:w-[400px] bg-white rounded-t-[32px] sm:rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 fade-in duration-300">
          <div className="pt-6 pb-4 px-6 relative text-center">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />
            {closeButton}
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('contacts.title')}</h2>
          </div>

          <div className="px-6 py-4 pb-8 flex flex-col gap-5">
            <div className="flex justify-center gap-4">
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noreferrer"
                className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center sm:hover:bg-pink-100 transition-colors"
              >
                <Instagram size={24} />
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noreferrer"
                className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center sm:hover:bg-blue-100 transition-colors"
              >
                <Linkedin size={24} />
              </a>
            </div>

            <div className="flex items-center gap-4 mt-2 mb-1">
              <div className="h-px bg-slate-100 flex-1" />
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {t('contacts.orReachOut')}
              </div>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            <div className="flex flex-col items-center justify-center relative">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="group flex flex-col items-center justify-center bg-slate-50 border border-slate-100 outline-none w-full py-4 rounded-xl active:scale-[0.98] transition-transform relative overflow-hidden"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-medium text-slate-600 sm:group-hover:text-blue-600 transition-colors tracking-tight">
                    {CONTACT_EMAIL}
                  </span>
                  <div className="text-slate-400 sm:group-hover:text-blue-500 transition-colors flex items-center justify-center">
                    {isEmailCopied ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </div>
                </div>
                <div
                  className={`absolute inset-0 bg-emerald-50/90 backdrop-blur-sm flex items-center justify-center transition-all duration-300 ${
                    isEmailCopied ? 'opacity-100 visible' : 'opacity-0 invisible'
                  }`}
                >
                  <span className="text-[13px] font-semibold text-emerald-600 tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> {t('contacts.copied')}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- About / Guides ---- */
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {overlay}
      <div className="relative w-full sm:w-[400px] bg-white rounded-t-[32px] sm:rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 fade-in duration-300 max-h-[85vh]">
        <div className="pt-6 pb-2 px-6 relative text-center shrink-0">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />
          {closeButton}
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {activeModal === 'about' ? t('about.title') : t('guides.title')}
          </h2>
        </div>

        <div className="px-6 py-6 pb-10 overflow-y-auto no-scrollbar">
          {activeModal === 'about' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed text-[15px]">{t('about.p1')}</p>
              <p className="text-slate-600 leading-relaxed text-[15px]">{t('about.p2')}</p>
              <div className="h-px w-12 bg-slate-200 my-4" />
              <p className="text-slate-600 leading-relaxed text-[15px]">{t('about.p3')}</p>
              <p className="text-slate-600 leading-relaxed text-[15px]">{t('about.p4')}</p>
            </div>
          )}

          {activeModal === 'guides' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 mb-3 text-lg leading-tight">
                  {t('guides.mapLegend')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 pt-1">
                  {[
                    { color: PIN_COLORS.babyChanging, label: t('guides.legend.babyChanging') },
                    { color: PIN_COLORS.public, label: t('guides.legend.public') },
                    { color: PIN_COLORS.mall, label: t('guides.legend.mall') },
                    { color: PIN_COLORS.gasStation, label: t('guides.legend.gasStation') },
                    { color: PIN_COLORS.cafe, label: t('guides.legend.cafe') },
                    { color: PIN_COLORS.portable, label: t('guides.legend.portable') },
                    { color: PIN_COLORS.other, label: t('guides.legend.other') },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-4 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"
                    >
                      <LegendPin color={item.color} />
                      <span className="text-[13px] font-bold text-slate-700 tracking-wide">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  {t('guides.howToAdd')}
                </h3>
                <p className="text-sm text-blue-800/80 leading-relaxed font-medium">
                  {t('guides.howToAddPre')}
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-blue-600 text-white font-black text-[12px] mx-[2px] leading-none shadow-sm shadow-blue-600/30 align-middle">
                    +
                  </span>
                  {t('guides.howToAddPost')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
