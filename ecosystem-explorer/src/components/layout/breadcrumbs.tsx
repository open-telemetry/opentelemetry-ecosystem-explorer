import { Link, useLocation } from "react-router-dom";

function titleForSegment(segment: string) {
  if (!segment) return "Home";
  const map: Record<string, string> = {
    "java-agent": "Java Agent",
    collector: "Collector",
    instrumentation: "Instrumentation",
    configuration: "Configuration",
    about: "About",
  };
  return map[segment] ?? segment.replace(/-/g, " ");
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const items = [
    { href: "/", label: "Home" },
    ...segments.map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label: titleForSegment(segment),
    })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="bg-background/90 border-b border-border/20">
      <div className="mx-auto max-w-screen-2xl px-6">
        <ol className="flex gap-2 py-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={item.href} className="inline-flex items-center">
              {index > 0 && <span className="mx-2 text-muted-foreground">/</span>}
              <Link to={item.href} className="hover:underline text-muted-foreground">
                {item.label}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export default Breadcrumbs;
