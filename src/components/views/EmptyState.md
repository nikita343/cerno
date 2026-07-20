# EmptyState

The centred empty state from section 08 of the design canvas: icon tile →
headline → helper line → optional action.

## Props

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | `"Nothing to plan yet"` |
| `helper` | `string?` | — |
| `action` | `ReactNode?` | — |
| `icon` | `ReactNode?` | `<SparkIcon />` |

Used by `TodayView` (nothing planned) and `InboxView` (inbox clear). Note this
is the *centred* empty state; the dashed inline "Nothing planned yet." card in
Upcoming is a different treatment (`view.emptyDashed`).
