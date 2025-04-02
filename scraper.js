// scraper.js
const { Builder, By, until } = require('selenium-webdriver');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const fetch = require('node-fetch');

const STORAGE_FILE = 'prices.txt';
const EMAIL_TO = 'scrape@showeb.net';
const TIMEOUT_MS = 30000;

const sites = {
   woolworths: {
       url: 'https://www.woolworths.com.au/shop/productdetails/694888',
       method: 'selenium',
       selector: '.product-price_component_price-lead__vlm8f'
   },
   coles: {
       url: 'https://www.coles.com.au/product/optimum-adult-furball-dry-cat-food-with-chicken-2kg-3250864',
       method: 'fetch',
       priceRegex: /price":\s*"(\d+\.\d+)/
   }
};

async function fetchPrice(site, config) {
   if (config.method === 'selenium') {
       const driver = await new Builder().forBrowser('chrome').build();
       try {
           await driver.get(config.url);
           const priceElement = await driver.wait(until.elementLocated(By.css(config.selector)), TIMEOUT_MS);
           const priceText = await priceElement.getText();
           console.log(`Raw price for ${site}: ${priceText}`);
           return parseFloat(priceText.replace(/[^0-9.]/g, ''));
       } finally {
           await driver.quit();
       }
   } else {
       const response = await fetch(config.url);
       const html = await response.text();
       const match = html.match(config.priceRegex);
       if (!match) throw new Error('Price not found');
       return parseFloat(match[1]);
   }
}

async function scrape(isDryRun = false) {
   const prices = await loadPrices();
   
   for (const [site, config] of Object.entries(sites)) {
       try {
           const price = await fetchPrice(site, config);
           
           if (!prices[site]) {
               prices[site] = price;
               continue;
           }

           if (price !== prices[site]) {
               await sendAlert(`Price changed for ${site}:\nOld: $${prices[site]}\nNew: $${price}\nURL: ${config.url}`, isDryRun);
               prices[site] = price;
           }
       } catch (e) {
           await sendAlert(`Error accessing ${site}: ${e.message}`, isDryRun);
       }
   }
   await savePrices(prices);
}

async function loadPrices() {
   try {
       const data = await fs.readFile(STORAGE_FILE, 'utf8');
       return JSON.parse(data);
   } catch {
       return {};
   }
}

async function savePrices(prices) {
   await fs.writeFile(STORAGE_FILE, JSON.stringify(prices));
}

async function sendAlert(msg, isDryRun) {
   if (isDryRun) {
       console.log(msg);
       return;
   }
   
   const transporter = nodemailer.createTransport({
       sendmail: true
   });
   
   await transporter.sendMail({
       from: 'scraper@localhost',
       to: EMAIL_TO,
       subject: 'Price Alert',
       text: msg
   });
}

if (require.main === module) {
   scrape(process.argv.includes('--test'));
}