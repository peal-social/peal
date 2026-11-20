// Google's "G", inline: the four paths of Google's own file, the
// icon-only light button its branding guidelines publish
// (https://developers.google.com/identity/branding-guidelines, read on
// 2026-11-16: branding_guideline_sample_lt_sq_sl.svg, kept byte for byte
// beside this file as google-g.svg), copied as they are, without the
// button's white square and border, so the G sits on any button as
// Google's dark button sets it. The button is 40 units wide with its G at
// 10 to 30; the mark is that window of 20 units, at half the control's
// height, as Google's 20 in its 40. A test checks the paths against the
// file. Never a monochrome or redrawn G.

/** Each of the G's paths, with its fill, as Google's file has them. */
export const googleMarkPaths = [
  {
    d: "M29.6 20.2273C29.6 19.5182 29.5364 18.8364 29.4182 18.1818H20V22.05H25.3818C25.15 23.3 24.4455 24.3591 23.3864 25.0682V27.5773H26.6182C28.5091 25.8364 29.6 23.2727 29.6 20.2273Z",
    fill: "#4285F4",
  },
  {
    d: "M20 30C22.7 30 24.9636 29.1045 26.6181 27.5773L23.3863 25.0682C22.4909 25.6682 21.3454 26.0227 20 26.0227C17.3954 26.0227 15.1909 24.2636 14.4045 21.9H11.0636V24.4909C12.7091 27.7591 16.0909 30 20 30Z",
    fill: "#34A853",
  },
  {
    d: "M14.4045 21.9C14.2045 21.3 14.0909 20.6591 14.0909 20C14.0909 19.3409 14.2045 18.7 14.4045 18.1V15.5091H11.0636C10.3864 16.8591 10 18.3864 10 20C10 21.6136 10.3864 23.1409 11.0636 24.4909L14.4045 21.9Z",
    fill: "#FBBC04",
  },
  {
    d: "M20 13.9773C21.4681 13.9773 22.7863 14.4818 23.8227 15.4727L26.6909 12.6045C24.9591 10.9909 22.6954 10 20 10C16.0909 10 12.7091 12.2409 11.0636 15.5091L14.4045 18.1C15.1909 15.7364 17.3954 13.9773 20 13.9773Z",
    fill: "#E94235",
  },
] as const;

export const GoogleMark = () => (
  <svg aria-hidden width={16} height={16} viewBox="10 10 20 20">
    {googleMarkPaths.map(({ d, fill }) => (
      <path key={fill} d={d} fill={fill} />
    ))}
  </svg>
);
