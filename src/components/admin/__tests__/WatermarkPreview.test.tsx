import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { CoverWithWatermark, WATERMARK_GEOMETRY } from "@/components/admin/WatermarkPreview";

/**
 * Guardrails visuais: a marca d'água precisa renderizar com exatamente as
 * mesmas regras geométricas em ambas as capas, mesmo quando as imagens de
 * origem têm proporções (vertical/quadrada/widescreen) muito diferentes.
 *
 * Como o jsdom não roda layout, validamos as classes/styles que governam o
 * posicionamento — todas baseadas no container 16:9 do wrapper, não na
 * imagem subjacente — e na presença de `aspect-video` no link.
 */

const watermark = {
  enabled: true,
  text: "Plataforma Demo",
  logoUrl: "https://example.com/logo.png",
};

const renderPair = () => {
  // src1: imagem vertical alta; src2: imagem ultrawide. Não importa o
  // arquivo de fato — só queremos provar que o overlay independe da imagem.
  render(
    <>
      <CoverWithWatermark
        src="https://example.com/vertical-1080x1920.jpg"
        alt="vídeo"
        watermark={watermark}
        testId="cover-video"
      />
      <CoverWithWatermark
        src="https://example.com/ultrawide-2560x1080.jpg"
        alt="carrossel"
        watermark={watermark}
        testId="cover-carousel"
      />
    </>
  );
  return {
    video: screen.getByTestId("cover-video"),
    carousel: screen.getByTestId("cover-carousel"),
  };
};

describe("CoverWithWatermark", () => {
  it("ambos os wrappers usam aspect-video 16:9 (independente da imagem)", () => {
    const { video, carousel } = renderPair();
    expect(video.className).toContain("aspect-video");
    expect(carousel.className).toContain("aspect-video");
  });

  it("ambos os overlays compartilham exatamente a mesma classe de posicionamento", () => {
    const { video, carousel } = renderPair();
    const vOverlay = within(video).getByTestId("watermark-overlay");
    const cOverlay = within(carousel).getByTestId("watermark-overlay");
    expect(vOverlay.className).toBe(cOverlay.className);
  });

  it("o bloco interno (logo+texto) usa as mesmas regras de tamanho/padding", () => {
    const { video, carousel } = renderPair();
    const vInner = within(video).getByTestId("watermark-inner");
    const cInner = within(carousel).getByTestId("watermark-inner");

    // Mesmas classes utilitárias.
    expect(vInner.className).toBe(cInner.className);

    // jsdom não reconhece unidades de container queries (cqh/cqw) e remove o
    // valor de `style.*`, então comparamos via atributo `style` cru, que é o
    // que de fato é entregue ao navegador.
    const vStyle = vInner.getAttribute("style") || "";
    const cStyle = cInner.getAttribute("style") || "";
    expect(vStyle).toBe(cStyle);
    expect(vStyle).toContain(`padding-right: ${WATERMARK_GEOMETRY.paddingCqh}cqh`);
    expect(vStyle).toContain(`padding-bottom: ${WATERMARK_GEOMETRY.paddingCqh}cqh`);
    expect(vStyle).toContain(`height: ${WATERMARK_GEOMETRY.heightCqh}cqh`);
    expect(vStyle).toContain(`gap: ${WATERMARK_GEOMETRY.gapCqw}cqw`);
  });

  it("o texto da marca d'água usa fontSize idêntico baseado no container", () => {
    const { video, carousel } = renderPair();
    const vText = within(video).getByTestId("watermark-text");
    const cText = within(carousel).getByTestId("watermark-text");
    const vStyle = vText.getAttribute("style") || "";
    const cStyle = cText.getAttribute("style") || "";
    expect(vStyle).toBe(cStyle);
    expect(vStyle).toContain(`font-size: ${WATERMARK_GEOMETRY.fontSizeCqh}cqh`);
  });

  it("não renderiza o overlay quando a marca d'água está desativada", () => {
    render(
      <CoverWithWatermark
        src="https://example.com/x.jpg"
        alt="x"
        watermark={{ enabled: false, text: "X", logoUrl: "https://x" }}
        testId="cover-disabled"
      />
    );
    expect(
      within(screen.getByTestId("cover-disabled")).queryByTestId("watermark-overlay")
    ).toBeNull();
  });

  it("não renderiza o overlay quando não há texto nem logo configurados", () => {
    render(
      <CoverWithWatermark
        src="https://example.com/x.jpg"
        alt="x"
        watermark={{ enabled: true, text: "", logoUrl: "" }}
        testId="cover-empty"
      />
    );
    expect(
      within(screen.getByTestId("cover-empty")).queryByTestId("watermark-overlay")
    ).toBeNull();
  });
});
