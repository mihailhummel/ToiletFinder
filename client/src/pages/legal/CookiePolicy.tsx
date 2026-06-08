import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { LegalLayout, LegalSection } from "./LegalLayout";

export default function CookiePolicy() {
  const { language } = useLanguage();
  const bg = language === "bg";

  const th = bg
    ? ["Име", "Цел", "Категория"]
    : ["Name", "Purpose", "Category"];

  const rows = bg
    ? [
        ["toilet-finder-language", "Запомня избрания език", "Необходима"],
        ["toaletna-cookie-consent", "Запомня избора Ви за бисквитки", "Необходима"],
        ["toilet-map-visited", "Скрива началния прозорец при повторно посещение", "Функционална"],
        ["Firebase Auth (сесия)", "Поддържа Ви вписани след вход с Google", "Необходима"],
        ["_ga, _ga_*", "Google Analytics — статистика за употребата", "Аналитична (със съгласие)"],
      ]
    : [
        ["toilet-finder-language", "Remembers your chosen language", "Essential"],
        ["toaletna-cookie-consent", "Remembers your cookie choice", "Essential"],
        ["toilet-map-visited", "Hides the welcome dialog on return visits", "Functional"],
        ["Firebase Auth (session)", "Keeps you signed in after Google login", "Essential"],
        ["_ga, _ga_*", "Google Analytics — usage statistics", "Analytics (consent)"],
      ];

  return (
    <LegalLayout
      title={bg ? "Политика за бисквитки" : "Cookie Policy"}
      lastUpdated={bg ? "8 юни 2026 г." : "8 June 2026"}
    >
      <p>
        {bg
          ? "Използваме малък брой бисквитки и локално съхранение (localStorage). Необходимите елементи правят сайта работещ и запомнят Вашите избори. Аналитичните се зареждат само след Вашето съгласие."
          : "We use a small number of cookies and local storage. Essential items make the site work and remember your choices. Analytics items load only after your consent."}
      </p>

      <LegalSection heading={bg ? "Категории" : "Categories"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>{bg ? "Необходими и функционални" : "Essential & functional"}</strong>{" "}
            {bg
              ? "— винаги активни; за основните функции и Вашите предпочитания (език, сесия при вход, запомняне на този избор, скриване на началния прозорец). Първа страна, без проследяване."
              : "— always on; for core functions and your preferences (language, sign-in session, remembering this choice, hiding the welcome dialog). First-party, no tracking."}
          </li>
          <li>
            <strong>{bg ? "Аналитични" : "Analytics"}</strong>{" "}
            {bg
              ? "— Google Analytics; зареждат се само ако приемете. Можете да оттеглите съгласието си по всяко време."
              : "— Google Analytics; load only if you accept. You can withdraw consent at any time."}
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading={bg ? "Какво използваме" : "What we use"}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                {th.map((h) => (
                  <th key={h} className="py-2 pr-4 font-bold text-slate-900">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-mono text-[12px] text-slate-700">{r[0]}</td>
                  <td className="py-2 pr-4 text-slate-600">{r[1]}</td>
                  <td className="py-2 pr-4 text-slate-600">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection heading={bg ? "Управление на съгласието" : "Managing consent"}>
        <p>
          {bg ? "Можете да промените или оттеглите съгласието си от " : "You can change or withdraw your consent from the "}
          <Link href="/cookie-settings" className="text-blue-600 underline font-semibold">
            {bg ? "настройките за бисквитки" : "cookie settings"}
          </Link>
          {bg
            ? ". Промяната влиза в сила веднага — при отказ спираме Google Analytics и изтриваме неговите бисквитки."
            : ". Changes take effect immediately — on reject we stop Google Analytics and delete its cookies."}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
