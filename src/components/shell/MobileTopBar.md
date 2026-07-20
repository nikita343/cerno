# MobileTopBar

Top bar below 960px: profile chip (opens settings) + a notification bell.

Shows only the **given name** — the full name lives in the settings popup.

There is deliberately **no fake iOS status bar**. The designs include one
(9:41, signal, battery) because they're device mockups; rendering it in a real
web app would be a lie about the viewport.

Top padding includes `env(safe-area-inset-top)` for notched devices.
