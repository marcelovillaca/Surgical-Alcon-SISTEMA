import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-slide-in">
      <div className="rounded-2xl border border-border bg-card p-10 text-center max-w-md">
        <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
          <Construction className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
