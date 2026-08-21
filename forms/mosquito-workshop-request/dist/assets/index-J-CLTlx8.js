(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))a(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&a(s)}).observe(document,{childList:!0,subtree:!0});function i(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(t){if(t.ep)return;t.ep=!0;const o=i(t);fetch(t.href,o)}})();const d=document.getElementById("app");function c(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}const n=[{id:"organization",label:"Organization or school name",type:"text",required:!0},{id:"contactName",label:"Contact name",type:"text",required:!0},{id:"email",label:"Email",type:"email",required:!0},{id:"phone",label:"Phone",type:"tel",required:!0},{id:"organizationType",label:"Organization type",type:"select",required:!0,options:["School","Summer camp","Museum or library","Science fair or STEM event","Other youth program"]},{id:"audienceAge",label:"Audience age range",type:"select",required:!0,options:["Grades K–2","Grades 3–5","Grades 6–8","Mixed ages"]},{id:"groupSize",label:"Expected group size",type:"number",required:!0,min:1},{id:"preferredDates",label:"Preferred date(s)",type:"text",required:!0},{id:"eventLocation",label:"Event location or neighborhood",type:"text",required:!0},{id:"spaceType",label:"Space type",type:"select",required:!0,options:["Indoor classroom","Indoor multipurpose room","Outdoor covered area","Outdoor open area"]},{id:"electricity",label:"Electricity available nearby?",type:"select",required:!0,options:["Yes","No","Not sure"]},{id:"notes",label:"Anything else we should know?",type:"textarea",required:!1}];function l(e){const r=e.required?' <span class="required-mark" aria-hidden="true">*</span>':"",i=e.required?"required":"";if(e.type==="select")return`
      <div class="form-field">
        <label for="${e.id}">${e.label}${r}</label>
        <select id="${e.id}" name="${e.id}" ${i}>
          <option value="">Select one</option>
          ${e.options.map(t=>`<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>`;if(e.type==="textarea")return`
      <div class="form-field">
        <label for="${e.id}">${e.label}${r}</label>
        <textarea id="${e.id}" name="${e.id}" ${i}></textarea>
      </div>`;const a=e.min?` min="${e.min}"`:"";return`
    <div class="form-field">
      <label for="${e.id}">${e.label}${r}</label>
      <input id="${e.id}" name="${e.id}" type="${e.type}" ${i}${a} />
    </div>`}function u(){const e=n.slice(0,4),r=n.slice(4,8),i=n.slice(8);d.innerHTML=`
    <form class="form-card" id="workshopForm" name="mosquito-workshop-request" novalidate>
      <p class="form-note form-mock-banner" role="note">
        <strong>This is a design reference, not a live form.</strong> Nothing you enter is sent or
        stored anywhere. It exists to show what the real intake form needs to capture — HHVC's
        production form will be a Fillout form linked from the campaign page, following how SF.gov
        form pages hand off rather than embed.
      </p>
      <p class="form-note">
        The real form would collect interest for HHVC's free mosquito education workshop campaign.
        Submitting would not guarantee a scheduled date.
      </p>
      <p class="form-error" id="submissionError" role="alert" hidden></p>
      <div class="form-grid two-col">${e.map(l).join("")}</div>
      <div class="form-grid two-col">${r.map(l).join("")}</div>
      <div class="form-grid">${i.map(l).join("")}</div>
      <div class="form-actions">
        <button class="btn" type="submit">Preview what this form captures</button>
        <a class="btn secondary" href="/">Back to mockup tool</a>
      </div>
    </form>`}function p(e){const r=n.map(i=>{const a=(e[i.id]??"").trim();return`<tr><th scope="row">${c(i.label)}</th><td>${a?c(a):"<em>(left blank)</em>"}</td></tr>`}).join("");d.innerHTML=`
    <div class="form-success" role="status">
      <h2>Not submitted — this is what the real form would capture</h2>
      <p>
        No request was sent and nothing was stored. This preview exists so reviewers can check the
        field list against what HHVC actually needs before the production Fillout form is built.
      </p>
      <table class="form-summary">
        <caption class="visually-hidden">Field values entered in this preview</caption>
        <tbody>${r}</tbody>
      </table>
      <p style="margin-top:0.75rem">
        <button class="btn secondary" type="button" id="backToForm">Back to the form</button>
        <a href="/">Return to the HHVC mockup tool</a>
      </p>
    </div>`,document.getElementById("backToForm").addEventListener("click",()=>{u(),m()})}function f(e){return Object.fromEntries(new FormData(e).entries())}u();m();function m(){const e=document.getElementById("workshopForm");e&&e.addEventListener("submit",r=>{r.preventDefault(),e.reportValidity()&&p(f(e))})}
