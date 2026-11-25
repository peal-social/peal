import { describe, expect, it } from "vitest";

import { identity, welcomeSample } from "../previews/_support/samples.ts";
import { emailAssets, renderWelcomeEmail } from "../src/index.ts";
import { letterhead } from "./support.ts";

// What the HTML shows from its heading on, a line each: the heading, the
// paragraphs, the button and its link, then the foot.
const wordsOf = (html: string): readonly string[] =>
  html
    .slice(html.indexOf("<h1"))
    .replaceAll(/<!--.*?-->/gsu, "")
    .replaceAll(/<\/(?:a|h1|p)>/gu, "\n")
    .replaceAll(/<[^>]*>/gu, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

describe("the welcome", () => {
  it("says hello, then one first step, the API, how to reply, and who signs", async () => {
    const { html, subject, text } = await renderWelcomeEmail(
      welcomeSample("en"),
      { ...letterhead, identity }
    );

    expect(subject).toBe("Welcome to Peal");

    expect(text.split("\n\n")).toStrictEqual([
      "Hi, I’m Camille Synthetic, and I run Peal. Your account is ready, and I’m glad you’re here.",
      "To see how it works, schedule one post. Connect a social account if you haven’t yet, write a few lines and pick a time. Peal publishes it then.",
      "Schedule your first post: https://app.example.test/",
      "If you’re here for the API, create a key in the settings and send your first request.",
      "If something doesn’t work, or you can’t find how to do what you want, reply to this email. It comes to me, and I’ll answer.",
      "Camille Synthetic",
      "You get this email once, because you created a Peal account.",
      identity,
    ]);

    expect(wordsOf(html)).toStrictEqual([
      "Welcome to Peal",
      "Hi, I’m Camille Synthetic, and I run Peal. Your account is ready, and I’m glad you’re here.",
      "To see how it works, schedule one post. Connect a social account if you haven’t yet, write a few lines and pick a time. Peal publishes it then.",
      "Schedule your first post",
      "If the button does not work, open this link:",
      "https://app.example.test/",
      "If you’re here for the API, create a key in the settings and send your first request.",
      "If something doesn’t work, or you can’t find how to do what you want, reply to this email. It comes to me, and I’ll answer.",
      "Camille Synthetic",
      "You get this email once, because you created a Peal account.",
      identity,
    ]);
  });

  it("says it in French", async () => {
    const { subject, text } = await renderWelcomeEmail(
      welcomeSample("fr"),
      letterhead
    );

    expect(subject).toBe("Bienvenue sur Peal");

    expect(text.split("\n\n")).toStrictEqual([
      "Bonjour, je m’appelle Camille Synthetic et je m’occupe de Peal. Votre compte est prêt, et c’est un plaisir de vous accueillir.",
      "Pour voir comment Peal fonctionne, programmez une publication. Connectez un compte social si ce n’est pas déjà fait, écrivez quelques lignes et choisissez une heure. Peal la publie à ce moment-là.",
      "Programmer une publication\u00A0: https://app.example.test/fr",
      "Si vous venez pour l’API, créez une clé dans les paramètres et envoyez votre première requête.",
      "Si quelque chose ne marche pas, ou si vous ne trouvez pas comment faire ce que vous voulez, répondez à cet e-mail. Il m’arrive directement, et je vous répondrai.",
      "Camille Synthetic",
      "Vous ne recevez cet e-mail qu’une fois, parce que vous avez créé un compte Peal.",
    ]);
  });

  it.each(["en", "fr"] as const)(
    "names its signer alone, and shows no picture of anyone, in %s",
    async (locale) => {
      const { html, text } = await renderWelcomeEmail(
        { ...welcomeSample(locale), signer: "Ada <b>{url}</b> & Co" },
        letterhead
      );

      expect(text.split("Ada <b>{url}</b> & Co")).toHaveLength(3);
      expect(html).toContain("Ada &lt;b&gt;{url}&lt;/b&gt; &amp; Co");
      expect(html).not.toContain("<b>");
      // The layout's own sign-off is the team's.
      expect(`${html}${text}`).not.toMatch(/The Peal team|L’équipe Peal/u);

      const pictures = [
        ...html.matchAll(/<img [^>]*src="(?<source>[^"]*)"/gu),
      ].map(({ groups }) =>
        (groups?.["source"] ?? "").replace(`${letterhead.assetsUrl}/`, "")
      );

      expect(pictures.filter((name) => !emailAssets.has(name))).toStrictEqual(
        []
      );
    }
  );
});
