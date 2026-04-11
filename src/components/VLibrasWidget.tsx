import { useEffect } from "react";

const VLibrasWidget = () => {
  useEffect(() => {
    // Create widget container
    const container = document.createElement("div");
    container.setAttribute("vw", "");
    container.className = "enabled";
    container.innerHTML = `
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    `;
    document.body.appendChild(container);

    // Load script
    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = () => {
      if ((window as any).VLibras) {
        new (window as any).VLibras.Widget("https://vlibras.gov.br/app");
      }
    };
    document.body.appendChild(script);

    return () => {
      container.remove();
      script.remove();
      // Remove any VLibras injected elements
      document.querySelectorAll("[vw]").forEach((el) => el.remove());
    };
  }, []);

  return null;
};

export default VLibrasWidget;
