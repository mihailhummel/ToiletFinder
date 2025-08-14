import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'bg';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  changeLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Comprehensive translations for the entire app
interface Translations {
  // Header
  'header.title': string;
  'header.located': string;
  'header.notLocated': string;
  'header.finding': string;
  'header.findLocation': string;
  
  // Buttons
  'button.filter': string;
  'button.addToilet': string;
  'button.login': string;
  'button.logout': string;
  'button.cancel': string;
  'button.save': string;
  'button.submit': string;
  'button.close': string;
  'button.edit': string;
  'button.delete': string;
  'button.report': string;
  'button.directions': string;
  'button.returnToLocation': string;
  
  // Add Toilet Modal
  'addToilet.title': string;
  'addToilet.selectLocation': string;
  'addToilet.toiletType': string;
  'addToilet.toiletTitle': string;
  'addToilet.titlePlaceholder': string;
  'addToilet.accessibility': string;
  'addToilet.accessType': string;
  'addToilet.requestLocation': string;
  'addToilet.templateHint': string;
  'addToilet.success': string;
  'addToilet.successMessage': string;
  'addToilet.error': string;
  'addToilet.errorMessage': string;
  
  // Toilet Types
  'toiletType.public': string;
  'toiletType.restaurant': string;
  'toiletType.cafe': string;
  'toiletType.gasStation': string;
  'toiletType.mall': string;
  'toiletType.other': string;
  
  // Accessibility
  'accessibility.accessible': string;
  'accessibility.notAccessible': string;
  'accessibility.unknown': string;
  
  // Access Types
  'accessType.free': string;
  'accessType.customersOnly': string;
  'accessType.paid': string;
  'accessType.unknown': string;
  
  // Login Modal
  'login.title': string;
  'login.signInWith': string;
  'login.google': string;
  'login.facebook': string;
  'login.required': string;
  'login.requiredMessage': string;
  
  // Filter Panel
  'filter.title': string;
  'filter.type': string;
  'filter.accessibility': string;
  'filter.accessType': string;
  'filter.showAll': string;
  'filter.applyFilters': string;
  'filter.clearFilters': string;
  
  // Toilet Details
  'details.rating': string;
  'details.reviews': string;
  'details.addReview': string;
  'details.yourRating': string;
  'details.writeReview': string;
  'details.submitReview': string;
  'details.noReviews': string;
  'details.reportNotExists': string;
  'details.reportSuccess': string;
  'details.reportMessage': string;
  
  // Loading and Status
  'loading.toilets': string;
  'loading.message': string;
  'loading.oneTime': string;
  'loading.map': string;
  'loading.count': string;
  
  // Errors
  'error.loadingToilets': string;
  'error.addingToilet': string;
  'error.locationRequired': string;
  'error.networkError': string;
  'error.tryAgain': string;
  'error.serviceUnavailable': string;
  
  // Toast Messages
  'toast.locationFound': string;
  'toast.locationFoundMessage': string;
  'toast.selectLocation': string;
  'toast.selectLocationMessage': string;
  'toast.cacheCleared': string;
  'toast.cacheClearedMessage': string;
  
  // User Menu
  'user.menu': string;
  'user.profile': string;
  'user.settings': string;
  'user.signOut': string;
  
  // PWA
  'pwa.installPrompt': string;
  'pwa.install': string;
  'pwa.dismiss': string;
  'pwa.downloadApp': string;
  'pwa.installDescription': string;
  
  // Clusters
  'cluster.toilets': string;
  
  // Location Selection
  'location.selectOnMap': string;
  'location.tapToSelect': string;
  
  // Report Modal
  'report.title': string;
  'report.reason': string;
  'report.comment': string;
  'report.submit': string;
  'report.success': string;
  
  // Language Switch
  'language.switch': string;
  'language.english': string;
  'language.bulgarian': string;

  // Descriptions
  'description.editToilet': string;
  'description.reviewDetails': string;
  'description.fillDetails': string;

  // Popup translations
  'popup.toiletAt': string;
  'popup.gasStation': string;
  'popup.toiletIn': string;
  'popup.shoppingMall': string;
  'popup.restaurant': string;
  'popup.cafe': string;
  'popup.publicToilet': string;
  'popup.addedBy': string;
  'popup.reviews': string;
  'popup.review': string;
  'popup.noReviews': string;
  'popup.availability': string;
  'popup.accessibility': string;
  'popup.rateThisToilet': string;
  'popup.shareExperience': string;
  'popup.submitReview': string;
  'popup.cancel': string;
  'popup.directions': string;
  'popup.report': string;
  'popup.delete': string;
  'popup.paidAccess': string;
  'popup.customersOnly': string;
  'popup.freeToUse': string;
  'popup.paid': string;
  'popup.onlyForCustomers': string;
  'popup.unknown': string;
  'popup.wheelchairAccessible': string;
  'popup.notWheelchairAccessible': string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Header
    'header.title': 'Toilet Map',
    'header.located': 'Located',
    'header.notLocated': 'Not Located',
    'header.finding': 'Finding...',
    'header.findLocation': 'Find Location',
    
    // Buttons
    'button.filter': 'Filter',
    'button.addToilet': 'Add Toilet',
    'button.login': 'Login',
    'button.logout': 'Logout',
    'button.cancel': 'Cancel',
    'button.save': 'Save',
    'button.submit': 'Add',
    'button.close': 'Close',
    'button.edit': 'Edit',
    'button.delete': 'Delete',
    'button.report': 'Report',
    'button.directions': 'Directions',
    'button.returnToLocation': 'Return to my location',
    
    // Add Toilet Modal
    'addToilet.title': 'Add New Toilet',
    'addToilet.selectLocation': 'Select Location',
    'addToilet.toiletType': 'Toilet Type',
    'addToilet.toiletTitle': 'Title (Optional)',
    'addToilet.titlePlaceholder': 'e.g., "Near the station"',
    'addToilet.accessibility': 'Accessibility',
    'addToilet.accessType': 'Access',
    'addToilet.requestLocation': 'Request Location',
    'addToilet.templateHint': 'Accessibility and access type will be automatically set based on your selection',
    'addToilet.success': 'Toilet Added Successfully!',
    'addToilet.successMessage': 'Your toilet location is now visible to everyone.',
    'addToilet.error': 'Failed to Add Toilet',
    'addToilet.errorMessage': 'Please check your connection and try again.',
    
    // Toilet Types
    'toiletType.public': 'Public',
    'toiletType.restaurant': 'Restaurant',
    'toiletType.cafe': 'Cafe',
    'toiletType.gasStation': 'Gas Station',
    'toiletType.mall': 'Mall',
    'toiletType.other': 'Other',
    
    // Accessibility
    'accessibility.accessible': 'Wheelchair Accessible',
    'accessibility.notAccessible': 'Not Wheelchair Accessible',
    'accessibility.unknown': 'Unknown',
    
    // Access Types
    'accessType.free': 'Free',
    'accessType.customersOnly': 'Customers Only',
    'accessType.paid': 'Paid',
    'accessType.unknown': 'Unknown',
    
    // Login Modal
    'login.title': 'Sign In Required',
    'login.signInWith': 'Sign in with',
    'login.google': 'Google',
    'login.facebook': 'Facebook',
    'login.required': 'Login Required',
    'login.requiredMessage': 'Please sign in to add toilet locations.',
    
    // Filter Panel
    'filter.title': 'Filter Toilets',
    'filter.type': 'Type',
    'filter.accessibility': 'Accessibility',
    'filter.accessType': 'Access Type',
    'filter.showAll': 'Show All',
    'filter.applyFilters': 'Apply Filters',
    'filter.clearFilters': 'Clear Filters',
    
    // Toilet Details
    'details.rating': 'Rating',
    'details.reviews': 'Reviews',
    'details.addReview': 'Add Review',
    'details.yourRating': 'Your Rating',
    'details.writeReview': 'Write a review...',
    'details.submitReview': 'Submit Review',
    'details.noReviews': 'No reviews yet',
    'details.reportNotExists': 'Report Doesn\'t Exist',
    'details.reportSuccess': 'Report Submitted',
    'details.reportMessage': 'Thank you for your feedback.',
    
    // Loading and Status
    'loading.toilets': 'Loading Toilet Locations',
    'loading.message': 'Fetching all available toilet locations for the best experience...',
    'loading.oneTime': 'This happens only once - future map interactions will be instant!',
    'loading.map': 'Loading map...',
    'loading.count': 'locations loaded',
    
    // Errors
    'error.loadingToilets': 'Could not load locations. Please try again later.',
    'error.addingToilet': 'An unexpected error occurred. Please try again.',
    'error.locationRequired': 'Location selection required.',
    'error.networkError': 'Network error. Please check your connection.',
    'error.tryAgain': 'Please try again later.',
    'error.serviceUnavailable': 'Service temporarily unavailable due to database limits. Please try again later.',
    
    // Toast Messages
    'toast.locationFound': 'Location found',
    'toast.locationFoundMessage': 'Centered map on your location',
    'toast.selectLocation': 'Select Location',
    'toast.selectLocationMessage': 'Tap on the map where you want to add the toilet',
    'toast.cacheCleared': 'Cache cleared',
    'toast.cacheClearedMessage': 'All cached toilet data has been cleared.',
    
    // User Menu
    'user.menu': 'User Menu',
    'user.profile': 'Profile',
    'user.settings': 'Settings',
    'user.signOut': 'Sign Out',
    
    // PWA
    'pwa.installPrompt': 'Install this app for a better experience',
    'pwa.install': 'Install',
    'pwa.dismiss': 'Dismiss',
    'pwa.downloadApp': 'Download App',
    'pwa.installDescription': 'Add to home screen for quick access',
    
    // Clusters
    'cluster.toilets': 'toilets',
    
    // Location Selection
    'location.selectOnMap': 'Select on Map',
    'location.tapToSelect': 'Tap on the map to select location',
    
    // Report Modal
    'report.title': 'Report Issue',
    'report.reason': 'Reason',
    'report.comment': 'Comment',
    'report.submit': 'Submit Report',
    'report.success': 'Report Submitted Successfully',
    
    // Language Switch
    'language.switch': 'Language',
    'language.english': 'English',
    'language.bulgarian': 'Български',

    // Descriptions
    'description.editToilet': 'Make changes to the toilet details.',
    'description.reviewDetails': 'Review and confirm the details.',
    'description.fillDetails': 'Fill in the toilet details, then select location.',

    // Popup translations
    'popup.toiletAt': 'Toilet at',
    'popup.gasStation': 'Gas Station',
    'popup.toiletIn': 'Toilet in',
    'popup.shoppingMall': 'Shopping Mall',
    'popup.restaurant': 'Restaurant',
    'popup.cafe': 'Cafe',
    'popup.publicToilet': 'Public Toilet',
    'popup.addedBy': 'Added by',
    'popup.reviews': 'reviews',
    'popup.review': 'review',
    'popup.noReviews': 'No reviews yet. Be the first to review this toilet!',
    'popup.availability': 'Availability:',
    'popup.accessibility': 'Accessibility:',
    'popup.rateThisToilet': 'Rate this toilet',
    'popup.shareExperience': 'Share your experience with this toilet...',
    'popup.submitReview': 'Submit Review',
    'popup.cancel': 'Cancel',
    'popup.directions': 'Directions',
    'popup.report': 'Report',
    'popup.delete': 'Delete',
    'popup.paidAccess': 'Paid Access',
    'popup.customersOnly': 'Customers Only',
    'popup.freeToUse': 'Free to use',
    'popup.paid': 'Paid',
    'popup.onlyForCustomers': 'Only for Customers',
    'popup.unknown': 'Unknown',
    'popup.wheelchairAccessible': 'Wheelchair accessible',
    'popup.notWheelchairAccessible': 'Not wheelchair accessible',
  },
  bg: {
    // Header
    'header.title': 'Toilet Map',
    'header.located': 'Локализиран',
    'header.notLocated': 'Нелокализиран',
    'header.finding': 'Търсене...',
    'header.findLocation': 'Намери Местоположение',
    
    // Buttons
    'button.filter': 'Филтър',
    'button.addToilet': 'Добави Тоалетна',
    'button.login': 'Вход',
    'button.logout': 'Изход',
    'button.cancel': 'Отказ',
    'button.save': 'Запази',
    'button.submit': 'Добави',
    'button.close': 'Затвори',
    'button.edit': 'Редактирай',
    'button.delete': 'Изтрий',
    'button.report': 'Докладвай',
    'button.directions': 'Упътвания',
    'button.returnToLocation': 'Върни се към моята локация',
    
    // Add Toilet Modal
    'addToilet.title': 'Добави Нова Тоалетна',
    'addToilet.selectLocation': 'Избери Локация',
    'addToilet.toiletType': 'Тип Тоалетна',
    'addToilet.toiletTitle': 'Заглавие (Незадължително)',
    'addToilet.titlePlaceholder': 'напр. "EKOTOI"',
    'addToilet.accessibility': 'Достъпност',
    'addToilet.accessType': 'Достъп',
    'addToilet.requestLocation': 'Заяви Локация',
    'addToilet.templateHint': 'Достъпността и типът достъп ще бъдат автоматично зададени според вашия избор',
    'addToilet.success': 'Тоалетната е Добавена Успешно!',
    'addToilet.successMessage': 'Вашата тоалетна вече е видима за всички.',
    'addToilet.error': 'Неуспешно Добавяне на Тоалетна',
    'addToilet.errorMessage': 'Моля, проверете връзката си и опитайте отново.',
    
    // Toilet Types
    'toiletType.public': 'Обществена',
    'toiletType.restaurant': 'Ресторант',
    'toiletType.cafe': 'Кафене',
    'toiletType.gasStation': 'Бензиностанция',
    'toiletType.mall': 'Мол',
    'toiletType.other': 'Друго',
    
    // Accessibility
    'accessibility.accessible': 'Достъпна за инв. колични',
    'accessibility.notAccessible': 'Недостъпна за инв. колички',
    'accessibility.unknown': 'Неизвестно',
    
    // Access Types
    'accessType.free': 'Безплатен',
    'accessType.customersOnly': 'Само за Клиенти',
    'accessType.paid': 'Платен',
    'accessType.unknown': 'Неизвестно',
    
    // Login Modal
    'login.title': 'Необходим е Вход',
    'login.signInWith': 'Влез с',
    'login.google': 'Google',
    'login.facebook': 'Facebook',
    'login.required': 'Необходим е Вход',
    'login.requiredMessage': 'Влезте в профила си в Google, за да добавяте тоалетни и да пишете отзиви.',
    
    // Filter Panel
    'filter.title': 'Филтрирай Тоалетни',
    'filter.type': 'Тип',
    'filter.accessibility': 'Достъпност',
    'filter.accessType': 'Достъп',
    'filter.showAll': 'Покажи Всички',
    'filter.applyFilters': 'Приложи Филтри',
    'filter.clearFilters': 'Изчисти Филтри',
    
    // Toilet Details
    'details.rating': 'Оценка',
    'details.reviews': 'Отзиви',
    'details.addReview': 'Добави Отзив',
    'details.yourRating': 'Вашата Оценка',
    'details.writeReview': 'Напишете отзив...',
    'details.submitReview': 'Изпрати Отзив',
    'details.noReviews': 'Все още няма отзиви',
    'details.reportNotExists': 'Докладвай Липса',
    'details.reportSuccess': 'Докладът е Изпратен',
    'details.reportMessage': 'Благодарим за обратната връзка.',
    
    // Loading and Status
    'loading.toilets': 'Зареждане на Тоалетни',
    'loading.message': 'Зареждаме всички налични тоалетни за най-добро изживяване...',
    'loading.oneTime': 'Това се случва само веднъж - бъдещите взаимодействия с картата ще бъдат мигновени!',
    'loading.map': 'Зареждане на карта...',
    'loading.count': 'заредени местоположения',
    
    // Errors
    'error.loadingToilets': 'Не можаха да се заредят местоположенията. Моля, опитайте по-късно.',
    'error.addingToilet': 'Възникна неочаквана грешка. Моля, опитайте отново.',
    'error.locationRequired': 'Необходимо е избор на местоположение.',
    'error.networkError': 'Мрежова грешка. Моля, проверете връзката си.',
    'error.tryAgain': 'Моля, опитайте по-късно.',
    'error.serviceUnavailable': 'Услугата временно не е достъпна поради ограничения на базата данни. Моля, опитайте по-късно.',
    
    // Toast Messages
    'toast.locationFound': 'Местоположението е намерено',
    'toast.locationFoundMessage': 'Картата е центрирана към вашето местоположение',
    'toast.selectLocation': 'Избери Местоположение',
    'toast.selectLocationMessage': 'Докоснете картата, където искате да добавите тоалетната',
    'toast.cacheCleared': 'Кешът е изчистен',
    'toast.cacheClearedMessage': 'Всички кеширани данни за тоалетни са изчистени.',
    
    // User Menu
    'user.menu': 'Профил',
    'user.profile': 'Профил',
    'user.settings': 'Настройки',
    'user.signOut': 'Излез',
    
    // PWA
    'pwa.installPrompt': 'Инсталирайте това приложение за по-добро изживяване',
    'pwa.install': 'Инсталирай',
    'pwa.dismiss': 'Отхвърли',
    'pwa.downloadApp': 'Изтегли Приложението',
    'pwa.installDescription': 'Добави към началния екран за бърз достъп',
    
    // Clusters
    'cluster.toilets': 'тоалетни',
    
    // Location Selection
    'location.selectOnMap': 'Избери от Картата',
    'location.tapToSelect': 'Докоснете картата за избор на местоположение',
    
    // Report Modal
    'report.title': 'Докладвай Проблем',
    'report.reason': 'Причина',
    'report.comment': 'Коментар',
    'report.submit': 'Изпрати Доклад',
    'report.success': 'Докладът е Изпратен Успешно',
    
    // Language Switch
    'language.switch': 'Език',
    'language.english': 'English',
    'language.bulgarian': 'Български',

    // Descriptions
    'description.editToilet': 'Направи промени в детайлите на тоалетната.',
    'description.reviewDetails': 'Прегледай и потвърди детайлите.',
    'description.fillDetails': 'Попълни детайлите на тоалетната, след което избери местоположение.',

    // Popup translations
    'popup.toiletAt': 'Тоалетна в',
    'popup.gasStation': 'Бензиностанция',
    'popup.toiletIn': 'Тоалетна в',
    'popup.shoppingMall': 'Търговски Център',
    'popup.restaurant': 'Ресторант',
    'popup.cafe': 'Кафене',
    'popup.publicToilet': 'Обществена Тоалетна',
    'popup.addedBy': 'Добавена от',
    'popup.reviews': 'отзива',
    'popup.review': 'отзив',
    'popup.noReviews': 'Все още няма отзиви. Напишете първият отзив за тази тоалетна!',
    'popup.availability': 'Достъп:',
    'popup.accessibility': 'Достъпност:',
    'popup.rateThisToilet': 'Оценете тази тоалетна',
    'popup.shareExperience': 'Споделете вашето преживяване с тази тоалетна...',
    'popup.submitReview': 'Изпрати Отзив',
    'popup.cancel': 'Отказ',
    'popup.directions': 'Упътвания',
    'popup.report': 'Докладвай',
    'popup.delete': 'Изтрий',
    'popup.paidAccess': 'Платен Достъп',
    'popup.customersOnly': 'Само за Клиенти',
    'popup.freeToUse': 'Безплатна за ползване',
    'popup.paid': 'Платена',
    'popup.onlyForCustomers': 'Само за Клиенти',
    'popup.unknown': 'Неизвестно',
    'popup.wheelchairAccessible': 'Достъпна за инвалидни колички',
    'popup.notWheelchairAccessible': 'Недостъпна за инвалидни колички',
  },
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Check localStorage first, then browser language, default to Bulgarian for Bulgaria
    const savedLanguage = localStorage.getItem('toilet-finder-language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'bg')) {
      return savedLanguage;
    }
    
    // Detect browser language - prefer Bulgarian for Bulgarian users
    const browserLanguage = navigator.language.toLowerCase();
    if (browserLanguage.startsWith('bg')) {
      return 'bg';
    }
    
    // Default to Bulgarian since the app is for Bulgaria
    return 'bg';
  });

  useEffect(() => {
    localStorage.setItem('toilet-finder-language', language);
  }, [language]);

  const t = (key: keyof Translations): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const changeLanguage = (newLanguage: Language) => {
    if (newLanguage !== language) {
      setLanguage(newLanguage);
      
      // Simple and reliable: just refresh the browser
      setTimeout(() => {
        window.location.reload();
      }, 50);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};