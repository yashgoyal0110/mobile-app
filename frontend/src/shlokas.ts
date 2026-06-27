/**
 * Daily shloka rotation for the splash screen.
 * A different verse surfaces each calendar day (deterministic by day number),
 * so the splash feels alive and gives returning yatris a reason to open the app.
 *
 * Each entry: sa = Devanagari, tr = transliteration, en = short meaning,
 * src = attribution. Kept to well-known Gita verses, Krishna mantras, and
 * Govardhan vandana so they are safe and recognisable.
 */
export interface Shloka {
  sa: string;
  tr: string;
  en: string;
  src: string;
}

export const SHLOKAS: Shloka[] = [
  {
    sa: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
    tr: "karmaṇy-evādhikāras te mā phaleṣu kadāchana",
    en: "You have a right to your actions alone — never to their fruits.",
    src: "Bhagavad Gita 2.47",
  },
  {
    sa: "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।",
    tr: "yadā yadā hi dharmasya glānir bhavati bhārata",
    en: "Whenever righteousness declines, I manifest Myself.",
    src: "Bhagavad Gita 4.7",
  },
  {
    sa: "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।",
    tr: "sarva-dharmān parityajya mām ekaṁ śaraṇaṁ vraja",
    en: "Let go of all anxieties and take refuge in Me alone.",
    src: "Bhagavad Gita 18.66",
  },
  {
    sa: "वसुदेवसुतं देवं कंसचाणूरमर्दनम्।",
    tr: "vasudeva-sutaṁ devaṁ kaṁsa-chāṇūra-mardanam",
    en: "I bow to Krishna, son of Vasudeva, joy of Devaki, guru of the world.",
    src: "Krishna Vandana",
  },
  {
    sa: "ॐ नमो भगवते वासुदेवाय।",
    tr: "oṁ namo bhagavate vāsudevāya",
    en: "Salutations to the all-pervading Lord Vasudeva (Krishna).",
    src: "Dvadashakshara Mantra",
  },
  {
    sa: "हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे।",
    tr: "hare kṛṣṇa hare kṛṣṇa, kṛṣṇa kṛṣṇa hare hare",
    en: "The great chant — a call to the divine name of Krishna.",
    src: "Maha-mantra",
  },
  {
    sa: "नमस्ते गिरिराजाय गोवर्धनाय ते नमः।",
    tr: "namaste girirājāya govardhanāya te namaḥ",
    en: "Salutations to Giriraj Govardhan, the king of the holy hill.",
    src: "Govardhan Vandana",
  },
];

/** Pick the shloka for today (rotates once per calendar day). */
export function shlokaOfTheDay(now: Date = new Date()): Shloka {
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  return SHLOKAS[((dayNumber % SHLOKAS.length) + SHLOKAS.length) % SHLOKAS.length];
}
