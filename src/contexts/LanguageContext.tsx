import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'fr' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

const translations = {
  en: {
    // Auth page
    'auth.title': 'Geo Track Admin',
    'auth.description': 'Sign in to access the location tracking dashboard',
    'auth.signin': 'Sign In',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Name',
    'auth.signingIn': 'Signing in...',
    'auth.creatingAccount': 'Creating account...',
    'auth.language': 'Language',
    'auth.success.signin': 'Signed in successfully!',
    'auth.success.signup': 'Account created successfully! Please check your email for verification.',
    'auth.error': 'Error',
    
    // Dashboard
    'dashboard.welcome': 'Welcome',
    'dashboard.signOut': 'Sign Out',
    'dashboard.totalPhones': 'Total Phones',
    'dashboard.activeUsers': 'Active Users',
    'dashboard.recentUpdates': 'Recent Updates',
    'dashboard.overview': 'Overview',
    'dashboard.userManagement': 'User Management',
    'dashboard.filterByUser': 'Filter by user:',
    'dashboard.loadingProfile': 'Loading profile...',
    'dashboard.errors.fetchProfile': 'Failed to fetch user profile',
    'dashboard.errors.createProfile': 'Failed to create user profile',
    'dashboard.errors.fetchPhones': 'Failed to fetch phones',
    'dashboard.errors.fetchTracking': 'Failed to fetch tracking data',
  },
  fr: {
    // Auth page
    'auth.title': 'Géo Track Admin',
    'auth.description': 'Connectez-vous pour accéder au tableau de bord de suivi de localisation',
    'auth.signin': 'Se connecter',
    'auth.signup': "S'inscrire",
    'auth.email': 'E-mail',
    'auth.password': 'Mot de passe',
    'auth.name': 'Nom',
    'auth.signingIn': 'Connexion en cours...',
    'auth.creatingAccount': 'Création du compte...',
    'auth.language': 'Langue',
    'auth.success.signin': 'Connexion réussie!',
    'auth.success.signup': 'Compte créé avec succès! Veuillez vérifier votre e-mail pour la vérification.',
    'auth.error': 'Erreur',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenue',
    'dashboard.signOut': 'Se déconnecter',
    'dashboard.totalPhones': 'Total des téléphones',
    'dashboard.activeUsers': 'Utilisateurs actifs',
    'dashboard.recentUpdates': 'Mises à jour récentes',
    'dashboard.overview': 'Aperçu',
    'dashboard.userManagement': 'Gestion des utilisateurs',
    'dashboard.filterByUser': 'Filtrer par utilisateur:',
    'dashboard.loadingProfile': 'Chargement du profil...',
    'dashboard.errors.fetchProfile': 'Échec de la récupération du profil utilisateur',
    'dashboard.errors.createProfile': 'Échec de la création du profil utilisateur',
    'dashboard.errors.fetchPhones': 'Échec de la récupération des téléphones',
    'dashboard.errors.fetchTracking': 'Échec de la récupération des données de suivi',
  },
  ar: {
    // Auth page
    'auth.title': 'إدارة تتبع الموقع الجغرافي',
    'auth.description': 'قم بتسجيل الدخول للوصول إلى لوحة تحكم تتبع الموقع',
    'auth.signin': 'تسجيل الدخول',
    'auth.signup': 'إنشاء حساب',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.name': 'الاسم',
    'auth.signingIn': 'جاري تسجيل الدخول...',
    'auth.creatingAccount': 'جاري إنشاء الحساب...',
    'auth.language': 'اللغة',
    'auth.success.signin': 'تم تسجيل الدخول بنجاح!',
    'auth.success.signup': 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني للتأكيد.',
    'auth.error': 'خطأ',
    
    // Dashboard
    'dashboard.welcome': 'مرحباً',
    'dashboard.signOut': 'تسجيل الخروج',
    'dashboard.totalPhones': 'إجمالي الهواتف',
    'dashboard.activeUsers': 'المستخدمون النشطون',
    'dashboard.recentUpdates': 'التحديثات الأخيرة',
    'dashboard.overview': 'نظرة عامة',
    'dashboard.userManagement': 'إدارة المستخدمين',
    'dashboard.filterByUser': 'تصفية حسب المستخدم:',
    'dashboard.loadingProfile': 'جاري تحميل الملف الشخصي...',
    'dashboard.errors.fetchProfile': 'فشل في جلب الملف الشخصي للمستخدم',
    'dashboard.errors.createProfile': 'فشل في إنشاء الملف الشخصي للمستخدم',
    'dashboard.errors.fetchPhones': 'فشل في جلب الهواتف',
    'dashboard.errors.fetchTracking': 'فشل في جلب بيانات التتبع',
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    return saved || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};