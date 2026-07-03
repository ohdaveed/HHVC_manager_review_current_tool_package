(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))a(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const n of o.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&a(n)}).observe(document,{childList:!0,subtree:!0});function i(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(t){if(t.ep)return;t.ep=!0;const o=i(t);fetch(t.href,o)}})();const u=document.getElementById("app");function s(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const l=[{id:"organization",label:"Organization or school name",type:"text",required:!0},{id:"contactName",label:"Contact name",type:"text",required:!0},{id:"email",label:"Email",type:"email",required:!0},{id:"phone",label:"Phone",type:"tel",required:!0},{id:"organizationType",label:"Organization type",type:"select",required:!0,options:["School","Summer camp","Museum or library","Science fair or STEM event","Other youth program"]},{id:"audienceAge",label:"Audience age range",type:"select",required:!0,options:["Grades K–2","Grades 3–5","Grades 6–8","Mixed ages"]},{id:"groupSize",label:"Expected group size",type:"number",required:!0,min:1},{id:"preferredDates",label:"Preferred date(s)",type:"text",required:!0},{id:"eventLocation",label:"Event location or neighborhood",type:"text",required:!0},{id:"spaceType",label:"Space type",type:"select",required:!0,options:["Indoor classroom","Indoor multipurpose room","Outdoor covered area","Outdoor open area"]},{id:"electricity",label:"Electricity available nearby?",type:"select",required:!0,options:["Yes","No","Not sure"]},{id:"notes",label:"Anything else we should know?",type:"textarea",required:!1}];function c(e){const r=e.required?' <span class="required-mark" aria-hidden="true">*</span>':"",i=e.required?"required":"";if(e.type==="select")return`
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
    </div>`}function d(){const e=l.slice(0,4),r=l.slice(4,8),i=l.slice(8);u.innerHTML=`
    <form class="form-card" id="workshopForm" novalidate>
      <p class="form-note">
        This form collects interest for HHVC’s free mosquito education workshop campaign. Submitting
        does not guarantee a scheduled date.
      </p>
      <div class="form-grid two-col">${e.map(c).join("")}</div>
      <div class="form-grid two-col">${r.map(c).join("")}</div>
      <div class="form-grid">${i.map(c).join("")}</div>
      <div class="form-actions">
        <button class="btn" type="submit">Submit workshop request</button>
        <a class="btn secondary" href="/">Back to mockup tool</a>
      </div>
    </form>`}function p(e){u.innerHTML=`
    <div class="form-success" role="status">
      <h2>Thank you — we received your request</h2>
      <p>
        <strong>${s(e.organization)}</strong> is on the list for follow-up. HHVC will contact
        ${s(e.contactName)} at ${s(e.email)} about workshop availability.
      </p>
      <p style="margin-top:0.75rem">
        <a href="/">Return to the HHVC mockup tool</a>
      </p>
    </div>`}function m(e){return Object.fromEntries(new FormData(e).entries())}d();document.getElementById("workshopForm").addEventListener("submit",e=>{e.preventDefault();const r=e.currentTarget;r.reportValidity()&&p(m(r))});
