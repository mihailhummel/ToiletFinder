import { useLanguage } from "@/contexts/LanguageContext";
import { LegalLayout, LegalSection, Placeholder } from "./LegalLayout";

const CONTACT_EMAIL = "contact@toaletna.com";

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const bg = language === "bg";

  return (
    <LegalLayout
      title={bg ? "Политика за поверителност" : "Privacy Policy"}
      lastUpdated={bg ? "8 юни 2026 г." : "8 June 2026"}
    >
      <p>
        {bg
          ? "Тази политика обяснява какви лични данни обработваме в toaletna.com, защо, на какво правно основание и какви права имате съгласно Общия регламент за защита на данните (GDPR)."
          : "This policy explains what personal data we process at toaletna.com, why, on what legal basis, and what rights you have under the EU General Data Protection Regulation (GDPR)."}
      </p>

      <LegalSection heading={bg ? "Администратор на данни" : "Data Controller"}>
        <p>
          {bg ? "Администратор на личните данни е " : "The controller of your personal data is "}
          <Placeholder>{bg ? "юридическо име на администратора" : "controller legal name"}</Placeholder>
          {bg ? ", адрес: " : ", address: "}
          <Placeholder>{bg ? "адрес за кореспонденция" : "registered address"}</Placeholder>.
          {bg ? " Можете да се свържете с нас на " : " You can contact us at "}
          <a className="text-blue-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Какви данни обработваме" : "What data we process"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            {bg
              ? "Профил (чрез Google вход): име, имейл, профилна снимка и идентификатор от Google — за вход и за да свържем вашите приноси с вас."
              : "Account (via Google sign-in): name, email, profile photo and Google user ID — to log you in and attribute your contributions to you."}
          </li>
          <li>
            {bg
              ? "Принос към съдържанието: отзиви (оценка, текст, показвано име, дата), добавени тоалетни (координати и детайли) и подадени сигнали."
              : "Content you contribute: reviews (rating, text, display name, date), toilets you add (coordinates and details), and reports you submit."}
          </li>
          <li>
            {bg
              ? "Приблизително местоположение: използва се във Вашия браузър, за да центрира картата и да намери близки тоалетни. Координатите се изпращат до сървъра само за заявка за близки обекти и не се съхраняват."
              : "Approximate location: used in your browser to centre the map and find nearby toilets. Coordinates are sent to the server only to query nearby places and are not stored."}
          </li>
          <li>
            {bg
              ? "Анализ на употребата (само със съгласие): анонимизирани данни чрез Google Analytics."
              : "Usage analytics (with consent only): anonymised data via Google Analytics."}
          </li>
          <li>
            {bg
              ? "Технически дневници: IP адрес и данни за заявката се обработват временно от хостинга и базата данни за сигурност и предотвратяване на злоупотреби."
              : "Technical logs: IP address and request data are processed transiently by our hosting and database for security and abuse prevention."}
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading={bg ? "Здравни данни (важно)" : "Health data (important)"}>
        <p>
          {bg
            ? "Toaletna.com е полезна за хора с IBS/IBD, но НЕ събираме и НЕ съхраняваме здравна информация. Не Ви питаме за медицински състояния и няма функция, която да маркира състояние към профил. Моля, не включвайте здравна информация в отзивите си."
            : "Toaletna.com is useful for people with IBS/IBD, but we do NOT collect or store any health information. We never ask about medical conditions and there is no feature that tags a condition to your account. Please do not include health information in your reviews."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Правни основания" : "Legal bases"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{bg ? "Изпълнение на услугата и показване на Вашите приноси — легитимен интерес/договор." : "Providing the service and showing your contributions — legitimate interest / contract."}</li>
          <li>{bg ? "Анализ на употребата и незадължителни бисквитки — Вашето съгласие." : "Usage analytics and non-essential cookies — your consent."}</li>
          <li>{bg ? "Местоположение — Вашето съгласие (разрешение на браузъра)." : "Location — your consent (browser permission)."}</li>
          <li>{bg ? "Сигурност и спазване на закона — легитимен интерес/правно задължение." : "Security and legal compliance — legitimate interest / legal obligation."}</li>
        </ul>
      </LegalSection>

      <LegalSection heading={bg ? "Трети страни (обработващи)" : "Third parties (processors)"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{bg ? "Supabase — база данни и съхранение на данни (регион ЕС, Франкфурт)." : "Supabase — database and data storage (EU region, Frankfurt)."}</li>
          <li>{bg ? "Firebase Authentication (Google) — вход с Google." : "Firebase Authentication (Google) — Google sign-in."}</li>
          <li>{bg ? "Google Analytics — анализ на употребата (само със съгласие)." : "Google Analytics — usage analytics (with consent only)."}</li>
          <li>{bg ? "CARTO — картови плочки (basemap)." : "CARTO — map tiles (basemap)."}</li>
          <li>{bg ? "Railway — хостинг на приложението." : "Railway — application hosting."}</li>
        </ul>
      </LegalSection>

      <LegalSection heading={bg ? "Международни трансфери" : "International transfers"}>
        <p>
          {bg
            ? "Данните в базата се съхраняват в ЕС (Франкфурт). Google Analytics може да прехвърля данни към Google в САЩ; Google разчита на стандартни договорни клаузи и/или рамката Data Privacy Framework като защита."
            : "Database data is stored in the EU (Frankfurt). Google Analytics may transfer data to Google in the USA; Google relies on Standard Contractual Clauses and/or the EU-US Data Privacy Framework as safeguards."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Съхранение" : "Retention"}>
        <p>
          {bg
            ? "Данните на профила се пазят, докато съществува профилът. При изтриване на профил Вашите отзиви и сигнали се изтриват, а добавените от Вас тоалетни се анонимизират (премахваме връзката с Вашия профил), за да остане картата пълна. Аналитичните данни се пазят според настройките за съхранение на Google Analytics."
            : "Account data is kept while your account exists. When you delete your account, your reviews and reports are deleted and toilets you added are anonymised (we remove the link to your account) so the map stays complete. Analytics data is kept per Google Analytics retention settings."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Вашите права" : "Your rights"}>
        <p>
          {bg
            ? "Имате право на достъп, коригиране, изтриване, ограничаване, преносимост и възражение, както и да оттеглите съгласието си по всяко време. Можете да упражните тези права от менюто на профила (изтриване на профил) или като ни пишете на "
            : "You have the right to access, rectify, erase, restrict, port and object, and to withdraw consent at any time. You can exercise these rights from the account menu (delete account) or by emailing us at "}
          <a className="text-blue-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          {bg
            ? "Имате право да подадете жалба до надзорния орган — Комисия за защита на личните данни (КЗЛД), София 1592, бул. „Проф. Цветан Лазаров“ 2, "
            : "You have the right to lodge a complaint with the supervisory authority — the Commission for Personal Data Protection (CPDP), 2 Prof. Tsvetan Lazarov Blvd, Sofia 1592, Bulgaria, "}
          <a className="text-blue-600 underline" href="https://www.cpdp.bg" target="_blank" rel="noopener noreferrer">cpdp.bg</a>.
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Деца" : "Children"}>
        <p>
          {bg
            ? "Услугата не е насочена към деца под 16 години и ние не събираме умишлено техни данни."
            : "The service is not directed at children under 16 and we do not knowingly collect their data."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Промени" : "Changes"}>
        <p>
          {bg
            ? "Може да актуализираме тази политика. Ще публикуваме новата дата по-горе и, при съществени промени относно бисквитки, ще поискаме отново съгласието Ви."
            : "We may update this policy. We will post the new date above and, for material cookie-related changes, ask for your consent again."}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
