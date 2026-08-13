import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

type AccordionContextValue = {
  type: "single" | "multiple";
  open: Set<string>;
  toggle: (value: string) => void;
  baseId: string;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(component: string): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error(`${component} must be used within <Accordion>`);
  return ctx;
}

type AccordionProps = {
  type?: "single" | "multiple";
  /** Values open by default. */
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string[]) => void;
  children: ReactNode;
  className?: string;
};

function toSet(value: string | string[] | undefined): Set<string> {
  if (value == null) return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

export function Accordion({
  type = "multiple",
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = useState(() => toSet(defaultValue));
  const open = controlled != null ? toSet(controlled) : uncontrolled;
  const baseId = useId();

  const toggle = useCallback(
    (item: string) => {
      const next = new Set(open);
      if (next.has(item)) next.delete(item);
      else {
        if (type === "single") next.clear();
        next.add(item);
      }
      if (controlled == null) setUncontrolled(next);
      onValueChange?.([...next]);
    },
    [controlled, onValueChange, open, type],
  );

  const ctx = useMemo(() => ({ type, open, toggle, baseId }), [type, open, toggle, baseId]);

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={className ? `accordion ${className}` : "accordion"}>{children}</div>
    </AccordionContext.Provider>
  );
}

type AccordionItemProps = {
  value: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AccordionItem({ value, title, children, className }: AccordionItemProps) {
  const { open, toggle, baseId } = useAccordion("AccordionItem");
  const isOpen = open.has(value);
  const panelId = `${baseId}-panel-${value}`;
  const headerId = `${baseId}-header-${value}`;

  return (
    <div
      className={className ? `accordion-item ${className}` : "accordion-item"}
      data-state={isOpen ? "open" : "closed"}
    >
      <h3 className="accordion-heading">
        <button
          type="button"
          id={headerId}
          className="accordion-trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => toggle(value)}
        >
          <span className="accordion-title">{title}</span>
          <ChevronDown size={14} strokeWidth={1.75} className="accordion-chevron" aria-hidden />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="accordion-panel"
        hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
