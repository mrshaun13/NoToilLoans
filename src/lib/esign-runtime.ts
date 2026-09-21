import { borrowerHandoffTemplates } from "./esign.ts";

/** Browser script embedded in a struck note. Reads and writes `LOAN` in that file only. */
export function esignRuntimeSource(): string {
  const mail = borrowerHandoffTemplates();
  return `
    function escHtml(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
        if (ch === "&") return "&amp;";
        if (ch === "<") return "&lt;";
        if (ch === ">") return "&gt;";
        if (ch === '"') return "&quot;";
        return "&#39;";
      });
    }
    function signedWhen(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso || "");
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    }
    function blankSign(role, party) {
      var who = party ? role + " · " + party : role;
      return '<div class="sign-line"></div><p class="sign-meta">' + escHtml(who) +
        '</p><div class="sign-line sign-line-short"></div><p class="sign-meta">Date</p>';
    }
    function lockedSign(role, signature) {
      return '<p class="sign-script">' + escHtml(signature.name) + '</p>' +
        '<p class="sign-meta">Electronically signed · ' + escHtml(role) + '</p>' +
        '<p class="sign-meta">' + escHtml(signedWhen(signature.signedAt)) + '</p>';
    }
    function inFrame() {
      try { return window.self !== window.top; } catch (err) { return true; }
    }
    function borrowerPromptKey() {
      var lender = LOAN.signatures && LOAN.signatures.lender;
      return "notoilloans-esign-prompt:" + (lender ? lender.signedAt : "") + ":" + (LOAN.title || "");
    }
    function rememberBorrowerPrompt() {
      try { sessionStorage.setItem(borrowerPromptKey(), "1"); } catch (err) {}
    }
    function borrowerNeedsSign() {
      return !!(LOAN.signatures && LOAN.signatures.lender && !LOAN.signatures.borrower);
    }
    function renderSignatures() {
      var sig = LOAN.signatures || { lender: null, borrower: null };
      var lenderEl = document.getElementById("lender-sign");
      var borrowerEl = document.getElementById("borrower-sign");
      var noteEl = document.getElementById("sign-status");
      if (!lenderEl || !borrowerEl) return;
      lenderEl.innerHTML = sig.lender ? lockedSign("Lender", sig.lender) : blankSign("Lender", LOAN.lender || "");
      if (sig.borrower) {
        borrowerEl.innerHTML = lockedSign("Borrower", sig.borrower);
      } else if (sig.lender && !inFrame()) {
        var party = LOAN.borrower || "";
        borrowerEl.innerHTML =
          '<div class="sign-screen-only">' +
            '<button type="button" class="sign-cta" id="borrower-sign-open">' +
              '<span class="sign-script sign-script-ghost">Click to e-sign</span>' +
              '<span class="sign-meta">' + escHtml(party ? "Borrower · " + party : "Borrower") + '</span>' +
            '</button>' +
            '<form class="sign-form" id="borrower-sign-form" hidden>' +
              '<label class="sign-label" for="borrower-sign-name">Signing name</label>' +
              '<input id="borrower-sign-name" class="sign-input" maxlength="160" autocomplete="name" value="' + escHtml(party) + '" />' +
              '<button type="submit" class="sign-submit">Yes, I approve e-signing this doc</button>' +
              '<p class="sign-meta">Your typed name is the signature. The dual-signed file downloads so you can email it back to the lender.</p>' +
            '</form>' +
          '</div>' +
          '<div class="sign-print-only">' + blankSign("Borrower", party) + '</div>';
        wireBorrowerSign();
      } else {
        borrowerEl.innerHTML = blankSign("Borrower", LOAN.borrower || "") +
          (sig.lender ? '<p class="sign-meta no-print">The borrower e-signs when they open this file.</p>' : "");
      }
      if (noteEl) {
        if (sig.lender && sig.borrower) {
          noteEl.textContent = "Both parties have e-signed this version of the note. Signatures are locked.";
        } else if (sig.lender) {
          noteEl.textContent = "The lender has e-signed. The borrower e-signs once in this file, then emails it back.";
        } else {
          noteEl.textContent = "";
        }
      }
    }
    function wireBorrowerSign() {
      var openBtn = document.getElementById("borrower-sign-open");
      var form = document.getElementById("borrower-sign-form");
      if (openBtn && form) {
        openBtn.addEventListener("click", function () {
          openBtn.hidden = true;
          form.hidden = false;
          var input = document.getElementById("borrower-sign-name");
          if (input) input.focus();
        });
      }
      if (form) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          var input = document.getElementById("borrower-sign-name");
          var name = input ? String(input.value || "").trim() : "";
          if (!name) {
            if (input) input.focus();
            return;
          }
          finishBorrowerSign(name);
        });
      }
    }
    function scriptJson(value) {
      return JSON.stringify(value)
        .replace(/</g, "\\\\u003c")
        .replace(/\\u2028/g, "\\\\u2028")
        .replace(/\\u2029/g, "\\\\u2029");
    }
    function noteFilename(title) {
      var slug = String(title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
      var d = new Date();
      function pad(n) { return (n < 10 ? "0" : "") + n; }
      return "notoilloans-" + (slug || "note") + "-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".html";
    }
    function downloadThisPage(filename) {
      var json = scriptJson(LOAN);
      var html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
      html = html.replace(
        /(<script[^>]*id=["']paydown-loan["'][^>]*>)[\\s\\S]*?(<\\/script>)/i,
        function (_match, open, close) { return open + json + close; }
      );
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    function fillMail(template, title, filename) {
      return String(template).split("{{title}}").join(title).split("{{filename}}").join(filename);
    }
    function openBorrowerMail(filename) {
      var title = LOAN.title || "Personal note";
      var subject = fillMail(${JSON.stringify(mail.subject)}, title, filename);
      var body = fillMail(${JSON.stringify(mail.body)}, title, filename);
      var link = document.createElement("a");
      link.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    function finishBorrowerSign(name) {
      if (!LOAN.signatures || !LOAN.signatures.lender || LOAN.signatures.borrower) return;
      LOAN.signatures.borrower = { name: name, signedAt: new Date().toISOString() };
      var node = document.getElementById("paydown-loan");
      if (node) node.textContent = scriptJson(LOAN);
      renderSignatures();
      var modal = document.getElementById("esign-modal");
      if (modal) modal.hidden = true;
      rememberBorrowerPrompt();
      var filename = noteFilename(LOAN.title);
      downloadThisPage(filename);
      openBorrowerMail(filename);
    }
    function hideEsignModal(remember) {
      var modal = document.getElementById("esign-modal");
      if (!modal || modal.hidden) return;
      if (remember) rememberBorrowerPrompt();
      modal.hidden = true;
    }
    function bindEsignModal() {
      var modal = document.getElementById("esign-modal");
      var later = document.getElementById("esign-later");
      var now = document.getElementById("esign-now");
      if (later) later.addEventListener("click", function () {
        hideEsignModal(true);
        var agreement = document.getElementById("agreement");
        if (agreement && agreement.scrollIntoView) agreement.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (now) now.addEventListener("click", function () {
        hideEsignModal(true);
        var agreement = document.getElementById("agreement");
        if (agreement && agreement.scrollIntoView) agreement.scrollIntoView({ behavior: "smooth", block: "start" });
        var openBtn = document.getElementById("borrower-sign-open");
        if (openBtn) openBtn.click();
      });
      if (modal) modal.addEventListener("click", function (event) {
        if (event.target === modal) hideEsignModal(true);
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") hideEsignModal(true);
      });
    }
    function maybeShowEsignPrompt() {
      if (!borrowerNeedsSign() || inFrame()) return;
      try {
        if (sessionStorage.getItem(borrowerPromptKey())) return;
      } catch (err) {}
      var modal = document.getElementById("esign-modal");
      if (!modal) return;
      modal.hidden = false;
      rememberBorrowerPrompt();
      var now = document.getElementById("esign-now");
      if (now && now.focus) now.focus();
    }
    bindEsignModal();
    renderSignatures();
    maybeShowEsignPrompt();
  `;
}
