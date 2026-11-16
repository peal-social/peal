// Rendered to static HTML at build time: the page passes no client directive,
// so no JavaScript ships for it.

export interface Feature {
  readonly body: string;
  readonly title: string;
}

interface FeaturesProps {
  readonly features: readonly Feature[];
}

// Bordered cells on the blueprint (DESIGN.md, Site): each paragraph leads
// with its title, then continues in muted text.
export const Features = ({ features }: FeaturesProps) => (
  <ul className="grid border-t sm:grid-cols-2">
    {features.map((feature) => (
      <li key={feature.title} className="border-b p-6 sm:odd:border-e">
        <h3 className="text-[15px] font-semibold">{feature.title}</h3>
        <p className="text-muted-foreground mt-2 text-sm">{feature.body}</p>
      </li>
    ))}
  </ul>
);
