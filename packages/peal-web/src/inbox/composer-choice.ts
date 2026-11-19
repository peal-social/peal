// What a member has aimed an inbox composer at: a post's comments and a
// location's reviews each have one composer under the list, which answers
// the item Reply chose, else the next one waiting. Writing pins the draft
// to the item the composer shows, so a refresh never moves the text to
// another author; a draft that is sent or emptied lets the composer move
// on again.

/**
 * The item a member aimed the composer at: by its Reply (`replied`), by
 * writing to it (`written`, which pins the draft), or both.
 */
export interface ComposerChoice {
  readonly id: string;
  readonly replied: boolean;
  readonly written: boolean;
}

/** What the member has chosen by pressing Reply on `id`. */
export const replyChoice = (id: string): ComposerChoice => ({
  id,
  replied: true,
  written: false,
});

/**
 * What the member has chosen once the draft for `targetId`, the item the
 * composer shows, reads `text`: any text pins it there, and an emptied
 * draft keeps only a Reply to that item, so the composer goes back to the
 * queue. A sent reply leaves no choice (`null`) either.
 */
export const choiceOnDraft = (
  chosen: ComposerChoice | null,
  targetId: string,
  text: string
): ComposerChoice | null => {
  const replied = chosen?.id === targetId && chosen.replied;

  if (text !== "") {
    return { id: targetId, replied, written: true };
  }

  return replied ? replyChoice(targetId) : null;
};
