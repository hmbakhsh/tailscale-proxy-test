import { chromium, type Browser, type Page } from "playwright";
import { mkdir } from "fs/promises";

const PCSE_BASE_URL = "https://secure.pcse.england.nhs.uk";
const PCSE_LOGIN_URL = `${PCSE_BASE_URL}/AccountPortal/Account/Login`;
const PCSE_SUCCESS_URL = `${PCSE_BASE_URL}/HomePortal/Organisation/SelectOrganisation`;

const SCREENSHOTS_DIR = "./screenshots";

async function ensureScreenshotsDir() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
}

async function checkExitNodeIP(page: Page): Promise<string> {
  console.log("Checking outbound IP via api.ipify.org...");

  await page.goto("https://api.ipify.org?format=json");
  const response = await page.locator("body").textContent();
  const ip = JSON.parse(response || "{}").ip;

  console.log(`Outbound IP: ${ip}`);

  return ip;
}

async function loginToPCSE(page: Page): Promise<boolean> {
  const username = process.env.PCSE_USERNAME;
  const password = process.env.PCSE_PASSWORD;
  const practiceCode = process.env.PCSE_PRACTICE_CODE;

  if (!username || !password || !practiceCode) {
    throw new Error("PCSE_USERNAME, PCSE_PASSWORD, and PCSE_PRACTICE_CODE must be set");
  }

  console.log(`Navigating to PCSE login page...`);
  await page.goto(PCSE_LOGIN_URL);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-login-page.png`, fullPage: true });

  console.log("Filling credentials...");
  await page.locator("#PlaceHolderMain_signInControl_UserName").fill(username);
  await page.locator("#PlaceHolderMain_signInControl_password").pressSequentially(password);

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-credentials-filled.png`, fullPage: true });

  console.log("Clicking sign in...");
  await page.locator("#PlaceHolderMain_signInControl_login").click();

  // Race: success URL vs error element
  const result = await Promise.race([
    page.waitForURL(PCSE_SUCCESS_URL, { timeout: 30000 }).then(() => "success" as const),
    page.locator("#PlaceHolderMain_signInControl_FailureText").waitFor({ state: "visible", timeout: 30000 }).then(() => "failure" as const),
  ]);

  if (result === "success") {
    console.log("Login successful!");
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-login-success.png`, fullPage: true });
    return true;
  } else {
    const errorText = await page.locator("#PlaceHolderMain_signInControl_FailureText").textContent();
    console.error(`Login failed: ${errorText}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-login-failed.png`, fullPage: true });
    return false;
  }
}

async function selectPractice(page: Page, practiceCode: string): Promise<boolean> {
  console.log(`Selecting practice: ${practiceCode}...`);

  // Click the organisation dropdown
  await page.locator("#Organisation-button").click();

  // Select the practice from the dropdown menu
  await page.locator(`#Organisation-menu li:has-text("${practiceCode}")`).click();

  // Click the Continue button
  await page.locator('input[type="button"][value="Continue"]').click();

  // Wait for navigation to HomePortal
  try {
    await page.waitForURL("**/HomePortal/**", { timeout: 30000 });
    console.log("Practice selected successfully!");
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-practice-selected.png`, fullPage: true });
    return true;
  } catch (error) {
    console.error("Failed to select practice:", error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-practice-failed.png`, fullPage: true });
    return false;
  }
}

async function navigateToGOS1Form(page: Page): Promise<boolean> {
  console.log("Navigating to GOS form selection page...");

  await page.goto(`${PCSE_BASE_URL}/OPH/Home/Claim/`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-gos-selection-page.png`, fullPage: true });

  console.log("Clicking GOS1 button...");
  await page.locator('button:has-text("GOS1")').click();

  try {
    await page.waitForURL("**/OPH/Ophthalmic/GOSOne**", { timeout: 30000 });
    console.log("GOS1 form reached successfully!");
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-gos1-form-reached.png`, fullPage: true });
    return true;
  } catch (error) {
    console.error("Failed to reach GOS1 form:", error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-gos1-failed.png`, fullPage: true });
    return false;
  }
}

async function main() {
  await ensureScreenshotsDir();

  const proxyUrl = process.env.TAILSCALE_PROXY_URL;

  console.log("=".repeat(50));
  console.log("Tailscale Proxy POC Test");
  console.log("=".repeat(50));
  console.log(`Proxy URL: ${proxyUrl || "NONE (direct connection)"}`);
  console.log("");

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: process.env.HEADLESS !== "false",
      ...(proxyUrl && {
        proxy: {
          server: proxyUrl,
          bypass: "localhost,127.0.0.1",
        },
        args: [
          // Force remote DNS resolution through the SOCKS5 proxy
          // This prevents DNS leaks by blocking local DNS resolution
          `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE tailscale`,
        ],
      }),
    });

    const page = await browser.newPage();
    const practiceCode = process.env.PCSE_PRACTICE_CODE!;

    // Step 1: Check IP
    const ip = await checkExitNodeIP(page);

    // Step 2: Login to PCSE
    const loginSuccess = await loginToPCSE(page);
    if (!loginSuccess) {
      console.log("");
      console.log("=".repeat(50));
      console.log("RESULTS");
      console.log("=".repeat(50));
      console.log(`Exit Node IP: ${ip}`);
      console.log(`Login Result: FAILED`);
      console.log(`Screenshots: ${SCREENSHOTS_DIR}/`);
      console.log("=".repeat(50));
      process.exit(1);
    }

    // Step 3: Select practice
    const practiceSelected = await selectPractice(page, practiceCode);
    if (!practiceSelected) {
      console.log("");
      console.log("=".repeat(50));
      console.log("RESULTS");
      console.log("=".repeat(50));
      console.log(`Exit Node IP: ${ip}`);
      console.log(`Login Result: SUCCESS`);
      console.log(`Practice Selection: FAILED`);
      console.log(`Screenshots: ${SCREENSHOTS_DIR}/`);
      console.log("=".repeat(50));
      process.exit(1);
    }

    // Step 4: Navigate to GOS1 form
    const gos1Reached = await navigateToGOS1Form(page);

    console.log("");
    console.log("=".repeat(50));
    console.log("RESULTS");
    console.log("=".repeat(50));
    console.log(`Exit Node IP: ${ip}`);
    console.log(`Login Result: SUCCESS`);
    console.log(`Practice Selection: SUCCESS`);
    console.log(`GOS1 Form Reached: ${gos1Reached ? "SUCCESS" : "FAILED"}`);
    console.log(`Screenshots: ${SCREENSHOTS_DIR}/`);
    console.log("=".repeat(50));

    process.exit(gos1Reached ? 0 : 1);
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  } finally {
    await browser?.close();
  }
}

main();
