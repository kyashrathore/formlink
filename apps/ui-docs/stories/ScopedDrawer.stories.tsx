import type { Meta, StoryObj } from "@storybook/react";
// Minimal play function utils without extra deps
import React from "react";

import {
  Button,
  ScopedDrawer,
  ScopedDrawerClose,
  ScopedDrawerContent,
  ScopedDrawerHeader,
  ScopedDrawerOverlay,
  ScopedDrawerPortal,
  ScopedDrawerTitle,
} from "@formlink/ui";

const meta: Meta = {
  title: "UI/ScopedDrawer",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const StoryExample: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  const Overlay = ScopedDrawerOverlay as any;
  const Content = ScopedDrawerContent as any;
  const Title = ScopedDrawerTitle as any;
  const Close = ScopedDrawerClose as any;
  const Header = ScopedDrawerHeader as any;
  const Portal = ScopedDrawerPortal as any;

  return (
    <div className="flex min-h-screen overflow-hidden rounded-lg border shadow-sm">
      <div className="flex w-[320px] flex-col gap-4 border-r bg-muted/40 p-6">
        <div>
          <p className="text-sm font-semibold">Left Panel</p>
          <p className="text-muted-foreground text-xs">
            Content remains fully interactive while the drawer is open.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Open Drawer</Button>
        <textarea
          className="min-h-[120px] rounded-md border bg-background p-2 text-sm"
          placeholder="Try focusing and typing here while the drawer is open"
        />
        <Button variant="outline">Another Action</Button>
      </div>
      <div id="right-panel-root" className="relative flex-1 bg-background p-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Right Panel</p>
          <p className="text-muted-foreground text-xs">
            The drawer portal mounts inside this container and the overlay only
            covers this region.
          </p>
        </div>

        <ScopedDrawer
          modal={false}
          open={open}
          onOpenChange={(state: boolean) => setOpen(state)}
        >
          <Portal>
            <Overlay />
            <Content className="w-[360px] max-w-full border-l bg-background p-4 shadow-xl">
              <Header className="border-b pb-3">
                <Title className="text-base font-semibold">Scoped Drawer</Title>
              </Header>

              <div className="space-y-4 py-4 text-sm">
                <p>
                  Clicking anywhere in the left panel should not close the
                  drawer, but the controls remain interactive.
                </p>
                <Button onClick={() => alert("Primary action")}>
                  Primary action
                </Button>
                <Button variant="outline" onClick={() => alert("Secondary")}>
                  Secondary
                </Button>
              </div>

              <div className="flex justify-end border-t pt-3">
                <Close asChild>
                  <Button variant="ghost">Close</Button>
                </Close>
              </div>
            </Content>
          </Portal>
        </ScopedDrawer>
      </div>
    </div>
  );
};

export const Playground: Story = {
  render: () => <StoryExample />,
  play: async ({ canvasElement }) => {
    // Click the "Open Drawer" button in the canvas
    const buttons = Array.from(
      canvasElement.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    const openBtn = buttons.find((b) =>
      /open drawer/i.test(b.textContent || ""),
    );
    if (!openBtn) throw new Error("Open Drawer button not found");
    openBtn.click();

    // Poll for overlay element to appear and be visible
    const start = Date.now();
    const timeoutMs = 2000;
    while (Date.now() - start < timeoutMs) {
      const overlay = document.querySelector(
        '[data-slot="scoped-drawer-overlay"]',
      ) as HTMLElement | null;
      if (overlay && overlay.offsetWidth > 0 && overlay.offsetHeight > 0) {
        const cs = getComputedStyle(overlay);
        if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Scoped drawer overlay did not appear or was transparent");
  },
};
