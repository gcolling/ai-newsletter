// Progressive enhancement. Without this file every story is still a plain link.
(() => {
  const store = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };

  // Saved stories: kept in this browser only, newest first.
  const saved = {
    list: () => store.get("saved-v1", []),
    write(list) {
      store.set("saved-v1", list);
      updateSavedLinks();
    },
    has: (id) => saved.list().some((s) => s.id === id),
  };

  const safeHref = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "#";
    } catch {
      return "#";
    }
  };

  setUpTheme();
  humanizeTimes();
  updateSavedLinks();
  setUpOffline();
  const app = document.querySelector(".app");
  if (app) {
    setUpReader(app);
    setUpSplitters(app);
  }
  const savedList = document.querySelector("[data-saved-list]");
  if (savedList) setUpSavedPage(savedList);

  // Install and offline reading. The service worker sits next to the manifest at the site root.
  function setUpOffline() {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(new URL("sw.js", manifest.href)).catch(() => {});
    }
    const note = document.querySelector("[data-offline]");
    if (!note) return;
    const paint = () => {
      note.hidden = navigator.onLine;
    };
    window.addEventListener("online", paint);
    window.addEventListener("offline", paint);
    paint();
  }

  function updateSavedLinks() {
    const count = saved.list().length;
    for (const a of document.querySelectorAll("[data-saved-link]")) {
      a.textContent = count ? `Saved · ${count}` : "Saved";
    }
  }

  // Briefly swaps a button's label, e.g. "Link copied".
  function flash(button, text) {
    button.dataset.label ??= button.textContent;
    button.textContent = text;
    setTimeout(() => {
      button.textContent = button.dataset.label;
    }, 1600);
  }

  function setUpSavedPage(list) {
    const empty = document.querySelector("[data-saved-empty]");
    const tools = document.querySelector("[data-saved-tools]");
    const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
    const draw = () => {
      const items = saved.list();
      list.replaceChildren(
        ...items.map((item) => {
          const li = document.createElement("li");
          li.className = "saved-item";
          li.style.setProperty("--c", item.color);
          const link = document.createElement("a");
          link.className = "saved-title";
          link.href = safeHref(item.url);
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = item.title;
          const meta = document.createElement("span");
          meta.className = "saved-meta";
          meta.textContent = `${item.source} · saved ${day.format(new Date(item.savedAt))}`;
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "pill-btn";
          remove.dataset.remove = item.id;
          remove.textContent = "Remove";
          li.append(link, meta, remove);
          return li;
        }),
      );
      empty.hidden = items.length > 0;
      tools.hidden = items.length === 0;
    };
    document.addEventListener("click", async (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const remove = target?.closest("[data-remove]");
      if (remove) {
        saved.write(saved.list().filter((s) => s.id !== remove.dataset.remove));
        return draw();
      }
      const copy = target?.closest("[data-saved-copy]");
      if (copy) {
        const md = saved
          .list()
          // <…> around the URL keeps parentheses in it intact (CommonMark link destination).
          .map(
            (s) => `- [${s.title.replace(/[[\]]/g, "\\$&")}](<${safeHref(s.url)}>) — ${s.source}`,
          )
          .join("\n");
        try {
          await navigator.clipboard.writeText(md);
          flash(copy, "Copied");
        } catch {
          flash(copy, "Copy failed");
        }
        return;
      }
      if (target?.closest("[data-saved-clear]") && confirm("Remove every saved story?")) {
        saved.write([]);
        draw();
      }
    });
    draw();
  }

  // Theme: Auto follows the system; Light and Dark are remembered. The head script applies a saved
  // choice before first paint, so this only keeps the button and the attribute in step.
  function setUpTheme() {
    const order = ["auto", "light", "dark"];
    const label = { auto: "Auto", light: "Light", dark: "Dark" };
    let theme = order.includes(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme
      : "auto";
    const buttons = document.querySelectorAll("[data-theme-toggle]");
    const paint = () => {
      if (theme === "auto") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = theme;
      for (const b of buttons) b.textContent = `Theme: ${label[theme]}`;
    };
    for (const b of buttons) {
      b.addEventListener("click", () => {
        theme = order[(order.indexOf(theme) + 1) % order.length];
        try {
          if (theme === "auto") localStorage.removeItem("theme");
          else localStorage.setItem("theme", theme);
        } catch {}
        paint();
      });
    }
    paint();
  }

  // Resizable columns. Widths are CSS variables on <html>; the head script restores saved ones
  // before first paint, so this only handles dragging, keys, limits and saving.
  function setUpSplitters(app) {
    const root = document.documentElement;
    const DEFAULT = { rail: 244, list: 440 };
    const MIN = { rail: 190, list: 300 };
    const MAX_RAIL = 380;
    // The colored story card always keeps at least this much room.
    const STAGE_MIN = 440;
    const handles = [...app.querySelectorAll("[data-split]")];
    const sizes = { ...DEFAULT, ...store.get("layout-v1", {}) };

    function apply() {
      const room = app.clientWidth;
      sizes.rail = Math.round(Math.min(Math.max(sizes.rail, MIN.rail), MAX_RAIL));
      const maxList = Math.max(MIN.list, room - sizes.rail - STAGE_MIN);
      sizes.list = Math.round(Math.min(Math.max(sizes.list, MIN.list), maxList));
      root.style.setProperty("--rail-w", `${sizes.rail}px`);
      root.style.setProperty("--list-w", `${sizes.list}px`);
      for (const h of handles) h.setAttribute("aria-valuenow", String(sizes[h.dataset.split]));
    }
    const save = () => store.set("layout-v1", { rail: sizes.rail, list: sizes.list });

    for (const handle of handles) {
      const key = handle.dataset.split;
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const start = sizes[key];
        document.body.classList.add("is-resizing");
        handle.classList.add("is-dragging");
        const move = (ev) => {
          sizes[key] = start + ev.clientX - startX;
          apply();
        };
        const end = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", end);
          document.body.classList.remove("is-resizing");
          handle.classList.remove("is-dragging");
          save();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      });
      handle.addEventListener("dblclick", () => {
        sizes[key] = DEFAULT[key];
        apply();
        save();
      });
      handle.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === "ArrowLeft") sizes[key] -= step;
        else if (e.key === "ArrowRight") sizes[key] += step;
        else if (e.key === "Home") sizes[key] = DEFAULT[key];
        else return;
        e.preventDefault();
        apply();
        save();
      });
    }
    window.addEventListener("resize", apply);
    apply();
  }

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

  function setUpReader(app) {
    const $$ = (sel) => [...app.querySelectorAll(sel)];
    const $ = (sel) => app.querySelector(sel);
    const rows = $$(".row");
    const stories = new Map($$(".story[data-id]").map((el) => [el.dataset.id, el]));
    const stage = $(".stage");
    const stageCard = $(".stage-card");
    const pos = $("[data-pos]");
    const ticks = $("[data-ticks]");
    const focusBtn = $("[data-focus]");
    const endCard = $("[data-end]");
    const upNext = $("[data-up-next]");
    const upNextCards = $("[data-up-next-cards]");
    const viewLinks = $$("[data-view]");
    const viewTitle = document.getElementById("view-title");
    const viewMeta = $("[data-view-meta]");
    const empty = $(".list-empty");
    const search = $("[data-search]");
    const termChips = $$("[data-term]");
    let term = null;
    const editBtn = $("[data-edit-topics]");
    const editHint = $(".edit-hint");
    const nav = $(".views");
    const watchEdit = $("[data-watch-edit]");
    const watchInput = $("[data-watch-input]");
    const permalink = app.dataset.permalink;
    const narrow = matchMedia("(max-width: 900px)");

    const read = new Set(store.get("read-v1", []));
    /** topic id → "pin" | "mute" */
    const prefs = store.get("topics-v1", {});
    /** Words the reader tracks, e.g. ["MCP", "Temporal"]. */
    let watch = store.get("watch-v1", []);
    // Title and summary per story, the text watch words are matched against.
    const storyText = new Map(
      rows.map((row) => {
        const summary = stories.get(row.dataset.id)?.querySelector(".summary")?.textContent ?? "";
        return [row.dataset.id, `${row.querySelector(".row-title").textContent} ${summary}`];
      }),
    );
    let view = "top";
    let order = [];
    let current = null;
    let shownAt = 0;
    let focusObserver = null;

    function paintSaved(id, on = saved.has(id)) {
      const button = stories.get(id)?.querySelector("[data-save]");
      if (button) {
        button.textContent = on ? "Saved" : "Save";
        button.setAttribute("aria-pressed", String(on));
      }
      document.getElementById(`r-${id}`)?.classList.toggle("is-saved", on);
    }

    function toggleSave(id) {
      const row = document.getElementById(`r-${id}`);
      const link = stories.get(id)?.querySelector("[data-open]");
      if (!row || !link) return;
      const list = saved.list();
      if (list.some((s) => s.id === id)) {
        saved.write(list.filter((s) => s.id !== id));
      } else {
        saved.write([
          {
            id,
            title: row.querySelector(".row-title").textContent,
            url: link.href,
            source: row.querySelector(".row-src").textContent,
            color: row.style.getPropertyValue("--c"),
            savedAt: new Date().toISOString(),
          },
          ...list,
        ]);
      }
      paintSaved(id);
    }

    // The phone share sheet where it exists, otherwise copy the link.
    async function share(id) {
      const story = stories.get(id);
      const link = story?.querySelector("[data-open]");
      const button = story?.querySelector("[data-share]");
      if (!link || !button) return;
      try {
        if (navigator.share && matchMedia("(hover: none)").matches) {
          await navigator.share({
            title: story.querySelector(".story-title").textContent.trim(),
            url: link.href,
          });
        } else {
          await navigator.clipboard.writeText(link.href);
          flash(button, "Link copied");
        }
      } catch {}
    }

    function markRead(id) {
      if (!id || read.has(id)) return;
      read.add(id);
      document.getElementById(`r-${id}`)?.classList.add("is-read");
      store.set("read-v1", [...read].slice(-3000));
    }

    // Muted topics leave every view but their own; pinned topics join Top stories in full.
    function inView(row, v) {
      if (v === "watching") return row.dataset.watch !== undefined;
      const topic = row.dataset.topic;
      if (v === topic) return true;
      if (prefs[topic] === "mute") return false;
      const views = row.dataset.views.split(" ");
      return views.includes(v) || (v === "top" && prefs[topic] === "pin");
    }

    function matches(row, words) {
      if (term && !row.dataset.terms.split("|").includes(term)) return false;
      const text = row.textContent.toLowerCase();
      return words.every((w) => text.includes(w));
    }

    // Marks rows whose title or summary contains a watch word, as a whole word, any case.
    function markWatched() {
      const literal = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = watch.map((w) => [
        w,
        new RegExp(`(^|[^\\p{L}\\p{N}])${literal(w)}($|[^\\p{L}\\p{N}])`, "iu"),
      ]);
      for (const row of rows) {
        const hit = patterns.find(([, re]) => re.test(storyText.get(row.dataset.id)));
        // On the row for filtering, and on its source line so CSS attr() can show the word.
        for (const el of [row, row.querySelector(".row-src")]) {
          if (hit) el.dataset.watch = hit[0];
          else delete el.dataset.watch;
        }
      }
    }

    function setWatch(text) {
      watch = [
        ...new Set(
          text
            .split(",")
            .map((w) => w.trim())
            .filter(Boolean),
        ),
      ].slice(0, 30);
      store.set("watch-v1", watch);
      markWatched();
      applyView();
    }

    // A term chip narrows Everything to the stories that mention it; pressing it again clears it.
    function setTerm(next) {
      term = next;
      for (const chip of termChips)
        chip.setAttribute("aria-pressed", String(chip.dataset.term === term));
      if (term && view !== "all") history.replaceState(null, "", "#all");
      applyView(term ? "all" : view);
    }

    function applyView(next = view) {
      view = viewLinks.some((a) => a.dataset.view === next) ? next : "top";
      const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      order = [];
      for (const row of rows) {
        const shown = inView(row, view) && matches(row, words);
        row.hidden = !shown;
        stories.get(row.dataset.id)?.toggleAttribute("data-out", !shown);
        if (shown) order.push(row.dataset.id);
      }
      for (const a of viewLinks) {
        a.setAttribute("aria-current", String(a.dataset.view === view));
        const pref = prefs[a.dataset.topic];
        if (pref) a.dataset.pref = pref;
        else delete a.dataset.pref;
        const em = a.querySelector("em");
        if (em) {
          em.textContent =
            pref === "pin"
              ? "pinned"
              : pref === "mute"
                ? "muted"
                : rows.filter((r) => inView(r, a.dataset.view)).length;
        }
      }
      const label = viewLinks.find((a) => a.dataset.view === view)?.querySelector("span");
      viewTitle.textContent = label?.textContent ?? "Top stories";
      const minutes = Math.max(1, Math.round(order.length / 2));
      viewMeta.textContent = term
        ? `${order.length} mention ${term}`
        : words.length
          ? `${order.length} ${order.length === 1 ? "match" : "matches"}`
          : `${order.length} · about ${minutes} min`;
      empty.hidden = order.length > 0;
      const keep = order.includes(current);
      select(keep ? current : order[0], { scrollStory: isFocus(), link: keep });
    }

    // `link` keeps the address bar on this story (?s=id), so copying it shares the exact story.
    function select(id, { scrollStory = false, link = true } = {}) {
      if (current && current !== id && Date.now() - shownAt > 1500) markRead(current);
      const story = stories.get(id);
      for (const el of stories.values()) el.classList.toggle("is-current", el === story);
      for (const row of rows) row.classList.toggle("is-current", row.dataset.id === id);
      current = id ?? null;
      shownAt = Date.now();
      stageCard.hidden = !story;
      if (!story) {
        upNext.hidden = true;
        return;
      }
      if (link && permalink) history.replaceState(null, "", `${permalink}?s=${id}${location.hash}`);
      stageCard.style.setProperty("--stage", story.style.getPropertyValue("--c"));
      const index = order.indexOf(id);
      pos.textContent = `${index + 1} of ${order.length}`;
      drawTicks(index);
      drawUpNext(index);
      document.getElementById(`r-${id}`)?.scrollIntoView({ block: "nearest" });
      if (scrollStory) story.scrollIntoView({ block: "start" });
    }

    // The next few stories in this view, built from the list rows so there's no second copy of the data.
    function drawUpNext(index) {
      const next = order.slice(index + 1, index + 4);
      upNext.hidden = next.length === 0;
      upNextCards.replaceChildren(
        ...next.map((id) => {
          const row = document.getElementById(`r-${id}`);
          const card = document.createElement("button");
          card.type = "button";
          card.className = "next-card";
          card.dataset.goto = id;
          card.style.setProperty("--c", row.style.getPropertyValue("--c"));
          for (const [cls, from] of [
            ["k", ".row-src"],
            ["t", ".row-title"],
            ["m", ".row-meta"],
          ]) {
            const part = document.createElement("span");
            part.className = cls;
            part.textContent = row.querySelector(from)?.textContent ?? "";
            card.append(part);
          }
          return card;
        }),
      );
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
      if (on === isFocus() || (on && !current)) return;
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

    const editing = () => nav.classList.contains("is-editing");

    function setEditing(on) {
      nav.classList.toggle("is-editing", on);
      editBtn.textContent = on ? "Done" : "Edit";
      editBtn.setAttribute("aria-pressed", String(on));
      editHint.hidden = !on;
      watchEdit.hidden = !on;
      if (on) watchInput.value = watch.join(", ");
    }

    function cyclePref(topic) {
      const next = !prefs[topic] ? "pin" : prefs[topic] === "pin" ? "mute" : undefined;
      if (next) prefs[topic] = next;
      else delete prefs[topic];
      store.set("topics-v1", prefs);
      applyView();
    }

    app.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const rowLink = target.closest(".row-link");
      if (rowLink && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
        e.preventDefault();
        select(rowLink.parentElement.dataset.id);
        if (narrow.matches) setFocus(true);
        return;
      }
      if (target.closest("[data-edit-topics]")) return setEditing(!editing());
      const link = target.closest("[data-view]");
      if (link) {
        e.preventDefault();
        if (editing() && link.dataset.topic) return cyclePref(link.dataset.topic);
        if (link.dataset.view === "watching" && watch.length === 0) {
          setEditing(true);
          return watchInput.focus();
        }
        history.replaceState(null, "", `#${link.dataset.view}`);
        return applyView(link.dataset.view);
      }
      const chip = target.closest("[data-term]");
      if (chip) return setTerm(term === chip.dataset.term ? null : chip.dataset.term);
      const goto = target.closest("[data-goto]");
      if (goto) return select(goto.dataset.goto);
      if (target.closest("[data-next]")) return step(1);
      if (target.closest("[data-save]")) return toggleSave(current);
      if (target.closest("[data-share]")) return share(current);
      if (target.closest("[data-focus]")) return setFocus(!isFocus());
      if (target.closest("[data-open]")) markRead(current);
    });

    watchInput.addEventListener("change", () => setWatch(watchInput.value));
    watchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") watchInput.blur();
    });
    search.addEventListener("input", () => applyView());
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        search.value = "";
        applyView();
        search.blur();
      } else if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        search.blur();
        if (narrow.matches && current) setFocus(true);
      }
    });

    document.addEventListener("keydown", (e) => {
      const typing = e.target.closest?.("input, textarea, select, [data-split]");
      if (e.metaKey || e.ctrlKey || e.altKey || typing) {
        return;
      }
      const keys = {
        j: () => step(1),
        ArrowDown: () => step(1),
        ArrowRight: () => step(1),
        k: () => step(-1),
        ArrowUp: () => step(-1),
        ArrowLeft: () => step(-1),
        o: open,
        s: () => toggleSave(current),
        Enter: () => (e.target.closest?.("a, button") ? null : open()),
        f: () => setFocus(!isFocus()),
        "/": () => {
          setFocus(false);
          search.focus();
          search.select();
        },
        Escape: () => {
          if (isFocus()) return setFocus(false);
          if (term) return setTerm(null);
          setEditing(false);
        },
      };
      const action = keys[e.key];
      if (!action) return;
      if (action() !== null) e.preventDefault();
    });

    window.addEventListener("hashchange", () => applyView(location.hash.slice(1)));

    const savedIds = new Set(saved.list().map((s) => s.id));
    for (const row of rows) {
      if (read.has(row.dataset.id)) row.classList.add("is-read");
      paintSaved(row.dataset.id, savedIds.has(row.dataset.id));
    }
    markWatched();
    applyView(location.hash.slice(1) || "top");

    // A link to one story (?s=id) opens it, switching to Everything if the view hides it.
    const wanted = new URLSearchParams(location.search).get("s");
    if (wanted && stories.has(wanted)) {
      if (!order.includes(wanted)) applyView("all");
      select(wanted);
      if (narrow.matches) setFocus(true);
    }
  }
})();
