const {chromium,expect}=require('@playwright/test');const fs=require('node:fs');
const base='http://127.0.0.1:4174';const results=[];
const events=(p,name)=>p.evaluate(name=>(window.fbq?.queue||[]).map(x=>Array.from(x)).filter(x=>x[0]==='trackSingle'&&(!name||x[2]===name)),name);
const state=()=>fetch(base+'/__test/state').then(r=>r.json());
async function fillCheckout(p,method='COD'){
 await p.locator('#co-name').fill('Local Test');await p.locator('#co-phone').fill('03001234567');await p.locator('#co-address').fill('Synthetic test address');await p.locator('#co-city').fill('Karachi');await p.locator(`input[value="${method}"]`).check();
}
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 async function scenario(name,fn){await fetch(base+'/__test/reset-rate');await fetch(base+'/__test/fail');const c=await b.newContext({viewport:{width:1440,height:1000}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  // Defense in depth: no request may leave localhost, including Meta or Supabase.
  await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  try{await fn(p,c);expect(errors).toEqual([]);results.push({name,status:'passed'});}catch(e){results.push({name,status:'FAILED',error:e.message,errors});await p.screenshot({path:'failed-'+results.length+'.png'});}
  await c.close();
 }
 const accept=async p=>{await p.locator('[data-consent=yes]').click();await expect(p.locator('#hanaz-consent')).toHaveCount(0);await expect.poll(async()=> (await events(p,'PageView')).length).toBe(1);};
 const product=async p=>{await p.goto(base+'/pdp-vitamin-c.html');await expect(p.locator('#pdp-title')).toHaveText('Hanaz Vitamin C Serum');};
 await scenario('one page view, genuine navigation, rendered product and quantity-aware cart',async p=>{
  await p.goto(base);expect(await events(p)).toHaveLength(0);await accept(p);
  await p.screenshot({path:'verified-home-desktop.png'});
  await p.locator('nav').getByRole('link',{name:'Shop',exact:true}).click();await expect.poll(async()=> (await events(p,'PageView')).length).toBe(1);
  await product(p);await expect.poll(async()=> (await events(p,'ViewContent')).length).toBe(1);
  expect((await events(p,'ViewContent'))[0][3].content_ids).toEqual(['7ff4066c-ca6d-4fc2-8405-46289d66f05f']);
  await p.locator('#qty-plus').click();await expect(p.locator('#qty-value')).toHaveText('2');await p.locator('#btn-add-cart').click();
  const add=await events(p,'AddToCart');expect(add).toHaveLength(1);expect(add[0][3].value).toBe(2998);expect(add[0][3].contents[0].quantity).toBe(2);
  const before=await events(p);await p.evaluate(()=>{history.pushState({},'',location.pathname+'#details');dispatchEvent(new PopStateEvent('popstate'));});expect(await events(p)).toHaveLength(before.length);
 });
 await scenario('COD backend confirmation, duplicate submits, shared event ID, refresh and direct visit',async p=>{
  await product(p);await accept(p);await p.locator('#btn-add-cart').click();await p.goto(base+'/checkout.html');await expect.poll(async()=> (await events(p,'InitiateCheckout')).length).toBe(1);await fillCheckout(p);
  const before=(await state()).orders.length;await p.locator('#checkout-page-form button[type=submit]').dblclick();await expect(p.locator('#checkout-success')).toBeVisible();
  const purchase=await events(p,'Purchase');expect(purchase).toHaveLength(1);const s=await state();expect(s.orders.length).toBe(before+1);
  const out=s.hanaz_meta_outbox.find(x=>x.id===purchase[0][4].eventID);expect(out.payload.custom_data).toEqual(purchase[0][3]);expect(out.payload.event_name).toBe('Purchase');expect(out.payload.custom_data.value).toBe(1499);
  await expect.poll(()=>p.evaluate(()=>scrollY)).toBe(0);await p.screenshot({path:'verified-cod-confirmation.png',animations:'disabled'});await p.reload();expect(await events(p,'Purchase')).toHaveLength(0);await p.goto(base+'/checkout.html?success=1');expect(await events(p,'Purchase')).toHaveLength(0);
 });
 await scenario('manual transfer remains unpaid without Purchase, instructions preserved',async p=>{
  await product(p);await accept(p);await p.locator('#btn-add-cart').click();await p.goto(base+'/checkout.html');await fillCheckout(p,'EasyPaisa');await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-success')).toBeVisible();
  expect(await events(p,'Purchase')).toHaveLength(0);await expect(p.locator('#checkout-success')).toContainText('awaiting payment verification');await expect(p.locator('#checkout-success')).toContainText('03189454884');
 });
 await scenario('lost checkout response retries original order and conversion rather than duplicating',async p=>{
  await product(p);await accept(p);await p.locator('#btn-add-cart').click();await p.goto(base+'/checkout.html');await fillCheckout(p);
  const before=(await state()).orders.length;await fetch(base+'/__test/fail?action=checkout&after=1');await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-page-form button[type=submit]')).toBeEnabled();
  expect(await events(p,'Purchase')).toHaveLength(0);expect((await state()).orders.length).toBe(before+1);await p.reload();await fillCheckout(p);await fetch(base+'/__test/fail');await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-success')).toBeVisible();expect((await state()).orders.length).toBe(before+1);expect(await events(p,'Purchase')).toHaveLength(1);
 });
 await scenario('declined consent: cart and COD work with neither Pixel nor CAPI conversion',async p=>{
  await product(p);await p.locator('[data-consent=no]').click();await expect(p.locator('#hanaz-consent')).toHaveCount(0);await p.locator('#btn-add-cart').click();await p.goto(base+'/checkout.html');await fillCheckout(p);
  const before=(await state()).hanaz_meta_outbox.length;await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-success')).toBeVisible();expect(await events(p)).toHaveLength(0);expect((await state()).hanaz_meta_outbox.length).toBe(before);
 });
 await scenario('contact acceptance and failure, no false Lead, no raw form fields in local storage',async p=>{
  await p.goto(base+'/contact.html');await accept(p);await p.locator('#name').fill('Local Test');await p.locator('#email').fill('test@example.invalid');await p.locator('#subject').selectOption({index:1});await p.locator('#message').fill('Synthetic contact request');
  await fetch(base+'/__test/fail?action=lead');await p.locator('#contact-form button[type=submit]').click();await expect(p.locator('#contact-form button[type=submit]')).toBeEnabled();expect(await events(p,'Lead')).toHaveLength(0);
  await fetch(base+'/__test/fail');await p.locator('#contact-form button[type=submit]').click();await expect(p.locator('#contact-success')).toBeVisible();expect(await events(p,'Lead')).toHaveLength(1);
  expect(await p.evaluate(()=>JSON.stringify(localStorage))).not.toContain('test@example.invalid');
 });
 await scenario('newsletter is actually saved before acknowledgement',async p=>{
  await p.goto(base);await accept(p);const before=(await state()).contact_messages.length;await p.locator('#footer-newsletter-form input[type=email]').fill('newsletter@example.invalid');await p.locator('#footer-newsletter-form button').click();await expect(p.locator('#footer-newsletter-form .form-status')).toContainText('received');expect((await state()).contact_messages.length).toBe(before+1);expect(await events(p,'Lead')).toHaveLength(1);
 });
 await scenario('mobile product/cart/checkout, tap targets and consultation persist without health tracking',async p=>{
  await p.setViewportSize({width:390,height:844});await product(p);await accept(p);await p.screenshot({path:'verified-product-mobile.png'});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const size=await p.locator('#qty-plus').boundingBox();expect(size.width).toBeGreaterThanOrEqual(44);expect(size.height).toBeGreaterThanOrEqual(44);
  await p.locator('#btn-book-consultation').click();await p.locator('#cd-book-btn').click();await p.locator('#cd-name').fill('Local Test');await p.locator('#cd-phone').fill('03001234567');await p.locator('#cd-agree').check();const before=(await state()).contact_messages.length;await p.locator('.cd-submit-btn').click();await expect(p.locator('#cd-screen-success')).toBeVisible();expect((await state()).contact_messages.length).toBe(before+1);expect(await events(p,'Lead')).toHaveLength(0);
  await p.locator('#cd-return-btn').click();await expect(p.locator('#cd-overlay')).toHaveCSS('visibility','hidden');await p.locator('#btn-add-cart').click();await expect(p.locator('#cart-drawer')).toHaveClass(/open/);await p.screenshot({path:'verified-cart-mobile.png',animations:'disabled'});await p.goto(base+'/checkout.html');await expect(p.locator('#co-name')).toBeVisible();expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await p.screenshot({path:'verified-checkout-mobile.png',animations:'disabled'});
  await fillCheckout(p);await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-success')).toBeVisible();await expect.poll(()=>p.evaluate(()=>scrollY)).toBe(0);expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await p.screenshot({path:'verified-confirmation-mobile.png',animations:'disabled'});
 });
 await scenario('privacy withdrawal suppresses queued conversion and unsafe URLs never initialize Pixel',async p=>{
  await product(p);await accept(p);await p.locator('#btn-add-cart').click();await p.goto(base+'/checkout.html');await fillCheckout(p);await p.locator('#checkout-page-form button[type=submit]').click();await expect(p.locator('#checkout-success')).toBeVisible();const id=(await events(p,'Purchase'))[0][4].eventID;
  await p.locator('.hanaz-privacy-settings').click();await p.locator('[data-consent=no]').click();await expect(p.locator('#hanaz-consent')).toHaveCount(0);expect((await state()).hanaz_meta_outbox.find(x=>x.id===id).status).toBe('suppressed');
  await p.goto(base+'/products.html?phone=private');await p.locator('.hanaz-privacy-settings').click();await p.locator('[data-consent=yes]').click();expect(await p.evaluate(()=>typeof fbq)).toBe('undefined');
 });
 await scenario('failed cart persistence does not emit AddToCart or mutate cart',async p=>{
  await product(p);await accept(p);await p.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('denied')};});await p.locator('#btn-add-cart').click();expect(await events(p,'AddToCart')).toHaveLength(0);expect(await p.evaluate(()=>HanazCart.getItems().length)).toBe(0);
 });
 await scenario('mobile menu, legacy product link, auth validation and safe order lookup',async p=>{
  await p.setViewportSize({width:390,height:844});await p.goto(base);await p.locator('[data-consent=no]').click();await expect(p.locator('#hanaz-consent')).toHaveCount(0);
  await p.locator('#hamburger-btn').click();await expect(p.locator('#mobile-nav-drawer')).toHaveClass(/open/);await p.locator('#mobile-nav-drawer').getByRole('link',{name:'Shop',exact:true}).click();await expect(p).toHaveURL(/products.html/);
  await p.goto(base+'/pdp-vitamin-c.html?id=hanaz-vitamin-c-serum');await expect(p).toHaveURL(/id=7ff4066c/);await expect(p.locator('#btn-add-cart')).toBeVisible();
  await p.goto(base+'/signup.html');await p.locator('#signup-form button[type=submit]').click();await expect(p.locator('#signup-name-error')).toContainText('name');await expect(p.locator('#signup-password-error')).toContainText('password');expect(await events(p)).toHaveLength(0);
  await p.goto(base+'/login.html');await p.locator('#login-form button[type=submit]').click();await expect(p.locator('#login-email-error')).toContainText('email');
  await p.goto(base+'/track-order.html');await p.locator('#track-phone').fill('03001234567');await p.locator('#track-submit-btn').click();await expect(p.locator('#track-error')).toBeVisible();expect(await events(p)).toHaveLength(0);
 });
 fs.writeFileSync('browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await b.close();if(results.some(r=>r.status==='FAILED'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
