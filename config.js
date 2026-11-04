// הגדרות חיבור לענן (המפתח הזה ציבורי מטבעו; ההגנה היא הקוד הזוגי)
export const SUPABASE_URL = 'https://rbupwfcqodfgqmiugmsj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_RxId2YgyqV_pB5uw7ouSjQ_ScnCxkkG';
export const COUPLE_EMAIL = 'couple@datesapp.com';

export const PROFILES = {
  tal:   { name: 'טל',   partner: 'eilat' },
  eilat: { name: 'אילת', partner: 'tal' },
};

// public half of the push key (safe to share; the private half lives only in Supabase)
export const VAPID_PUBLIC = 'BAJd_oq5J9X6T_8dFZIhGkBt_rwbJwJML2whsX4-d8XprBju94QU50QlrShOgg_0MfehysRtnxCEskUvZmMIQSk';
