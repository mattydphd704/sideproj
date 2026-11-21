// Temporary "inside a group" screen until Section 2 (My list) is mapped and built.
import * as React from "react";
import { Gift } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Shell, toastUnexpected } from "../components/common";
import { t } from "../copy";
import { api, type Me } from "../lib/api";
import { lastGroup, navigate } from "../lib/router";

export function GroupPlaceholder({ groupId }: { groupId: string }) {
  const [me, setMe] = React.useState<Me | null>(null);
  React.useEffect(() => {
    api.me().then((m) => {
      if (!m.groups.some((g) => g.id === groupId)) { navigate("/", true); return; }
      lastGroup.set(groupId);
      setMe(m);
    }).catch(toastUnexpected);
  }, [groupId]);
  const g = me?.groups.find((x) => x.id === groupId);
  if (!g) return <Shell><Card aria-busy="true"><CardContent><div className="bg-muted h-24 animate-pulse rounded-md" /></CardContent></Card></Shell>;
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gift className="text-brand size-5" aria-hidden />{g.name}</CardTitle>
          <CardDescription>{t("C-TMP-GROUP-01", { name: g.member.displayName })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">{t("C-TMP-GROUP-02")}</p>
          <Button variant="outline" onClick={() => navigate("/?add=1")}>{t("C-TMP-GROUP-03")}</Button>
        </CardContent>
      </Card>
    </Shell>
  );
}
