import * as React from "react";
import { Toaster } from "./components/ui/sonner";
import { Card, CardContent } from "./components/ui/card";
import { Shell } from "./components/common";
import { api } from "./lib/api";
import { lastGroup, navigate, parse, query, usePath } from "./lib/router";
import { Home } from "./screens/Home";
import { Join } from "./screens/Join";
import { NewGroup } from "./screens/NewGroup";
import { GroupPlaceholder } from "./screens/GroupPlaceholder";

export function App() {
  const path = usePath();
  const route = parse(path);
  return (
    <>
      {route.name === "home" && <HomeGate key={path} forceHome={query(path).has("add")} />}
      {route.name === "join" && <Join key={route.code} code={route.code} />}
      {route.name === "new" && <NewGroup />}
      {route.name === "group" && <GroupPlaceholder key={route.groupId} groupId={route.groupId} />}
      <Toaster />
    </>
  );
}

/**
 * "/" opens the last group used if this browser is in one (UI_INTERACTION_MAPS §1.0),
 * or the waiting screen if a group request is open. "/?add=1" always shows Home.
 */
function HomeGate({ forceHome }: { forceHome: boolean }) {
  const [ready, setReady] = React.useState(forceHome);
  React.useEffect(() => {
    if (forceHome) return;
    let cancelled = false; // a screen that has closed must not navigate (BUG-005)
    (async () => {
      const me = await api.me().catch(() => ({ groups: [] as { id: string }[] }));
      if (cancelled) return;
      if (me.groups.length) {
        const last = lastGroup.get();
        navigate(`/g/${me.groups.some((g) => g.id === last) ? last : me.groups[0]!.id}`, true);
        return;
      }
      const req = await api.currentRequest().catch(() => null);
      if (cancelled) return;
      if (req) { navigate("/new", true); return; }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [forceHome]);
  if (!ready) return <Shell><Card aria-busy="true"><CardContent><div className="bg-muted h-24 animate-pulse rounded-md" /></CardContent></Card></Shell>;
  return <Home />;
}
