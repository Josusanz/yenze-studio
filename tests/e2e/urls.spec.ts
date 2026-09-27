import {test,expect} from '@playwright/test';
test('Readable product links and short shares preserve the chosen options, including legacy links',async({page,browser})=>{
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.request.post('/api/auth/signup',{data:{name:'Author',company:'Estudio bonito',email:'urls@browser.test',password:'test-password-123'}});
 const product=await(await page.request.post('/api/products',{data:{template:'cabinet',name:'Mueble Córdoba'}})).json();await page.request.post('/api/products/'+product.id+'/publish',{data:{revision:product.revision}});
 expect(product.publicPath).toBe('/p/estudio-bonito/mueble-cordoba');
 await page.goto('/?product='+product.id);await expect(page).toHaveURL(new RegExp(product.publicPath+'$'));await page.getByRole('button',{name:/Nogal/}).click();await page.getByRole('button',{name:'Compartir',exact:true}).click();await expect(page.getByRole('status')).toContainText('Enlace copiado');const link=await page.evaluate(()=>navigator.clipboard.readText());expect(link).toMatch(/\/p\/estudio-bonito\/mueble-cordoba\?c=[a-f0-9]+$/);expect(link).not.toContain('selection=');
 const buyer=await browser.newPage();await buyer.goto(link);await expect(buyer.getByRole('button',{name:/Nogal/})).toHaveClass(/chosen/);await expect(buyer.locator('.buyer-total')).toContainText('485');
 const selection=product.draft.groups.find((g:any)=>g.label==='Acabado')||product.draft.groups[0];const walnut=selection.options.find((o:any)=>o.label==='Nogal');await buyer.goto('http://127.0.0.1:3070/?product='+product.id+'&selection='+encodeURIComponent(JSON.stringify({[selection.id]:walnut.id})));await expect(buyer).toHaveURL(/\/p\/estudio-bonito\/mueble-cordoba\?c=/);await expect(buyer.getByRole('button',{name:/Nogal/})).toHaveClass(/chosen/);await buyer.close();
});
