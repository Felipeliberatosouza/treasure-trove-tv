import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks --------------------------------------------------------------

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ role: "visitor", user: null }),
}));

const longTitle =
  "Plataformaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa de Revisão Inteligenteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const longSubtitle =
  "Estudeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee comoooooooooooooooooooooo nuncaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa antes com conteudoexcepcionalmenteextensoesemespacosparatestarquebra https://exemplo.com/uma-url-muito-muito-muito-longa-que-precisa-quebrar-em-telas-pequenas";

const slide = {
  title: longTitle,
  subtitle: longSubtitle,
  cta_text: "Comece Agora",
  cta_link: "/explore",
  color_scheme: "light" as const,
};

vi.mock("@/hooks/usePlatformSettings", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlatformSettings")>(
    "@/hooks/usePlatformSettings"
  );
  return {
    ...actual,
    usePlatformSettings: () => ({
      data: { slides: [slide], autoplay_seconds: 8, enabled: true },
      loading: false,
      refresh: () => {},
    }),
  };
});

vi.mock("@/data/courses", () => ({
  getFeaturedVideo: () => ({
    id: "abc",
    title: "Aula",
    description: "Desc",
    lessons: 10,
    duration: "2h",
  }),
}));

import HeroBanner from "../HeroBanner";
import SecondaryBanner from "../SecondaryBanner";

const VIEWPORTS = [320, 360, 375, 414, 768, 1024, 1280, 1366, 1440, 1920];

const setViewport = (w: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
  window.dispatchEvent(new Event("resize"));
};

const renderHero = () =>
  render(
    <MemoryRouter>
      <HeroBanner onVideoClick={() => {}} onExploreClick={() => {}} />
    </MemoryRouter>
  );

const renderSecondary = () =>
  render(
    <MemoryRouter>
      <SecondaryBanner />
    </MemoryRouter>
  );

/**
 * Wrapping contract: every text node that can receive long user-generated
 * content must declare the responsive wrapping classes that prevent
 * horizontal overflow. jsdom doesn't run layout, so we validate the CSS
 * contract that produces the visual behavior across breakpoints.
 */
const WRAP_CLASSES = ["break-words", "hyphens-auto", "[overflow-wrap:anywhere]"];

const assertWrapping = (el: HTMLElement | null) => {
  expect(el).not.toBeNull();
  const cls = el!.className;
  for (const c of WRAP_CLASSES) {
    expect(cls, `expected "${c}" on <${el!.tagName.toLowerCase()}>`).toContain(c);
  }
};

describe("HeroBanner responsiveness", () => {
  beforeEach(() => setViewport(1280));

  for (const w of VIEWPORTS) {
    it(`renders without overflow contract violations at ${w}px`, () => {
      setViewport(w);
      const { container, unmount } = renderHero();

      const section = container.querySelector("section");
      expect(section?.className).toContain("overflow-hidden");
      expect(section?.className).toContain("w-full");

      assertWrapping(container.querySelector("h1"));
      assertWrapping(container.querySelector("p"));

      // The text column must allow flex-shrink (min-w-0) so it can wrap
      // instead of pushing the viewport.
      const motionCol = container.querySelector("h1")?.parentElement;
      expect(motionCol?.className).toContain("min-w-0");

      unmount();
    });
  }
});

describe("SecondaryBanner responsiveness", () => {
  beforeEach(() => setViewport(1280));

  for (const w of VIEWPORTS) {
    it(`renders without overflow contract violations at ${w}px`, () => {
      setViewport(w);
      const { container, unmount } = renderSecondary();

      const section = container.querySelector("section");
      expect(section?.className).toContain("overflow-hidden");
      expect(section?.className).toContain("w-full");

      assertWrapping(container.querySelector("h2"));
      assertWrapping(container.querySelector("p"));

      const inner = container.querySelector("h2")?.parentElement;
      expect(inner?.className).toContain("min-w-0");
      expect(inner?.className).toContain("w-full");

      unmount();
    });
  }
});