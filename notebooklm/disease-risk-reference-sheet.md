# SFDPH Healthy Housing and Vector Control (HHVC)

## Disease-Risk Reference Sheet for Web Content Claim Verification

**Document Classification:** Internal Content Governance Standard & SME Review Guide  
**Aligned Manual Chapters:** Chapter 6 (Writing/Plain Language) and Chapter 8 (Public-Facing Service Standards)  
**Quality Control Gate:** Appendix H Publication Readiness Checklist (Check 13: Public Health and Safety Wording)  
**Current Date:** July 5, 2026

---

## 1. Document Purpose and Executive Summary

This reference sheet is designed to resolve a tool-wide, self-flagged content verification gap across the Healthy Housing and Vector Control (HHVC) web mockups. An independent provenance audit of the 39 mockup pages in the GitHub repository revealed that **11 informational pages open with "Why it matters" sections containing specific disease-transmission, allergen, or health-harm claims that require systematic verification** before publication.

To ensure complete legal and clinical compliance, this document consolidates every drafted health claim, maps them to their respective mockup page keys, lists the exact verbatim text, and establishes clear clinical boundaries and medical disclaimer requirements.

This reference sheet acts as a **unified review package** for the SFDPH Vector Control Program, the CDC liaison, and the California Department of Public Health (CDPH) to conduct a single, efficient, "one-pass" scientific review.

---

## 2. Master Disease-Risk Verification Matrix

| Page ID    | Page Key             | File Name                                         | Vector / Pest Category         | Drafted Clinical & Disease Claims                                                                           | Key Safety Takeaway / Callout                                                                     | Required Reviewing Agency       |
| :--------- | :------------------- | :------------------------------------------------ | :----------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------ |
| **GH-022** | `ownerGuidance`      | `integrated-pest-management-property-managers.js` | Cross-Vector (Owners/Managers) | Hantavirus, Leptospirosis, cockroach allergens (asthma), bed bug/mite bites, pigeon dropping fungal spores. | Focuses on high-risk populations: children, older adults, immunocompromised.                      | SFDPH Vector Program, CDC       |
| **GH-025** | `ratsPrevent`        | `keep-rats-mice-out.js`                           | Rodents (Rats & Mice)          | Hantavirus, Leptospirosis, Salmonella transmission.                                                         | Rodent nesting cleanup requires wet methods to prevent inhaling dust.                             | SFDPH Vector Program, CDC       |
| **GH-026** | `cockroachesPrevent` | `prevent-cockroaches.js`                          | Cockroaches                    | Cockroach droppings/saliva allergens triggering childhood asthma; Salmonella & E. coli bacterial transfer.  | Ongoing cockroach infestations directly increase childhood asthma symptoms.                       | SFDPH Environmental Health, CDC |
| **GH-013** | `bedBugsInfo`        | `bed-bug-rules-prevention.js`                     | Bed Bugs                       | Itching, allergic skin reactions, secondary infections; severe emotional strain (anxiety, sleeplessness).   | **Non-disease vector:** Bed bugs do not spread disease; focus is physical and emotional toll.     | SFDPH Housing Program, CDPH     |
| **GH-027** | `mosquitoesPrevent`  | `prevent-mosquitoes.js`                           | Mosquitoes                     | West Nile virus (WNV), fever, serious long-lasting neurological illness.                                    | WNV is spread through bites after mosquitoes feed on infected birds.                              | SFDPH Mosquito Control, CDPH    |
| **GH-015** | `wnvBirdReport`      | `report-dead-bird.js`                             | Dead Birds (Surveillance)      | West Nile virus host reservoir; bird carcass handling and collection.                                       | CDPH dead bird collection and testing criteria are seasonal.                                      | SFDPH Vector Program, CDPH      |
| **GH-031** | `pigeonInfo`         | `pigeon-information.js`                           | Pigeons                        | Histoplasmosis and psittacosis respiratory illnesses from inhaling dry dropping dust.                       | **Inhalation warning:** Never dry-sweep or vacuum pigeon droppings; use wet methods.              | SFDPH Occupational Health, CDC  |
| **GH-032** | `miteInfo`           | `mite-information.js`                             | Tropical Rat Mites             | Itching, skin irritation, secondary skin infections; scatter behavior following rodenticide use.            | **No Medical Advice:** General housing info only; refer bite symptoms to a provider.              | SFDPH Vector Program, PCO Board |
| **GH-010** | `waspInfo`           | `ground-wasp-information.js`                      | Ground Wasps (Yellowjackets)   | Localized swelling, severe anaphylaxis; multi-sting encounter venom toxicity (kidney damage).               | **Emergency warning:** Seek immediate medical help for face/throat swelling or breathing trouble. | SFDPH Vector Program, CDC       |
| **GH-009** | `flyInfo`            | `fly-information.js`                              | Flies                          | Bacterial/viral transfer linked to diarrhea, food poisoning, dysentery, and eye infections.                 | Flies indoor indicates a nearby breeding source (uncollected garbage/waste).                      | SFDPH Environmental Health      |
| **GH-033** | `reduceMoisture`     | `reduce-indoor-moisture.js`                       | Mold & Moisture                | Respiratory effects, mold spore allergies, sinusitis, moisture as breeding root cause.                      | visible mold on walls and ceilings must total at least 10 square feet for DPH enforcement.        | SFDPH Housing Program           |

---

## 3. Detailed Page-by-Page Diagnostic Breakdown

### 1. Property Owner & Manager IPM Guidance (GH-022 / `ownerGuidance`)

- **Drafted Page Title:** _Integrated pest management for property owners and managers_
- **Verbatim Mockup Copy (Why it matters):**
  > "Unmanaged pests don't just damage a building — they put residents' health at risk. Rodents can spread Hantavirus and Leptospirosis, cockroach allergens can trigger asthma, bed bug and mite bites cause skin irritation and stress, and bird droppings can carry fungal spores that affect breathing. These risks tend to compound the longer they go unaddressed — a small rodent problem can turn into a mite outbreak, and untreated moisture or clutter can support multiple pests at once. Prevention protects both residents' health and the owner's ability to meet Article 11 requirements."
- **Verbatim Mockup Callout:**
  > "The residents most at risk from unmanaged pests are often children, older adults, and people with existing health conditions or weakened immune systems."
- **Verification Checkpoints for SMEs:**
  - Confirm that the listed diseases (Hantavirus, Leptospirosis, histoplasmosis, psittacosis) represent the primary, scientifically defensible public-health justifications for property manager enforcement under Health Code Article 11.
  - Verify that the "compounding risk" description (such as rodenticides causing mite outbreaks or moisture supporting multiple pests) aligns with San Francisco Department of Public Health (SFDPH) field observation standards.

---

### 2. Rodent Prevention (GH-025 / `ratsPrevent`)

- **Drafted Page Title:** _Keep rats and mice out of your home_
- **Verbatim Mockup Copy (Why it matters):**
  > "Rats and mice are not just a nuisance — they pose serious risks to housing health. Rodents can contaminate food, surfaces, and air with droppings, urine, and hair, transmitting harmful bacteria and viruses. They are known vectors for diseases such as Hantavirus and Leptospirosis, and can carry bacteria like Salmonella that cause food poisoning."
- **Verbatim Mockup Callout:**
  > "Rodents can also carry external parasites like fleas and mites. Treating a rodent problem without addressing nest areas can cause these parasites to scatter and bite human residents."
- **Verification Checkpoints for SMEs:**
  - Confirm that Hantavirus and Leptospirosis are active, local public health surveillance concerns associated with urban rat and house mouse populations in San Francisco.
  - Verify that cleanup guidance explicitly mandates _wet methods_ (soaking nests and droppings in disinfectant) and strictly forbids dry-sweeping or vacuuming to prevent aerosolizing viral particles.

---

### 3. Cockroach Prevention (GH-026 / `cockroachesPrevent`)

- **Drafted Page Title:** _Prevent cockroaches_
- **Verbatim Mockup Copy (Why it matters):**
  > "Cockroach droppings, shed skin, and saliva contain allergens that can trigger or worsen asthma and allergic reactions — this risk is especially serious for children in homes with heavy infestations. Cockroaches can also pick up bacteria such as salmonella and E. coli while moving through drains, garbage, and food waste, then spread it onto kitchen counters and stored food."
- **Verbatim Mockup Callout:**
  > "Homes with ongoing cockroach activity often see an increase in asthma symptoms among children — reducing food, water, and shelter sources helps protect respiratory health, not just cleanliness."
- **Verification Checkpoints for SMEs:**
  - Verify the clinical accuracy of the claim regarding cockroach saliva, feces, and body parts as a primary childhood asthma trigger in multi-family housing.
  - Confirm that the listed bacteria (Salmonella, E. coli) represent the most common foodborne pathogens mechanically transmitted by crawling cockroaches.

---

### 4. Bed Bug Rules and Prevention (GH-013 / `bedBugsInfo`)

- **Drafted Page Title:** _Bed bug rules and prevention_
- **Verbatim Mockup Copy (Why it matters):**
  > "Bed bug bites cause itching and, for some people, allergic skin reactions; repeated scratching can lead to secondary infections. Beyond the physical bites, living with an active infestation often causes real emotional strain — anxiety, embarrassment, and sleepless nights are common. Delayed treatment lets bed bugs spread to neighboring units, which is why fast reporting and cooperation with inspections and treatment matter — the longer an infestation goes unaddressed, the more people it affects and the harder it becomes to resolve."
- **Verbatim Mockup Callout:**
  > "Bed bugs aren't known to spread disease, but the physical and emotional toll of an unresolved infestation is real and can affect a tenant's health and wellbeing."
- **Verification Checkpoints for SMEs:**
  - Ensure that the "non-vector" status of bed bugs (they do not transmit bloodborne pathogens to humans) is clearly maintained, separating them from disease-spreading pests like mosquitoes or rodents.
  - Confirm the clinical descriptions of localized skin irritation, allergic reactions, and secondary bacterial infections.

---

### 5. Mosquito Prevention (GH-027 / `mosquitoesPrevent`)

- **Drafted Page Title:** _Prevent mosquitoes_
- **Verbatim Mockup Copy (Why it matters):**
  > "Mosquitoes can spread West Nile virus to people through a bite after feeding on an infected bird. Most people who are infected don't feel sick, but some develop a fever, and in rare cases the virus can cause serious, long-lasting neurological illness. Because mosquitoes can travel between properties, standing water left on one lot can affect the health of an entire block — which is why removing breeding sites is a shared responsibility, not just a personal one."
- **Verbatim Mockup Callout:**
  > "Even a small amount of standing water — like an inch in a bottle cap or saucer — is enough for mosquitoes to breed."
- **Verification Checkpoints for SMEs:**
  - Confirm that the clinical summary of West Nile virus (the majority of cases are asymptomatic, a percentage develop West Nile fever, and less than 1% develop neuroinvasive disease like encephalitis or meningitis) is accurate, balanced, and non-alarmist.
  - Ensure that the "infected bird" transmission pathway is described correctly.

---

### 6. Report a Dead Bird (GH-015 / `wnvBirdReport`)

- **Drafted Page Title:** _Report a dead bird_
- **Verbatim Mockup Copy (Why it matters):**
  > "Reporting dead birds helps the City track and monitor West Nile virus. Corvids (such as crows, jays, and ravens) and birds of prey are highly sensitive to the virus and serve as early indicators of West Nile virus activity in an area. By collecting and testing eligible bird carcasses, Environmental Health can identify where WNV is active and target mosquito control treatments to protect public health."
- **Verification Checkpoints for SMEs:**
  - Verify the list of priority species (Corvids, raptors) and ensure that seasonal collection parameters and dead-bird reporting contact routes match the California Department of Public Health (CDPH) West Nile Virus website.
  - Confirm instructions for safe handling (using disposable gloves, double-bagging) if the public must dispose of a carcass when the City is not collecting.

---

### 7. Pigeon Information (GH-031 / `pigeonInfo`)

- **Drafted Page Title:** _Pigeons and housing health_
- **Verbatim Mockup Copy (Why it matters):**
  > "Pigeon droppings that dry out and turn to dust can carry fungal spores and bacteria. Breathing in that dust — especially in enclosed spaces like attics, vents, or storage rooms — can cause respiratory illnesses such as histoplasmosis or psittacosis. People with weakened immune systems, older adults, and young children face the highest risk of getting seriously sick from prolonged exposure to accumulated droppings and nesting material."
- **Verbatim Mockup Callout:**
  > "Never dry-sweep or vacuum accumulated pigeon droppings — this can release spores into the air. Use wet cleaning methods and protective equipment, or hire a professional."
- **Verification Checkpoints for SMEs:**
  - Verify that histoplasmosis and psittacosis (ornithosis) represent the correct, epidemiologically relevant disease risks associated with feral pigeon droppings in urban housing structures.
  - Confirm the wet-cleaning and PPE safety protocols (such as using a respirator, wetting droppings with a water-bleach or disinfectant solution before removal) to prevent the inhalation of infectious dust.

---

### 8. Mites and Housing Health (GH-032 / `miteInfo`)

- **Drafted Page Title:** _Mites and housing health_
- **Verbatim Mockup Copy (Why it matters):**
  > "Tropical rat mite bites cause itching and skin irritation, and repeated scratching can lead to secondary skin infections. When rodenticides kill rats without first treating the nest, surviving mites scatter in search of a new host — which can trigger a sudden spike in bites among residents in the building. Because mite outbreaks often follow rodent activity, delaying nest treatment doesn't just risk continued rat problems — it can actively make things worse for tenants living nearby."
- **Verbatim Mockup Callout:**
  > "If bites appear soon after rodenticide use, treat it as a sign the rat nest was not properly treated for mites."
- **Verification Checkpoints for SMEs:**
  - Verify the vector-control "order-of-operations" warning: that tropical rat mites (_Ornithonyssus bacoti_) are temporary ectoparasites that will actively disperse and feed on humans once their primary rodent hosts die from rodenticides.
  - Confirm that the medical disclaimer block is properly placed and formatted under plain-language standards.

---

### 9. Ground Wasps and Housing Health (GH-010 / `waspInfo`)

- **Drafted Page Title:** _Ground wasps and housing health_
- **Verbatim Mockup Copy (Why it matters):**
  > "Ground-nesting yellowjackets defend their colony aggressively when it is disturbed, and stinging incidents are most common right at the nest site. Reactions to a sting range from short-term pain and swelling to a serious, life-threatening allergic reaction. Being stung many times in one encounter is a separate, more serious risk: the volume of venom injected can damage red blood cells and other tissue, and in rare cases the breakdown products can overwhelm the kidneys and require emergency medical treatment."
- **Verbatim Mockup Callout:**
  > "Get medical help right away for trouble breathing, swelling of the face or throat, dizziness, or a large number of stings in one encounter."
- **Verification Checkpoints for SMEs:**
  - Confirm the physiological description of systemic venom toxicity from multiple wasp stings (specifically regarding hemolysis, tissue breakdown, rhabdomyolysis, and subsequent acute kidney injury).
  - Verify that yellowjackets (_Vespula_ species) are the primary ground-nesting stinging insects of public health significance in San Francisco.

---

### 10. Flies and Housing Health (GH-009 / `flyInfo`)

- **Drafted Page Title:** _Flies and housing health_
- **Verbatim Mockup Copy (Why it matters):**
  > "House flies breed in garbage, animal waste, and other decaying organic material. While feeding on this waste, they can pick up bacteria and viruses and later deposit them on human food or kitchen surfaces — flies are known to carry organisms linked to diarrhea, food poisoning, dysentery, and eye infections. Fly populations can grow quickly: under warm conditions a fly can develop from egg to adult in about a week, and each female can lay several batches of 100 or more eggs. A garbage or sanitation problem left unaddressed for even a short time can turn into a much larger fly problem."
- **Verification Checkpoints for SMEs:**
  - Confirm that the list of disease categories associated with mechanical transmission by house flies (_Musca domestica_) and blow flies (Calliphoridae) is clinically accurate and non-alarmist.
  - Verify the stated life-cycle and reproduction timelines under northern California coastal climatic conditions.

---

### 11. Reduce Indoor Moisture, Condensation, and Humidity (GH-033 / `reduceMoisture`)

- **Drafted Page Title:** _Reduce indoor moisture, condensation, and humidity_
- **Verbatim Mockup Copy (Why it matters):**
  > "Mold growth is almost always a clear indicator of an underlying excess moisture problem within a property. This moisture, essential for mold proliferation, typically originates from one of two main sources: leaks or condensation. ... Inhaling or touching mold spores can cause allergic reactions, asthma attacks, or irritation in the eyes, skin, nose, throat, and lungs." (Derived from Mold Prevention & Moisture Control drafts)
- **Verification Checkpoints for SMEs:**
  - Ensure that the respiratory health descriptions associated with indoor mold exposure (nasal stuffiness, throat irritation, coughing, wheezing, eye irritation, skin irritation, and triggering asthma in sensitive individuals) match CDC, California Department of Public Health, and SFDPH official mold guidelines.
  - Verify that the 10-square-foot visible structural mold threshold is preserved as the legal limit for SFDPH code enforcement under Article 11.

---

## 4. Content Design and Integration Standards

### Appendix H Checklist Integration (Check 13: Public Health and Safety Wording)

During manager review, every page utilizing disease, bite, or sting language must be audited against these four standards to receive a "Pass" status:

1.  **Strict Non-Diagnostic Boundaries**: Web pages must never diagnose medical conditions or give medical treatment advice. They must present general public health information and always direct users to contact a healthcare provider for bite, sting, or exposure symptoms.
2.  **Visible Emergency Callouts**: Pages involving acute hazards (such as venomous stings or severe allergic reactions) must feature a prominent, uncollapsed Callout instructing users to seek emergency medical care immediately for severe symptoms (e.g., face/throat swelling, difficulty breathing).
3.  **No Alarmist Phrasing**: Editors must avoid sensationalized or fear-inducing terminology (such as "deadly", "infesting outbreak", or "flesh-eating"). Public health risks must be described in objective, plain-language terms that focus on actionable prevention.
4.  **Enforceable Material References**: Where pest-proofing materials are listed (as on the owner guidance and rodent prevention pages), they must align exactly with local code enforcement. Pests must be excluded with durable, rodent-proof materials (e.g., steel wool with sealant, hardware cloth, copper mesh, sheet metal, mortar, or concrete).

---

## 5. Verification Sign-Off Block (For Reviewers)

_This section must be completed by the reviewing Subject Matter Expert (SME) before any page utilizing disease-risk or health-harm language is moved to "Approved to Publish" in the Master Control workbook._

```
SME Reviewer Name: __________________________________________________
Title / Program:   __________________________________________________
Agency / Division: __________________________________________________
Date of Review:    __________________________________________________

Review Decision (Mark One):
[ ] APPROVED AS WRITTEN: All drafted health and disease claims are verified as accurate,
    balanced, and compliant with SFDPH public health standards.
[ ] APPROVED WITH REVISIONS: The drafted language is approved subject to the specific,
    attached redline edits.
[ ] REJECTED / NEEDS REVISION: The drafted health claims contain scientific or clinical
    inaccuracies and must be redrafted before publication.

SME Signature:     __________________________________________________
```
