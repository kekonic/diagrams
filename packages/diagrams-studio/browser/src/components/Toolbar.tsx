import { Download, Moon, PanelRight, Share2, Sun } from "lucide-react";
import { IconButton } from "./IconButton.tsx";
import type { StudioOptions } from "../lib/buildRenderOptions.ts";
import type { StudioConnection } from "../state/useConnectedStudio.ts";

const BRAND_MARK =
  "M12.46 6.2H19.46V19.02L30.64 5.7L35.54 9.82L19.46 24L35.54 38.18L30.64 42.3L19.46 28.98V41.8H12.46Z";

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
        <svg className="brand-mark" viewBox="0 0 48 48" width={20} height={20} aria-hidden>
          <path fill="currentColor" d={BRAND_MARK} />
        </svg>
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
