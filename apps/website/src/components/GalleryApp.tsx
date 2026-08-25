"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KDiagramLive } from "@kekonic/diagrams-ui";
import {
  CLUSTER_LABELS,
  CLUSTER_ORDER,
  DEFAULT_GALLERY_EXAMPLE,
  exampleById,
  galleryPath,
  type GalleryCluster,
  type GalleryExample,
} from "../data/gallery-catalog.ts";
import { galleryStudioHref } from "../data/gallery-studio.ts";

export type GalleryFilter = GalleryCluster | "all";

type Props = {
  examples: GalleryExample[];
  sources: Record<string, string>;
  thumbs: Record<string, string>;
  initialId: string;
  initialFilter?: GalleryFilter;
};

function exampleIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/gallery\/([^/]+)\/?$/);
  if (!match?.[1]) return undefined;
  return exampleById(match[1])?.id;
}

function pageTitle(example: GalleryExample): string {
  return `${example.title} · Gallery | Kekonic Diagrams`;
}

function isModifiedClick(event: React.MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function GalleryApp({ examples, sources, thumbs, initialId, initialFilter }: Props) {
  const start = exampleById(initialId) ?? exampleById(DEFAULT_GALLERY_EXAMPLE) ?? examples[0];
  const [selectedId, setSelectedId] = useState(start?.id ?? DEFAULT_GALLERY_EXAMPLE);
  const [filter, setFilter] = useState<GalleryFilter>(initialFilter ?? start?.cluster ?? "all");
  const listRef = useRef<HTMLDivElement>(null);

  const selected = exampleById(selectedId) ?? start;
  const filtered = useMemo(() => {
    if (filter === "all") return examples;
    return examples.filter((item) => item.cluster === filter);
  }, [examples, filter]);

  const selectedIndex = filtered.findIndex((item) => item.id === selected?.id);

  const selectExample = useCallback(
    (id: string, options?: { filter?: GalleryFilter; history?: "push" | "replace" | "none" }) => {
      const example = exampleById(id);
      if (!example) return;
      setSelectedId(example.id);
      if (options?.filter) setFilter(options.filter);
      else if (filter !== "all" && example.cluster !== filter) setFilter(example.cluster);
      if (options?.history === "none") return;
      const href = galleryPath(example.id);
      const method = options?.history === "replace" ? "replaceState" : "pushState";
      window.history[method]({ galleryExample: example.id }, "", href);
      document.title = pageTitle(example);
    },
    [filter],
  );

  useEffect(() => {
    const onPop = () => {
      const fromPath = exampleIdFromPath(window.location.pathname);
      if (fromPath) {
        const example = exampleById(fromPath);
        if (!example) return;
        setSelectedId(example.id);
        setFilter((current) => (current === "all" ? current : example.cluster));
        document.title = pageTitle(example);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current='page']");
    if (!list || !active) return;
    const scroller = list.closest<HTMLElement>(".kd-gallery-app__nav") ?? list;
    const frame = window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 960px)").matches) {
        active.scrollIntoView({ inline: "center", block: "nearest" });
        return;
      }
      const scrollerBox = scroller.getBoundingClientRect();
      const activeBox = active.getBoundingClientRect();
      scroller.scrollTop += activeBox.top - scrollerBox.top - scrollerBox.height / 3;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, filter]);

  if (!selected) return null;

  const source = sources[selected.id] ?? "";
  const animated = source.includes("animation ");
  const studioHref = galleryStudioHref(source);

  const onExampleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    selectExample(id);
  };

  const onFilter = (nextFilter: GalleryFilter) => {
    setFilter(nextFilter);
    if (nextFilter !== "all") {
      const inCluster = examples.filter((item) => item.cluster === nextFilter);
      if (!inCluster.some((item) => item.id === selectedId) && inCluster[0]) {
        selectExample(inCluster[0].id, { filter: nextFilter });
      }
    }
  };

  const filters: GalleryFilter[] = ["all", ...CLUSTER_ORDER];

  const onFilterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const index = filters.indexOf(filter);
    let nextIndex = Math.max(0, index);
    if (event.key === "ArrowRight") nextIndex = (nextIndex + 1) % filters.length;
    if (event.key === "ArrowLeft") nextIndex = (nextIndex - 1 + filters.length) % filters.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = filters.length - 1;
    const nextFilter = filters[nextIndex];
    if (nextFilter) onFilter(nextFilter);
    const chip = event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[nextIndex];
    chip?.focus();
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return;
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    let index = Math.max(0, selectedIndex);
    if (event.key === "ArrowDown") index = (index + 1) % filtered.length;
    if (event.key === "ArrowUp") index = (index - 1 + filtered.length) % filtered.length;
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = filtered.length - 1;
    const target = filtered[index];
    if (!target) return;
    selectExample(target.id);
    const link = listRef.current?.querySelector<HTMLAnchorElement>(
      `a[data-example='${target.id}']`,
    );
    link?.focus();
  };

  const groups =
    filter === "all"
      ? CLUSTER_ORDER.map((cluster) => ({
          cluster,
          label: CLUSTER_LABELS[cluster],
          items: examples.filter((item) => item.cluster === cluster),
        })).filter((group) => group.items.length > 0)
      : [
          {
            cluster: filter,
            label: CLUSTER_LABELS[filter],
            items: filtered,
          },
        ];

  return (
    <div className="kd-gallery-app not-content">
      <header className="kd-gallery-app__header">
        <div className="kd-gallery-app__intro">
          <h1 id="_top" className="kd-gallery-app__title">
            Gallery
          </h1>
          <p className="kd-gallery-app__lede">
            Browse diagrams by category. Open one in Studio when you want to edit.
          </p>
        </div>
        <div
          className="kd-gallery-app__filters"
          role="group"
          aria-label="Example categories"
          onKeyDown={onFilterKeyDown}
        >
          <FilterChip selected={filter === "all"} onSelect={() => onFilter("all")} label="All" />
          {CLUSTER_ORDER.map((cluster) => (
            <FilterChip
              key={cluster}
              selected={filter === cluster}
              onSelect={() => onFilter(cluster)}
              label={CLUSTER_LABELS[cluster]}
            />
          ))}
        </div>
      </header>

      <div className="kd-gallery-app__body">
        <nav className="kd-gallery-app__nav" aria-label="Examples">
          <div ref={listRef} className="kd-gallery-app__list" onKeyDown={onListKeyDown}>
            {groups.map((group) => (
              <div key={group.cluster} className="kd-gallery-app__group">
                {filter === "all" ? (
                  <h2 className="kd-gallery-app__group-title">{group.label}</h2>
                ) : null}
                {group.items.map((item) => {
                  const isCurrent = item.id === selected.id;
                  return (
                    <a
                      key={item.id}
                      id={`gallery-opt-${item.id}`}
                      data-example={item.id}
                      href={galleryPath(item.id)}
                      className={
                        isCurrent
                          ? "kd-gallery-app__item kd-gallery-app__item--current"
                          : "kd-gallery-app__item"
                      }
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={(event) => onExampleClick(event, item.id)}
                    >
                      <div
                        className="kd-gallery-app__thumb"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: thumbs[item.id] ?? "" }}
                      />
                      <span className="kd-gallery-app__item-copy">
                        <strong>{item.title}</strong>
                        <span>{item.blurb}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <section className="kd-gallery-app__stage" aria-labelledby="kd-gallery-example-title">
          <div className="kd-gallery-app__stage-head">
            <div className="kd-gallery-app__meta">
              <p className="kd-gallery-app__kicker">{CLUSTER_LABELS[selected.cluster]}</p>
              <h2 id="kd-gallery-example-title" className="kd-gallery-app__example-title">
                {selected.title}
                {animated ? <span className="kd-gallery-app__badge">Animated</span> : null}
              </h2>
              <p className="kd-gallery-app__blurb">{selected.blurb}</p>
            </div>
            <a className="kd-cta kd-cta--primary kd-gallery-app__studio" href={studioHref}>
              Open in Studio
            </a>
          </div>

          <div className="kd-gallery-app__view">
            <KDiagramLive
              key={selected.id}
              source={source}
              theme="auto"
              height="min(78vh, 820px)"
              showThemeToggle={true}
              showViewControls={true}
              showAnimationControls={true}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterChip({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        selected ? "kd-gallery-app__chip kd-gallery-app__chip--on" : "kd-gallery-app__chip"
      }
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
