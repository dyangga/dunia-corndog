import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
if (process.env.ALLOW_REVIEW_WRITES !== "1")
  throw Error("Set ALLOW_REVIEW_WRITES=1 only for the local demo database.");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dc-monorepo-"));
const chrome = spawn(
  process.env.CHROME_PATH ||
    "/home/desta/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell",
  [
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
const out = path.join(process.cwd(), "artifacts/review");
fs.mkdirSync(out, { recursive: true });
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = fs
        .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
        .split("\n")[0];
      break;
    } catch {}
    await pause(100);
  }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const browserErrors = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown") {
      browserErrors.push(m.params.exceptionDetails);
      console.log(
        "Browser error:",
        m.params.exceptionDetails.text,
        m.params.exceptionDetails.exception?.description?.slice(0, 300),
      );
    }
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails)
      throw Error(
        r.result.exceptionDetails.exception?.description ||
          r.result.exceptionDetails.text,
      );
    return r.result?.result?.value;
  };
  const wait = async (expr) => {
    for (let i = 0; i < 120; i++) {
      if (await ev(expr)) return;
      await pause(250);
    }
    throw Error(
      "Timed out: " +
        expr +
        " / " +
        (await ev("document.body?.innerText?.slice(0,500)")),
    );
  };
  const click = async (expr) => {
    console.log("Click target:", expr.slice(0, 130));
    await ev(
      `(()=>{const e=${expr};if(!e)throw Error('Missing click target');e.scrollIntoView({block:'center'});e.click();})()`,
    );
    await pause(150);
  };
  const button = (text) =>
    `Array.from(document.querySelectorAll('button,[role="button"]')).find(e=>e.textContent.trim()===${JSON.stringify(text)})`;
  const fill = async (selector, value) => {
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`,
    );
    await send("Input.insertText", { text: value });
  };
  const shot = async (name) => {
    await pause(250);
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      `${out}/${name}.png`,
      Buffer.from(r.result.data, "base64"),
    );
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://localhost:3000/login" });
  await wait('!!document.querySelector("input[name=username]")');
  await fill("input[name=username]", "owner");
  await fill("input[name=password]", "OwnerReview123!");
  await click('document.querySelector("button[type=submit]")');
  await wait('!!document.querySelector(".sidebar")');
  if (
    !(await ev(
      'fetch("/api/v1/owner/state").then(r=>r.json()).then(s=>s.business?.includes("data contoh"))',
    ))
  )
    throw Error(
      "Browser review writes are restricted to the labelled demo business.",
    );
  console.log("Owner login OK");
  await click(button("Tim & shift"));
  await wait(
    'Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Tambah anggota"))',
  );
  await click(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Tambah anggota'))`,
  );
  await wait('!!document.querySelector("input[name=username]")');
  const suffix = Date.now().toString().slice(-6),
    username = `review.${suffix}`,
    edited = `kasir.${suffix}`;
  await fill("input[name=name]", "Kasir Review");
  await fill("input[name=username]", username);
  await fill("input[name=password]", "KasirAwal123!");
  await ev(
    `Array.from(document.querySelectorAll('[role=dialog] label')).filter(l=>l.htmlFor.startsWith('staff-')).forEach(l=>{const b=document.getElementById(l.htmlFor);const wanted=l.textContent==='Dipatiukur';if((b.dataset.state==='checked')!==wanted)b.click();})`,
  );
  await shot("owner-add-staff");
  await click('document.querySelector("[role=dialog] button[type=submit]")');
  await wait('!document.querySelector("[role=dialog]")');
  await wait(
    `document.body?.textContent?.includes(${JSON.stringify(username)})`,
  );
  console.log("Owner created cashier OK");
  await click(
    `Array.from(document.querySelectorAll('tr')).find(tr=>tr.textContent.includes(${JSON.stringify(username)})).querySelector('button')`,
  );
  await wait('!!document.querySelector("input[name=username]")');
  await fill("input[name=username]", edited);
  await fill("input[name=password]", "KasirBaru123!");
  await click('document.querySelector("[role=dialog] button[type=submit]")');
  await wait('!document.querySelector("[role=dialog]")');
  await shot("owner-staff");
  console.log("Owner edited credentials OK");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1180,
    height: 820,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://localhost:8081" });
  await wait('!!document.querySelector("input[aria-label=Username]")');
  await fill("input[aria-label=Username]", edited);
  await fill("input[aria-label=Password]", "KasirBaru123!");
  await click(button("Masuk sebagai kasir"));
  await wait('document.body?.textContent?.includes("Buat pesanan baru")');
  console.log("Expo Web native-component login with edited credentials OK");
  await shot("expo-pos-tablet");
  await click(button("Buka shift"));
  await wait(
    "Array.from(document.querySelectorAll('input')).some(e=>e.getAttribute('aria-label')==='Kas awal (Rp)')",
  );
  await fill('input[aria-label="Kas awal (Rp)"]', "100000");
  await click(
    `Array.from(document.querySelectorAll('[role=button],button')).filter(e=>e.textContent.trim()==='Buka shift').at(-1)`,
  );
  await wait('document.body?.textContent?.includes("Shift aktif")');
  console.log("Expo open shift OK");
  await click(`document.querySelector('[aria-label="Small corndog"]')`);
  await wait('document.body?.textContent?.includes("Small Corndog")');
  await shot("expo-customize-tablet");
  await click(
    `Array.from(document.querySelectorAll('[role=checkbox]')).find(e=>e.getAttribute('aria-label')?.startsWith('Kentang,'))`,
  );
  await click(
    `Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.startsWith('Tambah ·'))`,
  );
  await click(button("Lanjut pembayaran"));
  await wait('document.body?.textContent?.includes("Selesaikan pembayaran")');
  await click(button("Uang pas"));
  await click(
    `Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.startsWith('Konfirmasi ·'))`,
  );
  await wait(
    'document.body?.textContent?.includes("Pesanan berhasil dicatat")',
  );
  await shot("expo-receipt-tablet");
  console.log("Expo checkout + server receipt OK");
  await click(button("Buat pesanan berikutnya"));
  await click(
    `Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.getAttribute('aria-label')==='Antrean')`,
  );
  await wait('document.body?.textContent?.includes("Mulai proses")');
  await click(button("Mulai proses"));
  await wait('document.body?.textContent?.includes("Tandai siap")');
  console.log("Expo queue state advance OK");
  await send("Network.enable");
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await click(button("Keluar"));
  await wait('!!document.querySelector("input[aria-label=Username]")');
  console.log("Cashier local logout works offline");
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await shot("expo-queue-phone");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await wait('document.body?.textContent?.includes("Penjualan neto")');
  await shot("owner-dashboard-phone");
  console.log("Owner sees connected dashboard after cashier checkout OK");
  if (browserErrors.length)
    throw Error(`${browserErrors.length} uncaught browser runtime error(s)`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill("SIGTERM");
}
