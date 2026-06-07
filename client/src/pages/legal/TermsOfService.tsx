import { useLanguage } from "@/contexts/LanguageContext";
import { LegalLayout, LegalSection, Placeholder } from "./LegalLayout";

const CONTACT_EMAIL = "contact@toaletna.com";

export default function TermsOfService() {
  const { language } = useLanguage();
  const bg = language === "bg";

  return (
    <LegalLayout
      title={bg ? "Общи условия" : "Terms of Service"}
      lastUpdated={bg ? "8 юни 2026 г." : "8 June 2026"}
    >
      <p>
        {bg
          ? "С използването на toaletna.com приемате тези условия. Ако не сте съгласни, моля не използвайте услугата."
          : "By using toaletna.com you agree to these terms. If you do not agree, please do not use the service."}
      </p>

      <LegalSection heading={bg ? "Услугата" : "The service"}>
        <p>
          {bg
            ? "Toaletna.com е безплатна, обществена карта на тоалетни в България с отзиви и оценки от потребители. Услугата се предоставя „както е“, без гаранции за наличност или точност."
            : "Toaletna.com is a free, public map of toilets in Bulgaria with user reviews and ratings. The service is provided “as is”, without warranties of availability or accuracy."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Профили" : "Accounts"}>
        <p>
          {bg
            ? "За да добавяте тоалетни, отзиви или сигнали, влизате с профила си в Google. Отговаряте за дейността през Вашия профил."
            : "To add toilets, reviews or reports you sign in with your Google account. You are responsible for activity under your account."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Потребителско съдържание" : "User-generated content"}>
        <p>
          {bg
            ? "Вие запазвате правата върху съдържанието, което публикувате, и ни предоставяте неизключителен лиценз да го показваме в услугата. Отговаряте за това, което публикувате; то трябва да е точно, законно и без обиден, подвеждащ или нарушаващ права материал. Можем да премахваме съдържание и да изтриваме приноси, които нарушават тези условия."
            : "You keep the rights to content you post and grant us a non-exclusive licence to display it within the service. You are responsible for what you post; it must be accurate, lawful and free of offensive, misleading or infringing material. We may remove content and delete contributions that violate these terms."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Допустимо ползване" : "Acceptable use"}>
        <ul className="list-disc pl-5 space-y-1">
          <li>{bg ? "Без спам, автоматизирано извличане на данни или претоварване на услугата." : "No spam, automated scraping, or overloading the service."}</li>
          <li>{bg ? "Без фалшиви тоалетни, фалшиви отзиви или злоупотреба със сигнали." : "No fake toilets, fake reviews, or abuse of the reporting feature."}</li>
          <li>{bg ? "Без опити за заобикаляне на сигурността или достъп до чужди данни." : "No attempts to bypass security or access others’ data."}</li>
        </ul>
      </LegalSection>

      <LegalSection heading={bg ? "Точност на информацията" : "Accuracy of information"}>
        <p>
          {bg
            ? "Данните за тоалетните се поддържат от общността и от външни източници. Не гарантираме, че дадена тоалетна съществува, е отворена, чиста или достъпна. Използвайте информацията по своя преценка."
            : "Toilet data is community- and third-party-sourced. We do not guarantee that any toilet exists, is open, clean or accessible. Use the information at your own discretion."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Ограничаване на отговорността" : "Limitation of liability"}>
        <p>
          {bg
            ? "Доколкото е позволено от закона, не носим отговорност за непреки или последващи вреди, произтичащи от използването на услугата или разчитането на показаната информация."
            : "To the extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the service or reliance on the information shown."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Прекратяване" : "Termination"}>
        <p>
          {bg
            ? "Можем да спрем достъпа при нарушение на тези условия. Можете да изтриете профила си по всяко време от менюто на профила."
            : "We may suspend access for breach of these terms. You may delete your account at any time from the account menu."}
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Приложимо право" : "Governing law"}>
        <p>
          {bg ? "Тези условия се уреждат от законите на " : "These terms are governed by the laws of "}
          <Placeholder>{bg ? "приложима юрисдикция, напр. Република България" : "governing jurisdiction, e.g. Republic of Bulgaria"}</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection heading={bg ? "Контакт" : "Contact"}>
        <p>
          {bg ? "Въпроси: " : "Questions: "}
          <a className="text-blue-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
