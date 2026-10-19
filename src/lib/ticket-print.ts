let printing = false;

/** Measure the rendered receipt instead of relying on an invalid `size: Nmm auto`. */
export async function printThermalTicket(width: 58 | 80): Promise<void> {
  if (printing) return;
  const className = width === 58 ? "print-ticket58" : "print-ticket";
  const root = document.querySelector<HTMLElement>(width === 58 ? ".ticket58-print-root" : ".ticket-print-root");
  if (!root) return;
  printing = true;
  const pageStyle = document.createElement("style");
  const cleanup = () => {
    document.body.classList.remove(className);
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
    printing = false;
  };
  try {
    // Hidden print copies must be laid out before measuring their full height.
    root.style.display = "block";
    try {
      await Promise.race([
        Promise.all([
          document.fonts.ready,
          ...Array.from(root.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)),
        ]),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
      const ticket = root.querySelector<HTMLElement>(".ticket-80") ?? root;
      const heightMm = Math.ceil(Math.max(ticket.scrollHeight, ticket.getBoundingClientRect().height) * 25.4 / 96) + 2;
      // Also set the default page for print engines that ignore named pages.
      pageStyle.textContent = `@page { size: ${width}mm ${heightMm}mm; margin: 0; } @page ticket-${width} { size: ${width}mm ${heightMm}mm; margin: 0; }`;
    } finally {
      root.style.removeProperty("display");
    }
    document.head.append(pageStyle);
    document.body.classList.add(className);
    window.addEventListener("afterprint", cleanup);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}