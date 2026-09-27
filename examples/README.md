# Local example assets and provenance

Examples are authored through the browser by `scripts/create-local-examples.mjs`. It logs into the local demo account using credentials from a file outside the repository (`YENZE_DEMO_CREDENTIALS`), and records created IDs in `data/local-examples.json`. It never overwrites existing published examples. It requires the local application and Chrome. Do not run against a production origin.

- `assets/cafe.jpg`: real photograph by Nathan Dumlao, [Cup of coffee](https://unsplash.com/photos/cup-of-coffee-keTvQFtMYuc), [Unsplash license](https://unsplash.com/license).
- `assets/latte.jpg`: real photograph by Nathan Dumlao, [Milk tea on a glass](https://unsplash.com/photos/milk-tea-on-a-glass-umbR2y7PIMM), Unsplash license. Used as an illustrative cold café beverage, not a claim about actual ingredients or inventory.
- `assets/SheenChair.glb`: original imported glTF asset from [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair), © 2020 Wayfair LLC, Eric Chadwick, CC0. See supplied upstream README. The model is a fictional demonstration chair with real geometry and textures, not a scanned product for sale.
- The Nube chair images in `public/brand` were AI-generated for this project. They are separately labeled as product image demonstrations, not real photography.
- The Forma table is constructed with the app's primitive 3D tools. Layered SVG examples are original to this project.

The application source archive excludes these downloaded assets, local account data, saved products, and screenshots. Obtain assets from their sources if reproducing the local example exercise elsewhere. All prices are demonstration values.

- Replacement espresso photograph (`assets/espresso-product.jpg`): Nour Alhoda, [Close up of espresso](https://www.pexels.com/photo/close-up-of-espresso-in-white-cup-on-saucer-34109986/), Pexels license. Replaces the coffee color-wheel image in the published example.
