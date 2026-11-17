# Writing

How Peal's words read: the docs, the site, the app's own text and the
changelog. DESIGN.md says how things look; this file says how they sound.

The humanizer skill (github.com/blader/humanizer) removes what makes text
read as generated. It takes a writing sample and follows its rhythm, word
choice and punctuation. The samples in this file are that sample: give it
the one that matches the kind of text you're editing.

```
/humanizer

Here's a sample of my writing for voice matching:
<paste the sample for this kind of text, from WRITING.md>

Now humanize this text:
<the draft, or a file path>
```

## Where we are now

Peal's pages avoid the usual tells. They have no "seamless", no "Let's
dive in" and no summary at the bottom. Avoiding them pushed the text too
far the other way, and it now reads like a list of rules turned into
sentences:

| Measure (English docs, prose only)     | Peal  | Well-written docs |
| -------------------------------------- | ----- | ----------------- |
| "you" per 1,000 words                  | 5     | 25 to 50          |
| Contractions (don't, isn't, you'll)    | 1     | used throughout   |
| Spelled-out negatives (do not, is not) | 613   | rare              |
| Median sentence, in words              | 18    | 14 to 18          |
| French "choisissez" / "cliquez sur"    | 122/0 | "cliquez sur"     |
| French semicolons                      | 498   | almost none       |

The patterns behind those numbers:

- **The product is the subject, the reader is missing.** "The composer
  counts each platform's limit" where a person would write "You'll see
  each platform's limit as you type."
- **Comma chains.** One sentence carries three facts joined by commas
  and colons: "Open the post from the calendar once it went out: its page
  shows, for each channel, its status, the post's address on the
  platform, or why it failed."
- **Dropped words.** "This page tells when it tries again", "pick a time
  to come", "a connection that could not be made or broke". Each is
  correct and none is how a person talks.
- **One verb for every control.** "Choose **Schedule**", "choose its
  **Connect** button", "choose it". Buttons are clicked.
- **Slogans after all.** The home page's "Write once. Schedule
  everywhere. See what works." is a three-beat tagline, which is the
  pattern the rules forbid.

More bans would make this worse. What the writing needs is a voice to
copy, and the rest of this file gives one.

## The voice

A careful engineer explaining Peal to a colleague who is about to use it.
They know the product, they respect the reader's time and they say what
happens, including the parts that go wrong.

1. **Talk to the reader.** "You", imperative steps, present tense. Use
   "we" for Peal the company on the site and in the changelog, rarely in
   the docs.
2. **Use contractions.** don't, can't, isn't, you'll, it's. "Do not" is for
   a warning that has to stop someone.
3. **One fact per sentence, and vary the length.** Two short sentences
   beat one sentence with a colon in the middle. But a page where every
   sentence runs 12 words reads as generated too: let a long sentence
   carry a condition, follow it with a short one, and now and then let a
   paragraph be a single line.
4. **Keep the small words.** Articles, "that", "then", "it", "so",
   "because". They make a sentence sound spoken, and they tell a reader
   (and a translator) how the parts connect: "Start the server, and then
   open the app."
5. **Open with what the reader gets.** The first sentence of a page says
   what they can do once they've read it. Never what "this page" covers.
6. **Say what happens, with the number.** "Your server has 15 seconds to
   answer", not "a short timeout". Every limit, default and delay has its
   figure and its unit.
7. **Say what goes wrong.** What fails, what the reader sees when it does,
   and what to do. A limitation stated plainly earns more trust than any
   claim.
8. **Give the reason in one clause.** "...because a second attempt could
   show the post twice." The rule and its reason share a sentence; the
   reason doesn't get its own section.
9. **Start from the mistake.** When readers get something wrong, show the
   wrong move, say what it costs, then show the right one.
10. **Name things once.** A post, a channel, a workspace, a target. Use the
    app's word every time, never a synonym for variety.
11. **Write the button the way the app writes it.** Bold, exact label,
    the right verb: click a button or a menu item, select an option, a
    checkbox or a tab, type in a field, go to a page, turn a switch on or
    off.
12. **Warnings are a rule and its consequence.** Two sentences, at the
    step they guard, one per section at most.
13. **Allow one dry aside.** A parenthesis that carries a fact, now and
    then, on the site or in an explanation. Never in a step, never near
    money or data loss.
14. **Stop when you're done.** End on the next step or nothing. No recap,
    no "Congratulations", no closing line.

## Each kind of text

Each kind below has its rules and a sample written in Peal's voice. The
facts in the samples are true today; check them before you reuse one.

### Tutorial

A first run, start to finish, with one result per step. "You'll", what to
type, what you should see, and what to do if you don't. No alternatives:
one path that works. Say when a step takes a shortcut and what to do
instead in production.

> In this quickstart you'll send a post to one of your channels with the
> API, then get a webhook when it's published. You need an API key and a
> workspace with at least one connected channel. The examples use `curl`,
> and each one has tabs with the same request in the `peal` command line
> and the TypeScript SDK.
>
> First, check that your key works:
>
> The answer names the workspace the key belongs to. Copy `workspace.id`:
> every other request needs it. The ids on this page are made up, so
> yours will differ.

### How-to

A goal the reader already has, in the title ("Schedule a post"). Steps
straight away, one action each, with where to find it first. The odd case
after the steps, with its rule.

> To schedule a post, set the **Date**, **Time** and **Time zone** under
> **When**, then click **Schedule**. The time zone starts as your
> browser's.
>
> If you can't click **Schedule**, the post breaks a limit on one of its
> channels. The composer lists what to fix.
>
> Peal reads the time as a clock in that time zone would show it, so you
> don't need to think about daylight saving. Two nights a year need a
> rule. When the clocks go forward, 02:30 doesn't exist, and a post set
> for it goes out at 03:00. When they go back, 01:30 happens twice, and
> the post goes out the first time.
>
> A time less than a minute ago counts as now. Anything earlier is
> refused, so pick a time that's still ahead.

### Explanation

Why something works the way it does. It may compare, take a position and
admit a trade-off. Headings are concepts or questions, not tasks.

> Sometimes a platform takes a post and its answer never reaches Peal.
> The connection drops, or the platform times out after it has already
> published. From the outside, Peal can't tell whether the post went out.
>
> Where the platform allows it, Peal looks the post up. When that doesn't
> settle it, the post is marked unconfirmed on that channel and Peal
> stops there. It doesn't try again, because a second attempt could put
> the same post on the page twice.
>
> So someone has to look. Open the platform, then tell Peal what you
> found: confirm the post if it's there, or repost it if it isn't.

### Reference

Complete, flat and in the order of the thing it describes. Each entry
says what it does, its default, its limit and what changing it breaks.
No story, no persuasion.

> Your server has 15 seconds to answer. Any 2xx status counts as
> delivered. Everything else is a failure, redirects included, and so is
> no answer in time or a connection that fails.
>
> Peal retries a failed delivery up to seven times over about a day, on
> the schedule below. After the eighth attempt the delivery is marked
> failed, and you can still resend it from the log.
>
> Deliveries can arrive out of order, and more than once. Store the
> `webhook-id` of each event you handle, and answer 200 to one you've
> already seen. To put events in order, sort them by the timestamps in
> `data`.

A setting, in a table cell:

> `BETTER_AUTH_SECRET`: Signs sessions and encrypts what sign-in stores.
> Use at least 32 random characters, such as the output of
> `openssl rand -base64 32`. Anyone who has it can sign in as anyone, so
> keep it out of your repository and your logs. If you replace it, keep
> the old one in `BETTER_AUTH_SECRETS`. Without it, two-step verification
> keys can't be read, and the people who use them can't sign in until
> staff reset them.

### Errors and warnings

The rule, then what happens if it's broken. Say whether the error can
happen when the reader's code is right, and whether to retry.

> Don't repost an unconfirmed post before someone has checked the
> platform. If the first attempt went out, your audience sees it twice.

> 409 `idempotency_key_reused`: you sent a key that was already used with
> a different body. Peal created nothing. Retrying won't help: send a new
> key, or the original body.

### Site

Same voice, shorter, with "we" for the company. A headline says what Peal
is in the reader's words. Every claim names the behaviour behind it: what
happens to a post, when, and what Peal does when something fails. Prices
and limits come from the rate card, never typed.

> **Schedule social posts with your team**
>
> Write a post once, adjust it where a platform needs something
> different, and Peal sends it at the time you set, in your time zone.
> Each platform's numbers come back to Peal, so you can see what worked
> without opening every app.

> **No blind reposts**
>
> When a platform doesn't confirm that a post went out, Peal marks it
> unconfirmed and asks someone to check. A lost answer doesn't turn into
> a duplicate post.

> **Run it yourself**
>
> The source is public under the Functional Source License. You can read
> it, change it and run it for anything except a competing service, and
> each release becomes Apache 2.0 two years after it ships. A server of
> your own needs Postgres and an S3-compatible store. Everything else is
> optional.

### Changelog

What you can do now, or the symptom a fix removes. Whether you need to do
anything.

> You can now sign in with Google on Peal Cloud. On a self-hosted server,
> you can add one OpenID Connect provider next to the password: set the
> `PEAL_OIDC_*` variables, and the sign-in page shows a button named by
> `PEAL_OIDC_NAME`.

## Before and after

Real sentences from the docs, rewritten in this voice.

| Before                                                                                                                                                                                      | After                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| This page tells when it tries again, what your server must expect, and how to find and resend deliveries from the log.                                                                      | Peal retries a failed delivery for about a day. Here's when each attempt happens, what your server should expect, and how to resend a delivery from the log. |
| A time up to a minute ago counts as now. An earlier one is refused: pick a time to come.                                                                                                    | A time less than a minute ago counts as now. Anything earlier is refused, so pick a time that's still ahead.                                                 |
| Choose **Schedule**. It stays off while the post breaks a limit on one of its channels, and the composer lists what to fix.                                                                 | Click **Schedule**. If you can't, the post breaks a limit on one of its channels, and the composer lists what to fix.                                        |
| A request whose answer was lost, to a timeout or a dropped connection, may or may not have been applied. Sending it again must not post twice: an `Idempotency-Key` header makes that safe. | When a request times out, you can't tell whether Peal created the post. Send an `Idempotency-Key` header and you can retry without posting twice.            |
| It answers `410 Gone`: The delivery fails at once, without another attempt, and the endpoint is turned off: the answer says it wants nothing more.                                          | It answers `410 Gone`: Peal stops at once and turns the endpoint off. A 410 means your server doesn't want these events any more.                            |
| Write once. Schedule everywhere. See what works.                                                                                                                                            | Schedule social posts with your team.                                                                                                                        |

## French

The same voice in French, written for French readers rather than
translated sentence by sentence. Merge, split or reorder when French reads
better.

1. **Vous**, jamais « on ». Au présent.
2. **Les étapes et leurs titres à l'impératif, les titres de page et de
   section et les boutons à l'infinitif**, sans mélanger : « Cliquez sur
   **Programmer** » dans une étape, « Choisissez la date et l'heure » en
   titre d'étape, « Programmer une publication » en titre de section.
3. **Un verbe par contrôle.** « Cliquez sur » un bouton ou un menu,
   « sélectionnez » une option ou une case, « saisissez » dans un champ,
   « ouvrez » une page, « activez » un interrupteur. « Choisissez » reste
   pour un vrai choix entre plusieurs possibilités.
4. **Pas de point-virgule.** Deux phrases courtes.
5. **Des verbes directs.** « Vous pouvez » plutôt que « permet de »,
   « pour » plutôt que « afin de », « quand » plutôt que « lorsque »,
   « prendre en charge » et jamais « supporter », « fournir » et non
   « délivrer », « régler » et non « adresser ».
6. **Typographie française.** Guillemets « », apostrophe ’, majuscules
   accentuées (« Échec »), espace fine insécable (U+202F) avant ; ! ?, à
   l'intérieur des guillemets, dans 5 000 et devant % et €, espace
   insécable (U+00A0) avant :. Écrivez une espace simple :
   `bun scripts/french-typography.ts` (dans `packages/peal-docs`) pose les
   bonnes, et le test des docs échoue tant qu'une page en manque.
7. **Un terme par notion**, celui de l'application : publication, canal,
   espace de travail, programmer. Les mots que disent les développeurs
   restent : webhook, API, CLI, token.
8. **Pas de tics** : « Plongeons dans », « Il est important de noter »,
   « Notez que », « Dans un monde où », « À l'ère du numérique »,
   « Que vous soyez… ou… », « incontournable », « véritable »,
   « Ce n'est pas X, c'est Y ».

Échantillon, guide :

> Pour programmer une publication, réglez la **Date**, l'**Heure** et le
> **Fuseau horaire** sous **Quand**, puis cliquez sur **Programmer**. Le
> fuseau part de celui de votre navigateur.
>
> Si le bouton **Programmer** reste inactif, la publication dépasse une
> limite sur l'un de ses canaux. L'éditeur liste ce qu'il faut corriger.
>
> Peal lit l'heure comme une horloge de ce fuseau, changements d'heure
> compris. Deux nuits par an demandent une règle. Quand l'horloge avance,
> 02:30 n'existe pas, et une publication prévue à cette heure part à
> 03:00. Quand elle recule, 01:30 revient deux fois, et la publication
> part la première fois.

Échantillon, explication :

> Il arrive qu'une plateforme reçoive une publication sans que sa réponse
> parvienne à Peal. La connexion tombe, ou la plateforme expire alors
> qu'elle a déjà publié. Vu de l'extérieur, Peal ne peut pas savoir si la
> publication est partie.
>
> Quand la plateforme le permet, Peal va vérifier. Si le doute reste, la
> publication est marquée non confirmée sur ce canal, et Peal s'arrête
> là. Une seconde tentative risquerait de la publier deux fois.

Échantillon, site :

> **Pas de republication à l'aveugle**
>
> Quand une plateforme ne confirme pas qu'une publication est partie,
> Peal la marque non confirmée et demande à quelqu'un de vérifier. Une
> réponse perdue ne devient pas un doublon.

## Layout

A page can hold every fact and still be easy to read if the reader only
meets one idea at a time. The well-laid-out docs we measured share a
shape: about 50 to 150 words under each heading, paragraphs of 15 to 35
words, list items of one line, and rarely more than three paragraphs in
a row without a heading, a list, a table or code. Before its rewrite, the
schedule page had 180 words per heading, list items of 23 words on
average (50 for the longest tenth) and a bold label every 36 words.

1. **The headings are the summary.** Read the "On this page" column on its
   own: it should tell the reader every task the page covers. One task per
   heading. When a list item needs a third sentence, it's a section of its
   own with an H3 (the schedule page's five ways to change a post became
   "Move it", "Edit its text" and "Cancel it").
2. **Don't repeat the page title or the description.** The description
   already shows under the title. The first paragraph adds something new
   (often what the reader needs first), and the first H2 doesn't say the
   title again ("Set the time", not "Schedule it").
3. **A sentence leads into every list and table**, ending with a colon. A
   heading is never followed directly by a list, a table or a callout.
4. **A list holds things of one kind.** Steps, facts, options or actions,
   never a mix. A grab bag of seven unrelated facts is three short
   paragraphs and a list.
5. **Each list item fits on one or two lines.** It starts with the word
   that tells it apart from the others (the goal, the condition, the
   label), so the eye can run down the left edge.
6. **Steps only for a procedure the reader follows in order**, one action
   per step, the title an imperative ("Pick the date and time"). Two or
   three steps are fine. What can go wrong comes after the steps.
7. **A table when the items share the same attributes** (a status and what
   it means, a setting and its default). The first column names the
   thing; a cell holds a sentence or two. Prose that compares more than
   two things across the same facts is a table waiting to happen.
8. **One callout per section at most, never two in a row.** Its title
   states the rule ("A published post can't be taken back from the
   composer"), its body says why or what happens. Only for money, data,
   something public or something irreversible. A title says what happens
   in plain words, never a slogan ("Publishing is public", "The API only
   grows"), a riddle ("A link is a credential") or a question.
9. **Code sits in its own block, after the sentence that says what it
   does.** The same task in the app and on the command line goes in tabs
   when it's short, or in a "On the command line" section at the end of
   the task when the app's version needs prose.
10. **The main path first, the edge cases after.** Detail most readers skip
    (every platform's behaviour, retry timings) goes last, in an accordion.
11. **Bold only for labels the reader clicks or reads on screen.** A
    paragraph with more than three of them is a list or a table.
12. **Markdown inside a component isn't indented**, and has a blank line
    before and after it. Indented, a list inside `<Tab>` renders as one
    block of text with no bullets, which is how the schedule page's
    actions came out.

## Code samples

A reader picks a language once. Every sample on the site then opens in it:
Blume syncs the tabs of one page, and `components/sidebar.astro` keeps the
choice in the browser for the next pages.

1. **Every API call is shown in every SDK**, in one `<CodeGroup>`, with
   the tabs in this order and spelled exactly so (the labels are what the
   choice is remembered by):

   | Tab       | Fence                    |
   | --------- | ------------------------ |
   | `Node.js` | ` ```ts Node.js `        |
   | `Python`  | ` ```python Python `     |
   | `Go`      | ` ```go Go `             |
   | `Ruby`    | ` ```ruby Ruby `         |
   | `Java`    | ` ```java Java `         |
   | `PHP`     | ` ```php PHP `           |
   | `.NET`    | ` ```csharp .NET `       |
   | `Rust`    | ` ```rust Rust `         |
   | `curl`    | ` ```bash curl `         |
   | `CLI`     | ` ```sh CLI `            |
   | MCP       | ` ```json MCP (<tool>) ` |

   Node.js comes first, so it's what a new reader sees. `curl` follows the
   SDKs, then `CLI` and MCP where the command line or a tool does the same
   thing. A group that shows a request's answer keeps the answer in a
   separate `json` block after the group.

2. **The SDK's names, never guessed.** Every method, argument, field and
   type comes from `packages/peal-sdk/<language>/reference.md` and the
   generated sources beside it.
3. **Set the client up once per page.** The first group on a page shows
   the import and the client built from `PEAL_API_KEY`, as on the SDKs
   page. Later groups start from `peal` and show only the call.
4. **Short, and real.** A sample does one thing, with the page's own
   synthetic ids and values, and handles only the error the page is
   about. A full program (a quickstart, a webhook handler) is written out
   in every language too.
5. **Comments say why, in the reader's language**, and the French page
   translates them.

## Words

| Instead of                                                  | Write                          |
| ----------------------------------------------------------- | ------------------------------ |
| choose (a button)                                           | click                          |
| choose (an option, checkbox, tab)                           | select                         |
| allows you to, lets you                                     | you can                        |
| in order to                                                 | to                             |
| utilize, leverage                                           | use                            |
| ensure                                                      | make sure, or say what happens |
| please, simply, just, easily, obviously                     | (nothing)                      |
| note that, it's important to note                           | (state the fact)               |
| this page describes, this section covers                    | (say what the reader can do)   |
| seamless, powerful, robust, effortless, unlock, supercharge | (the behaviour itself)         |
| in the future, coming soon                                  | (nothing until it ships)       |

## Checks

Before a page or a section of the site ships:

- Read it aloud. A sentence you run out of breath on is two sentences.
- Count the "you". A page of steps without one talks about the product
  and leaves the reader out.
- Find every colon in a sentence that isn't introducing a list or code. Most
  of them hide a full stop.
- Look for the number. Each "a few", "quickly" or "a short time" should be
  a figure.
- Run the humanizer with the sample for that kind of text.
