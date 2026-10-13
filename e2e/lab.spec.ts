import {test,expect} from "@playwright/test";

test("one-click-free simulator auto-generates a phone, opens offers, caches and never contacts production",async({page})=>{
  const external:string[]=[];
  page.on("request",request=>{
    const url=request.url();
    if(url.startsWith("http")&&!url.startsWith("http://127.0.0.1:5179/"))external.push(url);
  });
  await page.goto("/flexy-mini/demo.html");
  await expect(page.getByText("مختبر Flexy Mini — محاكاة معزولة 100%")).toBeVisible();
  const beneficiary=page.locator('input[aria-label="رقم الهاتف المراد شحنه"]');
  await expect(beneficiary).toHaveValue(/^055\d{7}$/);
  await expect(page.getByText("العروض المتاحة")).toBeVisible();
  await expect(page.getByText("جاري فتح استعلام الشبكة...")).toHaveCount(0,{timeout:12000});
  await expect.poll(async()=>page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("flexy_mini_simulator_v1")||"{}");
    return Object.keys(s.phones||{}).length;
  })).toBe(1);
  await expect(page.getByRole("button",{name:"استكشاف العروض"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"تأكيد الاستعلام"})).toHaveCount(0);
  const first=await beneficiary.inputValue();
  await page.getByRole("button",{name:"رقم جديد + عروض"}).click();
  await expect(beneficiary).not.toHaveValue(first);
  await expect(beneficiary).toHaveValue(/^055\d{7}$/);
  await expect.poll(async()=>page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("flexy_mini_simulator_v1")||"{}");
    return Object.keys(s.phones||{}).length;
  })).toBeGreaterThanOrEqual(2);
  expect(external).toEqual([]);
});

test("MSW keeps state across page reload, simulator reset clears it, and no real API is called",async({page})=>{
  const external:string[]=[];
  page.on("request",r=>{
    if(r.url().startsWith("http")&&!r.url().startsWith("http://127.0.0.1:5179/"))external.push(r.url());
  });
  await page.goto("/flexy-mini/demo.html");
  await expect.poll(async()=>page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem("flexy_mini_simulator_v1")||"{}");
    return Object.keys(data.phones||{}).length;
  })).toBe(1);
  const phone=await page.locator('input[aria-label="رقم الهاتف المراد شحنه"]').inputValue();
  await page.reload();
  // New generated number on every lab launch, with both phones remembered locally.
  await expect.poll(async()=>page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem("flexy_mini_simulator_v1")||"{}");
    return Object.keys(data.phones||{}).length;
  })).toBeGreaterThanOrEqual(2);
  await page.getByRole("button",{name:"مسح التجارب"}).click();
  await expect.poll(async()=>page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem("flexy_mini_simulator_v1")||"{}");
    return Object.keys(data.phones||{}).length;
  })).toBe(1);
  expect(phone).toMatch(/^055\d{7}$/);
  expect(external).toEqual([]);
});
