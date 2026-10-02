/* Shared same-origin API client, CSRF handling, and authenticated navigation. */
(function () {
  "use strict";

  var csrfToken = null;
  var currentUserPromise = null;

  function ApiError(response, payload) {
    this.name = "ApiError";
    this.status = response.status;
    this.code = payload?.error?.code || "REQUEST_FAILED";
    this.message = payload?.error?.message || "The request could not be completed.";
    this.fields = payload?.error?.fields || {};
  }
  ApiError.prototype = Object.create(Error.prototype);

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    var response = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
    var payload = await response.json();
    csrfToken = payload.data.csrf_token;
    return csrfToken;
  }

  async function request(url, options) {
    options = options || {};
    var method = (options.method || "GET").toUpperCase();
    var headers = new Headers(options.headers || {});
    if (["POST", "PUT", "PATCH", "DELETE"].indexOf(method) !== -1) {
      headers.set("X-CSRF-Token", await getCsrfToken());
    }
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(options.body);
    }
    var response;
    try {
      response = await fetch(url, {
        method: method,
        headers: headers,
        body: options.body,
        credentials: "same-origin",
      });
    } catch (_error) {
      var networkError = new Error("The server could not be reached. Check that it is running, then try again.");
      networkError.code = "NETWORK_ERROR";
      networkError.fields = {};
      throw networkError;
    }
    var type = response.headers.get("content-type") || "";
    var payload = type.indexOf("application/json") !== -1 ? await response.json() : null;
    if (!response.ok) throw new ApiError(response, payload || {});
    return payload;
  }

  function setCsrfToken(value) {
    csrfToken = value || null;
  }

  function currentUser(refresh) {
    if (!currentUserPromise || refresh) {
      currentUserPromise = request("/api/auth/me")
        .then(function (payload) { return payload.data.user; })
        .catch(function (error) {
          if (error.status === 401) return null;
          throw error;
        });
    }
    return currentUserPromise;
  }

  async function guard(role) {
    var user = await currentUser(true);
    if (!user) {
      var next = window.location.pathname.split("/").pop() + window.location.search;
      window.location.replace("login.html?next=" + encodeURIComponent(next));
      return null;
    }
    if (role && user.role !== role) {
      window.location.replace(user.role === "admin" ? "admin.html" : "dashboard.html");
      return null;
    }
    return user;
  }

  function applyFieldErrors(form, fields) {
    var aliases = {
      full_name: ["contact-name", "register-name", "name"],
      company_name: ["contact-company", "register-company", "organisation"],
      email: ["contact-email", "register-email", "login-email", "email"],
      password: ["login-password", "register-password"],
      authorization_ack: ["register-terms", "authorization-ack"],
      message: ["contact-message", "message"],
    };
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (control) {
      control.setAttribute("aria-invalid", "false");
    });
    form.querySelectorAll("[data-api-field-error]").forEach(function (error) {
      error.remove();
    });
    Object.keys(fields || {}).forEach(function (name) {
      var control = form.elements[name] || document.getElementById(name);
      if (!control && aliases[name]) {
        aliases[name].some(function (alias) {
          control = form.elements[alias] || document.getElementById(alias);
          return Boolean(control);
        });
      }
      if (!control) return;
      control.setAttribute("aria-invalid", "true");
      var error = form.querySelector('[data-error-for="' + control.id + '"]');
      if (!error) {
        error = document.createElement("p");
        error.className = "field__error";
        error.setAttribute("data-error-for", control.id);
        error.setAttribute("data-api-field-error", "");
        error.setAttribute("role", "alert");
        control.insertAdjacentElement("afterend", error);
      }
      if (error) {
        error.textContent = fields[name];
        error.hidden = false;
      }
    });
  }

  async function initAuthNavigation() {
    var user;
    try {
      user = await currentUser();
    } catch (_error) {
      return;
    }
    if (!user) return;
    document.querySelectorAll('a[href="login.html"]').forEach(function (link) {
      link.href = user.role === "admin" ? "admin.html" : "dashboard.html";
      link.textContent = user.role === "admin" ? "Admin Console" : "Dashboard";
    });
    document.querySelectorAll('a[href="register.html"]').forEach(function (link) {
      link.href = "#logout";
      link.textContent = "Log Out";
      link.addEventListener("click", async function (event) {
        event.preventDefault();
        try {
          await request("/api/auth/logout", { method: "POST" });
          setCsrfToken(null);
          currentUserPromise = null;
          window.location.assign("index.html");
        } catch (error) {
          link.textContent = "Try Log Out Again";
          link.title = error.message;
        }
      });
    });
  }

  window.ORLApi = {
    request: request,
    currentUser: currentUser,
    guard: guard,
    setCsrfToken: setCsrfToken,
    applyFieldErrors: applyFieldErrors,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthNavigation);
  } else {
    initAuthNavigation();
  }
})();
