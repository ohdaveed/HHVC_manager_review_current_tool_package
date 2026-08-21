(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))i(t);new MutationObserver(t=>{for(const r of t)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function n(t){const r={};return t.integrity&&(r.integrity=t.integrity),t.referrerPolicy&&(r.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?r.credentials="include":t.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(t){if(t.ep)return;t.ep=!0;const r=n(t);fetch(t.href,r)}})();const u=document.getElementById("app");function s(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}const l=[{id:"organization",label:"Organization or school name",type:"text",required:!0},{id:"contactName",label:"Contact name",type:"text",required:!0},{id:"email",label:"Email",type:"email",required:!0},{id:"phone",label:"Phone",type:"tel",required:!0},{id:"organizationType",label:"Organization type",type:"select",required:!0,options:["School","Summer camp","Museum or library","Science fair or STEM event","Other youth program"]},{id:"audienceAge",label:"Audience age range",type:"select",required:!0,options:["Grades K–2","Grades 3–5","Grades 6–8","Mixed ages"]},{id:"groupSize",label:"Expected group size",type:"number",required:!0,min:1},{id:"preferredDates",label:"Preferred date(s)",type:"text",required:!0},{id:"eventLocation",label:"Event location or neighborhood",type:"text",required:!0},{id:"spaceType",label:"Space type",type:"select",required:!0,options:["Indoor classroom","Indoor multipurpose room","Outdoor covered area","Outdoor open area"]},{id:"electricity",label:"Electricity available nearby?",type:"select",required:!0,options:["Yes","No","Not sure"]},{id:"notes",label:"Anything else we should know?",type:"textarea",required:!1}];function d(e,o={}){const n=e.required?' <span class="required-mark" aria-hidden="true">*</span>':"",i=e.required?"required":"",t=o[e.id]??"";if(e.type==="select"){const a=e.options.map(c=>`<option value="${s(c)}"${c===t?" selected":""}>${c}</option>`).join("");return`
      <div class="form-field">
        <label for="${e.id}">${e.label}${n}</label>
        <select id="${e.id}" name="${e.id}" ${i}>
          <option value=""${t?"":" selected"}>Select one</option>
          ${a}
        </select>
      </div>`}if(e.type==="textarea")return`
      <div class="form-field">
        <label for="${e.id}">${e.label}${n}</label>
        <textarea id="${e.id}" name="${e.id}" ${i}>${s(t)}</textarea>
      </div>`;const r=e.min?` min="${e.min}"`:"";return`
    <div class="form-field">
      <label for="${e.id}">${e.label}${n}</label>
      <input id="${e.id}" name="${e.id}" type="${e.type}" value="${s(t)}" ${i}${r} />
    </div>`}function p(e={}){const o=l.slice(0,4),n=l.slice(4,8),i=l.slice(8);u.innerHTML=`
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
      <div class="form-grid two-col">${o.map(t=>d(t,e)).join("")}</div>
      <div class="form-grid two-col">${n.map(t=>d(t,e)).join("")}</div>
      <div class="form-grid">${i.map(t=>d(t,e)).join("")}</div>
      <div class="form-actions">
        <button class="btn" type="submit">Preview what this form captures</button>
        <a class="btn secondary" href="/">Back to mockup tool</a>
      </div>
    </form>`}function f(e){const o=l.map(n=>{const i=(e[n.id]??"").trim();return`<tr><th scope="row">${s(n.label)}</th><td>${i?s(i):"<em>(left blank)</em>"}</td></tr>`}).join("");u.innerHTML=`
    <div class="form-success" role="status">
      <h2>Not submitted — this is what the real form would capture</h2>
      <p>
        No request was sent and nothing was stored. This preview exists so reviewers can check the
        field list against what HHVC actually needs before the production Fillout form is built.
      </p>
      <table class="form-summary">
        <caption class="visually-hidden">Field values entered in this preview</caption>
        <tbody>${o}</tbody>
      </table>
      <p style="margin-top:0.75rem">
        <button class="btn secondary" type="button" id="backToForm">Back to the form</button>
        <a href="/">Return to the HHVC mockup tool</a>
      </p>
    </div>`,document.getElementById("backToForm").addEventListener("click",()=>{p(e),m()})}function b(e){return Object.fromEntries(new FormData(e).entries())}p();m();function m(){const e=document.getElementById("workshopForm");e&&e.addEventListener("submit",o=>{o.preventDefault(),e.reportValidity()&&f(b(e))})}
