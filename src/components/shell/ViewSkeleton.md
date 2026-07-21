# ViewSkeleton

The loading shape of a task screen. Rendered by `app/dashboard/loading.tsx`.

## What it actually buys

`loading.tsx` creates a Suspense boundary around the dashboard's *children*, so
Next renders it **inside** the layout: sidebar, tab bar and header stay on
screen and only the content column swaps. Two effects, and the second is the
one that matters:

1. If a segment is slow, you get a skeleton instead of a frozen screen.
2. The router can **prefetch the boundary** for every nav link. Without a
   boundary there is nothing to prefetch for a dynamic route, so a tap does
   nothing visible until the round trip returns.

In practice (2) means this is rarely *seen*: with the link prefetched, the real
view is already in the router cache and navigation is instant. That is the
intended outcome. Verified both ways — with RSC fetches delayed the skeleton
appears and the shell stays mounted; without the delay it never appears at all.

## What it does not cover

**The dashboard layout's own data load.** That `await loadDashboard(...)` runs
*above* this boundary, so a cold first paint still waits on it. Fixing that
means streaming the shell separately from its data, which the store can't do
today — `StoreProvider` needs `initialData` before `AppShell` can render.

So: this makes navigation *between* screens feel instant. It does nothing for
the first load of the app.

## Matching metrics

The bars deliberately reuse the real layout's numbers — the same `--gutter`,
row height and gaps — so content lands in place rather than jumping when it
arrives. A skeleton that shifts on swap is worse than no skeleton: it draws the
eye to the exact moment of loading.

The animation is held back 0.15s. Most navigations resolve faster than that, and
a skeleton that flashes up for 80ms is just a flicker.

A slow opacity pulse rather than a sweeping shimmer gradient — the shimmer has
to repaint a moving background across every block, which is real work on the
low-end phones this screen is most likely to be slow on.

## Accessibility

The bars are `aria-hidden`; a single `role="status"` carries "Loading…". The
shapes are decoration standing in for content that hasn't arrived, and
announcing them as a list of anything would be a lie.
