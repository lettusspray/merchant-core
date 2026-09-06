import type { ComponentType } from "react";

import { useSessionState } from "@/hooks/use-session-state";
import { SectionEmpty } from "@/components/section-empty";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionPageProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

export function SectionPage({ icon: Icon, title, description }: SectionPageProps) {
  const session = useSessionState();

  const awaiting = session.status === "signed-out";

  return (
    <div className="space-y-6">
      {awaiting ? (
        <SectionEmpty icon={Icon} title={title} description={description}>
          <p className="text-sm text-muted-foreground">
            Sign in to load this surface with your workspace data.
          </p>
        </SectionEmpty>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <Badge variant="secondary">scaffold ready</Badge>
              </div>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This surface is wired into the console shell and ready for its data layer.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
