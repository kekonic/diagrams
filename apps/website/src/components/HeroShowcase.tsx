"use client";

import { useState } from "react";
import { KDiagramLive } from "@kekonic/diagrams-ui";

export type HeroTab = {
  id: string;
  label: string;
  source: string;
  href: string;
};

type Props = {
  tabs: HeroTab[];
  height?: number;
};

export function HeroShowcase({ tabs, height = 480 }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="kd-hero-showcase">
      <div className="kd-hero-showcase__tabs" role="tablist" aria-label="Example diagrams">
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? "kd-hero-showcase__tab kd-hero-showcase__tab--active"
                  : "kd-hero-showcase__tab"
              }
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
        <a className="kd-hero-showcase__more" href={current.href}>
          Open in Gallery
        </a>
      </div>
      <div className="kd-hero-showcase__stage" role="tabpanel">
        <KDiagramLive
          source={current.source}
          theme="auto"
          showThemeToggle={true}
          showViewControls={true}
          height={height}
        />
      </div>
    </div>
  );
}
