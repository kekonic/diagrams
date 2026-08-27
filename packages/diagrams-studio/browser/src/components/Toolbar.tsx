import { Download, Moon, PanelRight, Share2, Sun } from "lucide-react";
import { IconButton } from "./IconButton.tsx";
import type { StudioOptions } from "../lib/buildRenderOptions.ts";
import type { StudioConnection } from "../state/useConnectedStudio.ts";
import brandMark from "../assets/kekonic-diagrams-symbol.svg?url";

type Props = {
  product: string;
  theme: StudioOptions["theme"];
  connection?: StudioConnection;
  onToggleTheme: () => void;
  onExport: () => void;
  onShare: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
};

export function Toolbar({
  product,
  theme,
  connection,
  onToggleTheme,
  onExport,
  onShare,
  onToggleSidebar,
  sidebarOpen,
}: Props) {
  return (
    <header className="toolbar">
      <div className="brand">
        <img className="brand-mark" src={brandMark} width={26} height={20} alt="" />
        <h1>Kekonic</h1>
        <span className="tag">{product}</span>
      </div>

      {connection ? (
        <span className="connection-status" data-connected={connection.connected}>
          {connection.label}
        </span>
      ) : null}

      <div className="toolbar-spacer" />

      <div className="toolbar-actions">
        <IconButton icon={Download} label="Export SVG" onClick={onExport} />
        <IconButton icon={Share2} label="Share" onClick={onShare} />

        <IconButton
          icon={theme === "dark" ? Moon : Sun}
          iconOnly
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Dark — click for light" : "Light — click for dark"}
          onClick={onToggleTheme}
        />

        <IconButton
          icon={PanelRight}
          iconOnly
          label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          active={sidebarOpen}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        />
      </div>
    </header>
  );
}
