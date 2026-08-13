import type { RenderResult } from "@kekonic/diagrams";
import type { SourceRange } from "@kekonic/diagrams-core";

type Props = {
  diagnostics: RenderResult["diagnostics"] | undefined;
  onReveal: (range: SourceRange) => void;
};

export function DiagnosticsList({ diagnostics, onReveal }: Props) {
  if (!diagnostics || diagnostics.length === 0) {
    return <div className="diag diag-ok">No diagnostics</div>;
  }

  return (
    <>
      {diagnostics.map((d, i) => (
        <button
          type="button"
          key={`${d.code}-${i}`}
          className={`diag diag-action diag-${d.severity}`}
          onClick={() => onReveal(d.range)}
        >
          <strong>{d.severity}</strong> <code>{d.code}</code> {d.message}
          {d.hint ? <span className="hint"> — {d.hint}</span> : null}
        </button>
      ))}
    </>
  );
}
