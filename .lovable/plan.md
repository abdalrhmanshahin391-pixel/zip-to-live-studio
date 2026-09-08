# Dark home page: smaller iPad, new header type, blue buttons, plans below

Rebuild the RitaJet home page as one continuous black page in the style of the screenshots you sent: a smaller iPad at the top with your studying-girl picture on its screen, a tighter header, gray and blue pill buttons, and your real plans and products continuing down the page.

## What changes

### 1. The iPad at the top
- Make it noticeably narrower and shorter so it no longer fills the screen edge to edge.
- Show the whole device instead of cutting the top off, with the same landscape shape.
- Put your uploaded studying-girl picture on the screen, filling it edge to edge.

### 2. The header
- Smaller, tighter wording: navigation text drops from 16px to about 14px, medium weight, slightly tighter spacing.
- The RitaJet name shrinks to sit level with the navigation instead of dominating it.
- Right side keeps Pricing, Special offers, credits and your account, but as flatter, quieter buttons.

### 3. Headline and buttons
- Big headline stays the loudest thing on the page; the small label above it becomes fainter and wider-spaced; the paragraph under it gets smaller and gray.
- Two pill buttons side by side under the text, exactly like the reference: a bright blue main button (#0A84FF) and a gray secondary button (#2C2C2E) next to it.
- The green button is retired on this page in favour of the blue.

### 4. New sections continuing down the page
Below the hero, the page continues on black with:
- A products band: two large rounded dark cards, each with a picture on an iPad-style screen showing one of your own study features, a heading, a short line of text, and two buttons (gray "Learn more", blue "Get it").
- A plans band: your real published plans pulled from your database exactly as the pricing page does today, restyled as dark cards with white headings, gray prices, a blue button on the recommended plan and gray buttons elsewhere. Prices, names and features stay whatever you have set in your admin, so nothing is invented.
- A closing wide picture card, matching the last screenshot's split of a dark text card next to a large rounded image.

### 5. Colors and type
- Page palette locked to black, #171719 and #2C2C2E for cards, #0A84FF for main buttons, near-white text.
- Type keeps the existing clean grotesk already loaded on the site, tuned to the reference's rhythm: very large bold headings, small light labels, medium-weight buttons.

## Note on copying
I'll match the structure, sizing, spacing and color feel from your screenshots, but the wording, product names, pictures and prices stay yours — I won't reproduce their text or brand assets.

## Technical notes
- Your uploaded picture is uploaded as a hosted asset and referenced from the iPad component.
- Edits: `IpadStage.tsx` (size and image), `ProHeader.tsx` (type scale and buttons), `ProHome.tsx` (hero text and pill buttons), plus new section components under `src/components/home/procreate/` for the products, plans and closing bands.
- Plans are read with the same query the pricing page uses, so admin changes still flow through; "Get" buttons route to the existing checkout/register flow.
- No database, auth or payment changes.
