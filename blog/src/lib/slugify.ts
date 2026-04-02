import slugify from "slugify";

slugify.extend({
  Ъ: "A",
  ъ: "a",
  Ь: "Y",
  ь: "y",
});

export function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    locale: "bg",
  });
}
