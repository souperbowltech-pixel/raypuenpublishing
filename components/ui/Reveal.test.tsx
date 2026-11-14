import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Reveal } from "@/components/ui/Reveal";
import { Spinner } from "@/components/ui/Spinner";

describe("Reveal", () => {
  const html = renderToStaticMarkup(
    <Reveal className="grid gap-4">
      <p>First</p>
      <p>Second</p>
    </Reveal>
  );

  it("sends every child from the server, visible, with no hiding state", () => {
    expect(html).toBe('<div class="grid gap-4"><p>First</p><p>Second</p></div>');
    expect(html).not.toContain("data-reveal");
    expect(html).not.toMatch(/opacity/);
  });
});

describe("Spinner", () => {
  const html = renderToStaticMarkup(<Spinner className="h-4 w-4 text-paper" />);

  it("spins and is hidden from screen readers, which read the button text instead", () => {
    expect(html).toContain('class="animate-spin h-4 w-4 text-paper"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("has a default size", () => {
    expect(renderToStaticMarkup(<Spinner />)).toContain('class="animate-spin h-5 w-5"');
  });
});
