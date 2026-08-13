"use strict";

(() => {
  const input = document.querySelector("#input_reviewer_demo");
  const nativeValue = document.querySelector("#nativeValue");
  const status = document.querySelector("#demoStatus");

  function renderNativeValue() {
    nativeValue.textContent = input.value || "Empty";
  }

  function enterExpression(expression) {
    input.value = expression;
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: expression,
      inputType: "insertText",
    }));
    input.focus();
    renderNativeValue();
  }

  input.addEventListener("input", renderNativeValue);
  document.querySelectorAll("[data-expression]").forEach((button) => {
    button.addEventListener("click", () => enterExpression(button.dataset.expression));
  });

  const readinessCheck = window.setInterval(() => {
    if (input.dataset.psetMathEnhanced !== "true") return;
    window.clearInterval(readinessCheck);
    status.textContent = "Editor ready";
    status.classList.add("is-ready");
    input.focus();
    window.setTimeout(() => {
      const trigger = document.querySelector(".pset-math-trigger");
      if (trigger?.getAttribute("aria-pressed") === "false") trigger.click();
    }, 0);
  }, 50);

  window.setTimeout(() => {
    if (input.dataset.psetMathEnhanced === "true") return;
    window.clearInterval(readinessCheck);
    status.textContent = "Editor did not start";
  }, 5000);

  renderNativeValue();
})();
