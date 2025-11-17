(() => {
  const alertContainer = document.getElementById("global-alert-container");
  const loadingOverlay = document.getElementById("global-loading-overlay");

  const setOverlayVisible = (visible) => {
    if (!loadingOverlay) return;
    loadingOverlay.classList.toggle("d-none", !visible);
    loadingOverlay.classList.toggle("d-flex", visible);
  };

  const toggleFormLoadingState = (form, isLoading) => {
    if (!(form instanceof HTMLFormElement)) return;
    const submitButton = form.querySelector("[data-loading-button]");
    if (submitButton) {
      submitButton.disabled = isLoading;
      const label = submitButton.querySelector("[data-loading-label]");
      const spinner = submitButton.querySelector("[data-loading-spinner]");
      if (label) {
        label.classList.toggle("d-none", isLoading);
      }
      if (spinner) {
        spinner.classList.toggle("d-none", !isLoading);
      }
    }

    if (form.dataset.loadingOverlay !== "false") {
      setOverlayVisible(isLoading);
    }
  };

  const showAlert = (message, type = "danger") => {
    if (!alertContainer || !message) return;
    const alert = document.createElement("div");
    alert.className = `toast align-items-center text-bg-${type} border-0 shadow`;
    alert.setAttribute("role", "alert");
    alert.setAttribute("aria-live", "assertive");
    alert.setAttribute("aria-atomic", "true");
    alert.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
    `;
    alertContainer.appendChild(alert);

    const toastConstructor = window.bootstrap?.Toast;
    if (toastConstructor) {
      const toast = toastConstructor.getOrCreateInstance(alert, { delay: 5000 });
      toast.show();
    } else {
      alert.classList.add("show");
      setTimeout(() => {
        alert.classList.remove("show");
        alert.remove();
      }, 5000);
    }
  };

  const handleApiResponse = (xhr) => {
    if (!xhr) return;
    const contentType = xhr.getResponseHeader("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      return;
    }

    try {
      const payload = JSON.parse(xhr.responseText);
      if (payload?.message) {
        const alertType = payload.error ? "danger" : payload.success ? "success" : "info";
        showAlert(payload.message, alertType);
      }
    } catch (error) {
      console.error("Não foi possível interpretar a resposta da API", error);
    }
  };

  const resolveForm = (element) => {
    if (!element) return null;
    if (element instanceof HTMLFormElement) return element;
    return element.closest("form");
  };

  document.addEventListener("submit", (event) => {
    const form = resolveForm(event.target);
    if (!form) return;
    toggleFormLoadingState(form, true);
  });

  document.body.addEventListener("htmx:beforeRequest", (event) => {
    const { elt } = event.detail;
    const form = resolveForm(elt);
    if (form) {
      toggleFormLoadingState(form, true);
    }
  });

  document.body.addEventListener("htmx:afterRequest", (event) => {
    const { elt, xhr } = event.detail;
    const form = resolveForm(elt);
    if (form) {
      toggleFormLoadingState(form, false);
    }
    handleApiResponse(xhr);
  });

  document.body.addEventListener("htmx:sendError", (event) => {
    const { elt, error } = event.detail;
    const form = resolveForm(elt);
    if (form) {
      toggleFormLoadingState(form, false);
    }
    console.error("Falha ao enviar requisição HTMX", error);
    showAlert("Não foi possível enviar sua solicitação. Verifique sua conexão e tente novamente.");
  });

  document.body.addEventListener("htmx:responseError", (event) => {
    const { elt, xhr } = event.detail;
    const form = resolveForm(elt);
    if (form) {
      toggleFormLoadingState(form, false);
    }
    handleApiResponse(xhr);
    showAlert("Ocorreu um erro ao processar a requisição.");
  });

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action='toggle-answer']");
    if (!actionButton) {
      return;
    }

    const targetSelector = actionButton.getAttribute("data-target");
    if (!targetSelector) return;

    const answerContainer = document.querySelector(targetSelector);
    if (!answerContainer) return;

    const isHidden = answerContainer.classList.toggle("d-none");
    actionButton.setAttribute("aria-expanded", String(!isHidden));
    actionButton.querySelector("[data-visible-label]")?.classList.toggle("d-none", !isHidden);
    actionButton.querySelector("[data-hidden-label]")?.classList.toggle("d-none", isHidden);
  });

  window.AppUI = {
    showAlert,
  };
})();
