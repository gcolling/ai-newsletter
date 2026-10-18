// Progressive enhancement for the reader. Without this file every story is still a plain link.
(() => {
  const app = document.querySelector(".app");
  if (!app) return humanizeTimes();

  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const rows = $$(".row", app);
  const stories = new Map($$(".story[data-id]", app).map((el) => [el.dataset.id, el]));
  const stage = app.querySelector(".stage");
  const pos = app.querySelector("[data-pos]");
  const ticks = app.querySelector("[data-ticks]");
  const focusBtn = app.querySelector("[data-focus]");
  const endCard = app.querySelector("[data-end]");
  const viewLinks = $$("[data-view]", app);
  const viewTitle = document.getElementById("view-title");
  const viewMeta = app.querySelector("[data-view-meta]");
  const empty = app.querySelector(".list-empty");
  const narrow = matchMedia("(max-width: 900px)");

  const READ_KEY = "read-v1";
  const read = new Set(load(READ_KEY, []));
  let order = [];
  let current = null;
  let shownAt = 0;
  let focusObserver = null;

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function markRead(id) {
    if (!id || read.has(id)) return;
    read.add(id);
    document.getElementById(`r-${id}`)?.classList.add("is-read");
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...read].slice(-3000)));
    } catch {}
  }

  function applyView(view) {
    if (!viewLinks.some((a) => a.dataset.view === view)) view = "top";
    for (const a of viewLinks) a.setAttribute("aria-current", String(a.dataset.view === view));
    order = [];
    for (const row of rows) {
      const inView = row.dataset.views.split(" ").includes(view);
      row.hidden = !inView;
      stories.get(row.dataset.id)?.toggleAttribute("data-out", !inView);
      if (inView) order.push(row.dataset.id);
    }
    const label = viewLinks.find((a) => a.dataset.view === view)?.querySelector("span");
    viewTitle.textContent = label?.textContent ?? "Top stories";
    const minutes = Math.max(1, Math.round(order.length / 2));
    viewMeta.textContent = `${order.length} · about ${minutes} min`;
    empty.hidden = order.length > 0;
    select(order.includes(current) ? current : order[0], { scrollStory: isFocus() });
  }

  function select(id, { scrollStory = false } = {}) {
    if (current && current !== id && Date.now() - shownAt > 1500) markRead(current);
    const story = stories.get(id);
    for (const el of stories.values()) el.classList.toggle("is-current", el === story);
    for (const row of rows) row.classList.toggle("is-current", row.dataset.id === id);
    current = id ?? null;
    shownAt = Date.now();
    if (!story) return;
    stage.style.setProperty("--stage", story.style.getPropertyValue("--c"));
    const index = order.indexOf(id);
    pos.textContent = `${index + 1} of ${order.length}`;
    drawTicks(index);
    document.getElementById(`r-${id}`)?.scrollIntoView({ block: "nearest" });
    if (scrollStory) story.scrollIntoView({ block: "start" });
  }

  function drawTicks(index) {
    const n = order.length;
    ticks.classList.toggle("bar", n > 24);
    if (n > 24) {
      ticks.replaceChildren();
      ticks.style.setProperty("--p", `${((index + 1) / n) * 100}%`);
      return;
    }
    ticks.style.setProperty("--n", n);
    ticks.replaceChildren(
      ...order.map((_, i) => {
        const tick = document.createElement("i");
        if (i <= index) tick.className = "on";
        return tick;
      }),
    );
  }

  function step(delta) {
    const next = order[order.indexOf(current) + delta];
    if (next) return select(next, { scrollStory: isFocus() });
    if (delta > 0 && isFocus()) endCard.scrollIntoView({ block: "start" });
  }

  const isFocus = () => app.classList.contains("is-focus");

  function setFocus(on) {
    if (on === isFocus()) return;
    app.classList.toggle("is-focus", on);
    document.body.classList.toggle("is-locked", on);
    focusBtn.textContent = on ? "Close" : "Focus";
    focusBtn.setAttribute("aria-pressed", String(on));
    if (on) {
      stories.get(current)?.scrollIntoView({ block: "start" });
      focusObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const id = e.target.dataset.id;
            if (e.isIntersecting && id && id !== current) select(id);
          }
        },
        { root: stage, threshold: 0.6 },
      );
      for (const el of stories.values()) focusObserver.observe(el);
    } else {
      focusObserver?.disconnect();
      document.getElementById(`r-${current}`)?.scrollIntoView({ block: "center" });
    }
  }

  function open() {
    const link = stories.get(current)?.querySelector("[data-open]");
    if (!link) return;
    markRead(current);
    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  // Events
  app.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const rowLink = target?.closest(".row-link");
    if (rowLink && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      e.preventDefault();
      select(rowLink.parentElement.dataset.id);
      if (narrow.matches) setFocus(true);
      return;
    }
    const view = target?.closest("[data-view]");
    if (view) {
      e.preventDefault();
      history.replaceState(null, "", `#${view.dataset.view}`);
      return applyView(view.dataset.view);
    }
    if (target?.closest("[data-next]")) return step(1);
    if (target?.closest("[data-focus]")) return setFocus(!isFocus());
    if (target?.closest("[data-open]")) markRead(current);
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select")) return;
    const keys = {
      j: () => step(1),
      ArrowDown: () => step(1),
      ArrowRight: () => step(1),
      k: () => step(-1),
      ArrowUp: () => step(-1),
      ArrowLeft: () => step(-1),
      o: open,
      Enter: () => (e.target.closest?.("a, button") ? null : open()),
      f: () => setFocus(!isFocus()),
      Escape: () => setFocus(false),
    };
    const action = keys[e.key];
    if (!action) return;
    if (action() !== null) e.preventDefault();
  });

  window.addEventListener("hashchange", () => applyView(location.hash.slice(1)));

  for (const row of rows) if (read.has(row.dataset.id)) row.classList.add("is-read");
  applyView(location.hash.slice(1) || "top");
  humanizeTimes();

  // Relative times for fresh stories, local clock times for older ones.
  function humanizeTimes() {
    const now = Date.now();
    const local = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const full = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
    for (const t of document.querySelectorAll("time[datetime]")) {
      const date = new Date(t.dateTime);
      if (Number.isNaN(date.getTime())) continue;
      const minutes = Math.round((now - date.getTime()) / 60000);
      t.title = full.format(date);
      if (minutes >= 0 && minutes < 60) t.textContent = `${Math.max(1, minutes)} min ago`;
      else if (minutes >= 60 && minutes < 36 * 60)
        t.textContent = `${Math.round(minutes / 60)} h ago`;
      else t.textContent = local.format(date);
    }
  }
})();
