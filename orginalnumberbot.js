/******************** IMPORTS ********************/
const { Telegraf, session, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const { authenticator } = require('otplib');

/******************** CONFIG ********************/
const BOT_TOKEN = "8616303624:AAE4-fTR-YQuPD3KEAFzLqc5WQP4wfqWw3I";
const ADMIN_PASSWORD = "mamun1132";
const NUMBERS_PER_USER = 2;
const ADMIN_USERNAME = "@rana1132";

const MAIN_CHANNEL = "@updaterange";
const CHAT_GROUP = "@updaterange1";
const OTP_GROUP = "@otpreceived1";
const OTP_GROUP_ID = -1001153782407;

// CSV Backup Group
const USER_CSV_CHAT_ID = -5168617650;

// Default earnings per OTP
const DEFAULT_EARNINGS = 0.25;

// Configure otplib
if (authenticator && authenticator.options) {
  authenticator.options = {
    digits: 6,
    step: 30,
    window: 0
  };
}

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN not set correctly");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

/******************** FILES ********************/
const NUMBERS_FILE = path.join(__dirname, "numbers.txt");
const COUNTRIES_FILE = path.join(__dirname, "countries.json");
const USERS_FILE = path.join(__dirname, "users.json");
const SERVICES_FILE = path.join(__dirname, "services.json");
const ACTIVE_NUMBERS_FILE = path.join(__dirname, "active_numbers.json");
const OTP_LOG_FILE = path.join(__dirname, "otp_log.json");
const USER_BALANCES_FILE = path.join(__dirname, "user_balances.json");

/******************** DATA ********************/
let countries = {};
if (fs.existsSync(COUNTRIES_FILE)) {
  try {
    countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading countries:", e);
    countries = {};
  }
} else {
  countries = {
    "58": { name: "Venezuela", flag: "🇻🇪", earnings: 0.25 },
    "963": { name: "Syria", flag: "🇸🇾", earnings: 0.25 },
    "880": { name: "Bangladesh", flag: "🇧🇩", earnings: 0.20 },
    "91": { name: "India", flag: "🇮🇳", earnings: 0.15 },
    "92": { name: "Pakistan", flag: "🇵🇰", earnings: 0.15 },
    "1": { name: "USA", flag: "🇺🇸", earnings: 0.35 },
    "44": { name: "UK", flag: "🇬🇧", earnings: 0.30 },
    "977": { name: "Nepal", flag: "🇳🇵", earnings: 0.12 },
    "20": { name: "Egypt", flag: "🇪🇬", earnings: 0.10 }
  };
  saveCountries();
}

let services = {};
if (fs.existsSync(SERVICES_FILE)) {
  try {
    services = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading services:", e);
    services = {};
  }
} else {
  services = {
    "whatsapp": { name: "WhatsApp", icon: "📱", earnings: 0.25 },
    "telegram": { name: "Telegram", icon: "✈️", earnings: 0.20 },
    "facebook": { name: "Facebook", icon: "📘", earnings: 0.18 },
    "instagram": { name: "Instagram", icon: "📸", earnings: 0.22 },
    "google": { name: "Google", icon: "🔐", earnings: 0.15 },
    "verification": { name: "Verification", icon: "✅", earnings: 0.12 },
    "other": { name: "Other", icon: "🔧", earnings: 0.10 }
  };
  saveServices();
}

let numbersByCountryService = {};
if (fs.existsSync(NUMBERS_FILE)) {
  try {
    const lines = fs.readFileSync(NUMBERS_FILE, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const lineTrimmed = line.trim();
      if (!lineTrimmed) continue;
      let number, countryCode, service;
      if (lineTrimmed.includes("|")) {
        const parts = lineTrimmed.split("|");
        if (parts.length >= 3) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          service = parts[2].trim();
        } else if (parts.length === 2) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          service = "other";
        } else continue;
      } else {
        number = lineTrimmed;
        countryCode = getCountryCodeFromNumber(number);
        service = "other";
      }
      if (!/^\d{10,15}$/.test(number)) continue;
      if (!countryCode) continue;
      numbersByCountryService[countryCode] = numbersByCountryService[countryCode] || {};
      numbersByCountryService[countryCode][service] = numbersByCountryService[countryCode][service] || [];
      if (!numbersByCountryService[countryCode][service].includes(number)) {
        numbersByCountryService[countryCode][service].push(number);
      }
    }
    console.log(`✅ Loaded ${Object.values(numbersByCountryService).flatMap(c => Object.values(c).flat()).length} numbers`);
  } catch (e) {
    console.error("❌ Error loading numbers:", e);
    numbersByCountryService = {};
  }
}

let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading users:", e);
    users = {};
  }
}

let activeNumbers = {};
if (fs.existsSync(ACTIVE_NUMBERS_FILE)) {
  try {
    activeNumbers = JSON.parse(fs.readFileSync(ACTIVE_NUMBERS_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading active numbers:", e);
    activeNumbers = {};
  }
}

let otpLog = [];
if (fs.existsSync(OTP_LOG_FILE)) {
  try {
    otpLog = JSON.parse(fs.readFileSync(OTP_LOG_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading OTP log:", e);
    otpLog = [];
  }
}

let userBalances = {};
if (fs.existsSync(USER_BALANCES_FILE)) {
  try {
    userBalances = JSON.parse(fs.readFileSync(USER_BALANCES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error loading user balances:", e);
    userBalances = {};
  }
}

// 2FA Data Storage
let twoFactorData = {};

/******************** HELPER FUNCTIONS ********************/
function saveNumbers() {
  try {
    const lines = [];
    for (const countryCode in numbersByCountryService) {
      for (const service in numbersByCountryService[countryCode]) {
        for (const number of numbersByCountryService[countryCode][service]) {
          lines.push(`${number}|${countryCode}|${service}`);
        }
      }
    }
    fs.writeFileSync(NUMBERS_FILE, lines.join("\n"));
  } catch (error) {
    console.error("❌ Error saving numbers:", error);
  }
}

function saveCountries() {
  try {
    fs.writeFileSync(COUNTRIES_FILE, JSON.stringify(countries, null, 2));
  } catch (error) {
    console.error("❌ Error saving countries:", error);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("❌ Error saving users:", error);
  }
}

function saveServices() {
  try {
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
  } catch (error) {
    console.error("❌ Error saving services:", error);
  }
}

function saveActiveNumbers() {
  try {
    fs.writeFileSync(ACTIVE_NUMBERS_FILE, JSON.stringify(activeNumbers, null, 2));
  } catch (error) {
    console.error("❌ Error saving active numbers:", error);
  }
}

function saveOTPLog() {
  try {
    fs.writeFileSync(OTP_LOG_FILE, JSON.stringify(otpLog.slice(-1000), null, 2));
  } catch (error) {
    console.error("❌ Error saving OTP log:", error);
  }
}

function saveUserBalances() {
  try {
    fs.writeFileSync(USER_BALANCES_FILE, JSON.stringify(userBalances, null, 2));
  } catch (error) {
    console.error("❌ Error saving user balances:", error);
  }
}

function getCountryCodeFromNumber(n) {
  const numStr = n.toString();
  const code3 = numStr.slice(0, 3);
  if (countries[code3]) return code3;
  const code2 = numStr.slice(0, 2);
  if (countries[code2]) return code2;
  const code1 = numStr.slice(0, 1);
  if (countries[code1]) return code1;
  return null;
}

function getEarningsForServiceCountry(serviceId, countryCode) {
  const serviceEarnings = services[serviceId]?.earnings || DEFAULT_EARNINGS;
  const countryEarnings = countries[countryCode]?.earnings || DEFAULT_EARNINGS;
  return Math.min(serviceEarnings, countryEarnings);
}

function updateUserBalance(userId, amount, phoneNumber, serviceId, countryCode) {
  if (!userBalances[userId]) {
    userBalances[userId] = {
      balance: 0,
      totalEarned: 0,
      transactions: []
    };
  }
  userBalances[userId].balance += amount;
  userBalances[userId].totalEarned += amount;
  userBalances[userId].transactions.push({
    amount: amount,
    phoneNumber: phoneNumber,
    service: serviceId,
    country: countryCode,
    timestamp: new Date().toISOString()
  });
  saveUserBalances();
  return userBalances[userId].balance;
}

function getUserBalance(userId) {
  return userBalances[userId]?.balance || 0;
}

function getAvailableCountriesForService(service) {
  const availableCountries = [];
  for (const countryCode in numbersByCountryService) {
    if (numbersByCountryService[countryCode][service] && 
        numbersByCountryService[countryCode][service].length > 0 &&
        countries[countryCode]) {
      availableCountries.push(countryCode);
    }
  }
  return availableCountries;
}

function getNumbersByCountryAndService(count, countryCode, service, userId) {
  if (!numbersByCountryService[countryCode] || !numbersByCountryService[countryCode][service]) return null;
  const available = numbersByCountryService[countryCode][service];
  if (available.length < count) return null;
  const numbers = [];
  for (let i = 0; i < count; i++) {
    const number = available.shift();
    numbers.push(number);
    activeNumbers[number] = {
      userId: userId,
      countryCode: countryCode,
      service: service,
      assignedAt: new Date().toISOString(),
      lastOTP: null,
      otpCount: 0
    };
  }
  saveNumbers();
  saveActiveNumbers();
  return numbers;
}

function extractPhoneNumberFromMessage(text) {
  if (!text) return null;
  const patterns = [
    /Number[^\d]*[:»][^\d]*(\d{4}[★\*]{3,}\d{4})/i,
    /☎️[^\d]*[:»][^\d]*(\d{4}[★\*]{3,}\d{4})/,
    /(\d{4}[★\*]{3,}\d{4})/,
    /(\+?\d{10,15})/,
    /(\d{3}[-]\d{3}[-]\d{4})/,
    /(\d{4}\s\d{4})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let number = match[1] || match[0];
      number = number.replace(/[\★\*\s\-\+\(\)]/g, '');
      if (/^\d{10,15}$/.test(number)) return number;
    }
  }
  return null;
}

async function forwardOTPMessageToUser(phoneNumber, originalMessageId, otpText = null) {
  if (!activeNumbers[phoneNumber]) return false;
  const userId = activeNumbers[phoneNumber].userId;
  const serviceId = activeNumbers[phoneNumber].service;
  const countryCode = activeNumbers[phoneNumber].countryCode;
  
  const earnings = getEarningsForServiceCountry(serviceId, countryCode);
  const newBalance = updateUserBalance(userId, earnings, phoneNumber, serviceId, countryCode);
  
  otpLog.push({
    phoneNumber: phoneNumber,
    userId: userId,
    service: serviceId,
    country: countryCode,
    timestamp: new Date().toISOString(),
    delivered: true,
    earnings: earnings
  });
  saveOTPLog();
  
  try {
    const service = services[serviceId];
    const country = countries[countryCode];
    await bot.telegram.sendMessage(userId, 
      `✅ *OTP Received!*\n\n` +
      `📱 *Service:* ${service?.icon || '📞'} ${service?.name || serviceId}\n` +
      `${country?.flag || '🏳️'} *Country:* ${country?.name || countryCode}\n` +
      `📞 *Number:* \`+${countryCode} ${phoneNumber.slice(countryCode.length)}\`\n` +
      `💰 *Earned:* +${earnings.toFixed(2)} TK\n` +
      `💳 *New Balance:* ${newBalance.toFixed(2)} TK\n\n` +
      `📨 *Check OTP Group for the code:* ${OTP_GROUP}`,
      { parse_mode: "Markdown" }
    );
    
    await bot.telegram.forwardMessage(userId, OTP_GROUP_ID, originalMessageId);
    console.log(`✅ OTP forwarded to user ${userId}, earned ${earnings} TK`);
    return true;
  } catch (error) {
    console.error(`❌ OTP forward error:`, error.message);
    return false;
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + " years ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + " months ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + " days ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hours ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

function escapeMarkdown(text) {
  if (!text) return '';
  const specialChars = /[_*[\]()~`>#+\-=|{}.!]/g;
  return text.replace(specialChars, '\\$&');
}

async function safeEditMessage(ctx, text, extra = {}) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
      return;
    }
    if (err.description && err.description.includes("can't parse entities")) {
      const { parse_mode, ...rest } = extra;
      await ctx.editMessageText(text, rest);
      return;
    }
    throw err;
  }
}

/******************** UI FUNCTIONS ********************/

// Start Message
async function showStartMessage(ctx) {
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `- Click the buttons below to join:\n\n` +
    `1️⃣ Main Channel\n` +
    `2️⃣ Number Channel\n` +
    `3️⃣ OTP Group\n\n` +
    `✅ VERIFY MEMBERSHIP`;
  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "1️⃣ Main Channel", url: `https://t.me/${MAIN_CHANNEL.replace('@', '')}` }],
        [{ text: "2️⃣ Number Channel", url: `https://t.me/${CHAT_GROUP.replace('@', '')}` }],
        [{ text: "3️⃣ OTP Group", url: `https://t.me/${OTP_GROUP.replace('@', '')}` }],
        [{ text: "✅ VERIFY MEMBERSHIP", callback_data: "verify_user" }]
      ]
    }
  });
}

// Verification Success
async function showVerificationSuccess(ctx) {
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `✅ *VERIFICATION SUCCESSFUL!*\n\n` +
    `You can now use all bot features.`;
  await ctx.reply(message, { parse_mode: "Markdown" });
  await showMainMenu(ctx);
}

// Main Menu
async function showMainMenu(ctx) {
  await ctx.reply(
    `*UPDATE OTP BOT 2.0*`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          ["📞 Get Number", "🔐 2FA"],
          ["📧 Get Tempmail", "💰 Balances"],
          ["💸 Withdraw", "🆘 Support"]
        ],
        resize_keyboard: true
      }
    }
  );
}

// Service List Message
async function showServiceListMessage(ctx) {
  const serviceButtons = [];
  for (const serviceId in services) {
    const service = services[serviceId];
    let totalAvailable = 0;
    for (const countryCode in numbersByCountryService) {
      if (numbersByCountryService[countryCode][serviceId]) {
        totalAvailable += numbersByCountryService[countryCode][serviceId].length;
      }
    }
    if (totalAvailable > 0) {
      serviceButtons.push([{
        text: `${service.icon} ${service.name} (${totalAvailable})`,
        callback_data: `user_select_service:${serviceId}`
      }]);
    }
  }
  serviceButtons.push([{ text: "❌ Cancel", callback_data: "admin_cancel" }]);

  await ctx.reply(`*UPDATE OTP BOT 2.0*`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: serviceButtons
    }
  });
}

// Country Selection Message
async function showServiceSelectionMessage(ctx, serviceId) {
  const service = services[serviceId];
  const availableCountries = getAvailableCountriesForService(serviceId);
  
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `*${service.icon} ${service.name} – Select Country*\n\n` +
    `❤️ Balance will be added automatically when OTP arrives *(taka = earnings per OTP)*`;
  
  const countryButtons = [];
  for (const countryCode of availableCountries) {
    const country = countries[countryCode];
    const earnings = getEarningsForServiceCountry(serviceId, countryCode);
    countryButtons.push([{
      text: `${country.flag} ${country.name} (${earnings}TK)`,
      callback_data: `user_select_country:${serviceId}:${countryCode}`
    }]);
  }
  countryButtons.push([{ text: "🔙 Back to Services", callback_data: "back_to_services" }]);
  
  await safeEditMessage(ctx, message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: countryButtons }
  });
}

// Numbers Message
async function showNumbersMessage(ctx, numbers, serviceId, countryCode, messageId = null) {
  const service = services[serviceId];
  const country = countries[countryCode];
  const earnings = getEarningsForServiceCountry(serviceId, countryCode);

  let numbersList = "";
  numbers.forEach((num, idx) => {
    const displayNumber = `+${countryCode}  ${num.slice(countryCode.length)}`;
    numbersList += `${idx + 1}. \`${displayNumber}\`\n`;
  });

  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `✅ *${numbers.length} New Number(s)!*\n` +
    `🔺 *Service:* ${service?.icon || '📞'} ${service?.name || serviceId}\n` +
    `🔺 *Country:* ${country?.flag || '🏳️'} ${country?.name || countryCode}\n` +
    `🔘 *Earnings per OTP:* ${earnings} taka\n\n` +
    `📱 *Numbers:*\n${numbersList}\n\n` +
    `♻️ *Waiting for OTP*`;

  const inlineKeyboard = [
    [{ text: "📨 Open OTP Group", url: `https://t.me/${OTP_GROUP.replace('@', '')}` }],
    [{ text: "🔄 Get New Numbers", callback_data: `refresh_numbers_inline:${serviceId}:${countryCode}` }]
  ];

  if (messageId) {
    try {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } catch (err) {
      console.log("Edit failed, sending new message:", err.message);
      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
  } else {
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }
}

/******************** 2FA SYSTEM ********************/

async function show2FAMenu(ctx) {
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `Select a service to generate 2FA code:`;
  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📘 Facebook 2FA", callback_data: "2fa_facebook" }],
        [{ text: "📸 Instagram 2FA", callback_data: "2fa_instagram" }],
        [{ text: "🔐 Google 2FA", callback_data: "2fa_google" }],
        [{ text: "❌ Cancel", callback_data: "2fa_cancel" }]
      ]
    }
  });
}

async function showSecretKeySetup(ctx, service, userId) {
  const serviceNames = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "google": "Google"
  };
  const serviceInstructions = {
    "facebook": "Facebook: Settings → Security → Two-Factor Authentication → Authenticator App → Setup Key",
    "instagram": "Instagram: Settings → Security → Two-Factor Authentication → Authentication App → Manual key",
    "google": "Google: Google Account → Security → 2-Step Verification → Authenticator app → Setup"
  };
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `*${serviceNames[service]} 2FA Setup*\n\n` +
    `Send your Authenticator Secret Key.\n\n` +
    `It looks like: \`JBSWY3DPEHPK3PXP\`\n\n` +
    `*Where to find your key:*\n` +
    `- ${serviceInstructions[service]}\n\n` +
    `Type /cancel to cancel`;
  const keyboard = {
    inline_keyboard: [[{ text: "❌ Cancel", callback_data: "2fa_cancel" }]]
  };
  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
  ctx.session.adminState = "waiting_2fa_secret";
  ctx.session.adminData = { service: service, userId: userId };
}

async function showTOTPCode(ctx, service, userId, isEdit = false) {
  const userData = twoFactorData[userId];
  if (!userData || !userData.verified) {
    return await showSecretKeySetup(ctx, service, userId);
  }
  try {
    let code, remainingSeconds;
    try {
      code = authenticator.generate(userData.secretKey);
      remainingSeconds = authenticator.timeRemaining();
    } catch (genError) {
      const epoch = Math.floor(Date.now() / 1000);
      const interval = Math.floor(epoch / 30);
      code = (interval % 1000000).toString().padStart(6, '0');
      remainingSeconds = 30 - (epoch % 30);
    }
    const progressPercent = ((30 - remainingSeconds) / 30) * 100;
    const barLength = 20;
    const filledLength = Math.floor((progressPercent / 100) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    const message = 
      `*UPDATE OTP BOT 2.0*\n\n` +
      `The current 2FA verification code is\n` +
      `*${code}*\n\n` +
      `*(${remainingSeconds} seconds)*\n\n` +
      `[${progressBar}] ${Math.floor(progressPercent)}%\n\n` +
      `- *Demonstration Key:*\n` +
      `  \`JBSWY3DPEHPK3PXP\` (click to copy)`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔄 Refresh Code", callback_data: `2fa_refresh_code:${service}` }],
        [{ text: "🔑 Change Secret Key", callback_data: `2fa_change_secret:${service}` }],
        [{ text: "❌ Cancel", callback_data: "2fa_cancel" }]
      ]
    };
    if (isEdit && ctx.callbackQuery && ctx.callbackQuery.message) {
      await safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
    }
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      twoFactorData[userId].messageId = ctx.callbackQuery.message.message_id;
      twoFactorData[userId].chatId = ctx.callbackQuery.message.chat.id;
    }
  } catch (error) {
    console.error("TOTP generation error:", error);
    await ctx.reply(
      `*UPDATE OTP BOT 2.0*\n\n` +
      `❌ *Error generating code*\n\n` +
      `The secret key may be invalid.\n` +
      `Please try again with a valid Base32 secret key.\n\n` +
      `*Example:* \`JBSWY3DPEHPK3PXP\`\n\n` +
      `Type /cancel to cancel`,
      { parse_mode: "Markdown" }
    );
    delete twoFactorData[userId];
  }
}

async function verifyAndShowCode(ctx, secretKey, service, userId) {
  let cleanSecret = secretKey.toUpperCase().replace(/\s/g, '');
  cleanSecret = cleanSecret.replace(/[^A-Z2-7]/g, '');
  const isValidBase32 = /^[A-Z2-7]+$/.test(cleanSecret);
  if (!isValidBase32 || cleanSecret.length < 16) {
    return await ctx.reply(
      `*UPDATE OTP BOT 2.0*\n\n` +
      `❌ *Invalid Secret Key*\n\n` +
      `Please enter a valid Base32 secret key.\n\n` +
      `*Requirements:*\n` +
      `• Letters A-Z only\n` +
      `• Numbers 2-7 only\n` +
      `• Minimum 16 characters\n` +
      `• No spaces or special characters\n\n` +
      `*Example:* \`JBSWY3DPEHPK3PXP\`\n\n` +
      `Type /cancel to cancel`,
      { parse_mode: "Markdown" }
    );
  }
  twoFactorData[userId] = {
    service: service,
    secretKey: cleanSecret,
    verified: true,
    step: 'verified',
    createdAt: Date.now()
  };
  await showTOTPCode(ctx, service, userId);
}

/******************** SESSION MIDDLEWARE ********************/
bot.use(session({
  defaultSession: () => ({
    verified: false,
    isAdmin: false,
    adminState: null,
    adminData: null,
    currentNumbers: [],
    currentService: null,
    currentCountry: null,
    lastNumberTime: 0,
    numbersMessageId: null
  })
}));

bot.use(async (ctx, next) => {
  if (ctx.from) {
    const userId = ctx.from.id;
    if (!users[userId]) {
      users[userId] = {
        id: userId,
        username: ctx.from.username || 'no_username',
        first_name: ctx.from.first_name || 'User',
        last_name: ctx.from.last_name || '',
        joined: new Date().toISOString(),
        last_active: new Date().toISOString()
      };
      saveUsers();
      await uploadUserCSV();
    } else {
      users[userId].last_active = new Date().toISOString();
      saveUsers();
    }
    if (!userBalances[userId]) {
      userBalances[userId] = {
        balance: 0,
        totalEarned: 0,
        transactions: []
      };
      saveUserBalances();
    }
  }
  ctx.session = ctx.session || {
    verified: false,
    isAdmin: false,
    adminState: null,
    adminData: null,
    currentNumbers: [],
    currentService: null,
    currentCountry: null,
    lastNumberTime: 0,
    numbersMessageId: null
  };
  return next();
});

/******************** CSV BACKUP FUNCTIONS ********************/
function generateUsersCSV() {
  const allUsers = Object.values(users);
  let csv = "ID,First Name,Last Name,Username,Joined Date,Last Active,Balance,Numbers Count\n";
  for (const user of allUsers) {
    const numbersCount = Object.values(activeNumbers).filter(a => a.userId === user.id).length;
    const balance = userBalances[user.id]?.balance || 0;
    csv += `${user.id},"${user.first_name || ''}","${user.last_name || ''}",` +
           `"${user.username || ''}","${user.joined}","${user.last_active}",${balance},${numbersCount}\n`;
  }
  return Buffer.from(csv, 'utf8');
}

async function uploadUserCSV() {
  try {
    const csvBuffer = generateUsersCSV();
    const fileName = `users_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`;
    await bot.telegram.sendDocument(USER_CSV_CHAT_ID, {
      source: csvBuffer,
      filename: fileName
    }, {
      caption: `📊 *User List Update*\nTotal Users: ${Object.keys(users).length}`,
      parse_mode: "Markdown"
    });
    console.log(`✅ CSV uploaded to ${USER_CSV_CHAT_ID}. Users: ${Object.keys(users).length}`);
  } catch (error) {
    console.error("CSV upload failed:", error.message);
  }
}

/******************** START COMMAND ********************/
bot.start((ctx) => {
  try {
    ctx.session.verified = false;
    ctx.session.isAdmin = false;
    ctx.session.adminState = null;
    ctx.session.adminData = null;
    ctx.session.currentNumbers = [];
    ctx.session.currentService = null;
    ctx.session.currentCountry = null;
    ctx.session.lastNumberTime = 0;
    ctx.session.numbersMessageId = null;
    showStartMessage(ctx);
  } catch (error) {
    console.error("Start command error:", error);
    ctx.reply("❌ Error starting bot. Please try again.");
  }
});

/******************** VERIFICATION ********************/
bot.action("verify_user", async (ctx) => {
  try {
    await ctx.answerCbQuery("⏳ Verifying...");
    const userId = ctx.from.id;
    const chatsToCheck = [
      { name: "Main Channel", identifier: MAIN_CHANNEL },
      { name: "Number Channel", identifier: CHAT_GROUP },
      { name: "OTP Group", identifier: OTP_GROUP }
    ];
    let notJoined = [];
    for (const chat of chatsToCheck) {
      try {
        const member = await ctx.telegram.getChatMember(chat.identifier, userId);
        const status = member.status;
        if (!['member', 'administrator', 'creator'].includes(status)) {
          notJoined.push(chat.name);
        }
      } catch (err) {
        console.log(`Error checking ${chat.name}:`, err.message);
        notJoined.push(chat.name);
      }
    }
    if (notJoined.length > 0) {
      const failedList = notJoined.join(', ');
      const errorMessage = 
        `❌ *Verification Failed*\n\n` +
        `You haven't joined the following:\n${failedList}\n\n` +
        `Please join ALL groups first and try again.\n\n` +
        `- Click the buttons below to join:\n\n` +
        `1️⃣ Main Channel\n2️⃣ Number Channel\n3️⃣ OTP Group`;
      await safeEditMessage(ctx, errorMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "1️⃣ Main Channel", url: `https://t.me/${MAIN_CHANNEL.replace('@', '')}` }],
            [{ text: "2️⃣ Number Channel", url: `https://t.me/${CHAT_GROUP.replace('@', '')}` }],
            [{ text: "3️⃣ OTP Group", url: `https://t.me/${OTP_GROUP.replace('@', '')}` }],
            [{ text: "✅ VERIFY MEMBERSHIP", callback_data: "verify_user" }]
          ]
        }
      });
      return;
    }
    ctx.session.verified = true;
    await showVerificationSuccess(ctx);
  } catch (error) {
    console.error("Verification error:", error);
    await ctx.answerCbQuery("❌ Verification failed", { show_alert: true });
  }
});

/******************** MAIN MENU HANDLERS ********************/
bot.hears("📞 Get Number", async (ctx) => {
  try {
    if (!ctx.session.verified) return showStartMessage(ctx);
    if (ctx.session.numbersMessageId) {
      try { await ctx.deleteMessage(ctx.session.numbersMessageId); } catch(e) {}
      ctx.session.numbersMessageId = null;
    }
    await showServiceListMessage(ctx);
  } catch (error) {
    console.error("Get number error:", error);
    ctx.reply("❌ Error. Please try again.");
  }
});

bot.hears("🔐 2FA", async (ctx) => {
  try {
    if (!ctx.session.verified) return showStartMessage(ctx);
    await show2FAMenu(ctx);
  } catch (error) {
    console.error("2FA menu error:", error);
    ctx.reply("❌ Error loading 2FA menu");
  }
});

bot.hears("💰 Balances", async (ctx) => {
  const balance = getUserBalance(ctx.from.id);
  const totalEarned = userBalances[ctx.from.id]?.totalEarned || 0;
  const transactions = userBalances[ctx.from.id]?.transactions || [];
  const recentTransactions = transactions.slice(-5).reverse();
  let transactionList = "";
  if (recentTransactions.length > 0) {
    transactionList = "\n*Recent Earnings:*\n";
    for (const tx of recentTransactions) {
      const service = services[tx.service];
      const country = countries[tx.country];
      transactionList += `• ${service?.icon || '📞'} ${tx.service} (${country?.flag || '🏳️'}): +${tx.amount} TK\n`;
    }
  } else {
    transactionList = "\n*No earnings yet.*\n";
  }
  await ctx.reply(
    `*UPDATE OTP BOT 2.0*\n\n` +
    `*💰 Your Balance*\n\n` +
    `💳 *Current Balance:* ${balance.toFixed(2)} TK\n` +
    `📈 *Total Earned:* ${totalEarned.toFixed(2)} TK\n` +
    transactionList +
    `\n💡 *Tip:* Each OTP you receive adds ${DEFAULT_EARNINGS} TK to your balance!`,
    { parse_mode: "Markdown" }
  );
});

bot.hears("💸 Withdraw", async (ctx) => {
  const balance = getUserBalance(ctx.from.id);
  if (balance < 10) {
    return ctx.reply(
      `*UPDATE OTP BOT 2.0*\n\n` +
      `❌ *Insufficient Balance*\n\n` +
      `Your current balance: ${balance.toFixed(2)} TK\n` +
      `Minimum withdrawal: 10 TK\n\n` +
      `Keep using the bot to earn more!`,
      { parse_mode: "Markdown" }
    );
  }
  await ctx.reply(
    `*UPDATE OTP BOT 2.0*\n\n` +
    `💸 *Withdrawal Request*\n\n` +
    `💰 Your Balance: ${balance.toFixed(2)} TK\n\n` +
    `Please send your payment method details:\n` +
    `• bKash / Nagad / Rocket number\n` +
    `• Or USDT (TRC20/BEP20) address\n\n` +
    `⚠️ *Minimum withdrawal:* 10 TK\n` +
    `⏰ *Processing time:* 24-48 hours\n\n` +
    `Send your payment details in this format:\n` +
    `\`Method: [bKash/Nagad/USDT]\n` +
    `Account: [your account]\n` +
    `Amount: ${balance.toFixed(2)} TK\``,
    { parse_mode: "Markdown" }
  );
  ctx.session.adminState = "waiting_withdraw";
  ctx.session.adminData = { userId: ctx.from.id, amount: balance };
});

bot.hears("🆘 Support", async (ctx) => {
  const message = 
    `*UPDATE OTP BOT 2.0*\n\n` +
    `*Contact our support team:*\n\n` +
    `- *Admin:* ${ADMIN_USERNAME}\n` +
    `- *Support Group:* ${CHAT_GROUP}`;
  await ctx.reply(message, { parse_mode: "Markdown" });
});

bot.hears("📧 Get Tempmail", async (ctx) => {
  await ctx.reply(
    `*UPDATE OTP BOT 2.0*\n\n` +
    `📧 *Temporary Email*\n\n` +
    `This feature is coming soon!\n\n` +
    `Stay tuned for updates.`,
    { parse_mode: "Markdown" }
  );
});

/******************** USER SERVICE HANDLERS ********************/
bot.action("back_to_services", async (ctx) => {
  try {
    await showServiceListMessage(ctx);
  } catch (error) {
    console.error("Back to services error:", error);
  }
});

bot.action(/^user_select_service:(.+)$/, async (ctx) => {
  try {
    const serviceId = ctx.match[1];
    const service = services[serviceId];
    if (!service) {
      return ctx.answerCbQuery("❌ Service not found", { show_alert: true });
    }
    const availableCountries = getAvailableCountriesForService(serviceId);
    if (availableCountries.length === 0) {
      return ctx.answerCbQuery("❌ No numbers available for this service", { show_alert: true });
    }
    await showServiceSelectionMessage(ctx, serviceId);
  } catch (error) {
    console.error("Service selection error:", error);
    ctx.answerCbQuery("❌ Error selecting service", { show_alert: true });
  }
});

bot.action(/^user_select_country:(.+):(.+)$/, async (ctx) => {
  try {
    const serviceId = ctx.match[1];
    const countryCode = ctx.match[2];
    const userId = ctx.from.id;
    const now = Date.now();
    const timeSinceLast = now - ctx.session.lastNumberTime;
    const cooldown = 5000;
    if (timeSinceLast < cooldown) {
      const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
      return ctx.answerCbQuery(`⏳ Wait ${remaining}s`, { show_alert: true });
    }
    const numbers = getNumbersByCountryAndService(NUMBERS_PER_USER, countryCode, serviceId, userId);
    if (!numbers) return ctx.answerCbQuery(`❌ Need ${NUMBERS_PER_USER} numbers but not enough available`, { show_alert: true });
    if (ctx.session.currentNumbers.length > 0) {
      for (const oldNum of ctx.session.currentNumbers) delete activeNumbers[oldNum];
      saveActiveNumbers();
    }
    ctx.session.currentNumbers = numbers;
    ctx.session.currentService = serviceId;
    ctx.session.currentCountry = countryCode;
    ctx.session.lastNumberTime = now;
    const messageId = ctx.callbackQuery?.message?.message_id;
    await showNumbersMessage(ctx, numbers, serviceId, countryCode, messageId);
  } catch (error) {
    console.error("Country selection error:", error);
    await ctx.answerCbQuery("❌ Error getting numbers", { show_alert: true });
  }
});

bot.action(/^refresh_numbers_inline:(.+):(.+)$/, async (ctx) => {
  try {
    const serviceId = ctx.match[1];
    const countryCode = ctx.match[2];
    const userId = ctx.from.id;
    const now = Date.now();
    const timeSinceLast = now - ctx.session.lastNumberTime;
    const cooldown = 5000;
    if (timeSinceLast < cooldown) {
      const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
      return ctx.answerCbQuery(`⏳ Wait ${remaining}s`, { show_alert: true });
    }
    const numbers = getNumbersByCountryAndService(NUMBERS_PER_USER, countryCode, serviceId, userId);
    if (!numbers) return ctx.answerCbQuery(`❌ Need ${NUMBERS_PER_USER} numbers but not enough`, { show_alert: true });
    if (ctx.session.currentNumbers.length > 0) {
      for (const oldNum of ctx.session.currentNumbers) delete activeNumbers[oldNum];
      saveActiveNumbers();
    }
    ctx.session.currentNumbers = numbers;
    ctx.session.currentService = serviceId;
    ctx.session.currentCountry = countryCode;
    ctx.session.lastNumberTime = now;
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      await showNumbersMessage(ctx, numbers, serviceId, countryCode, messageId);
    } else {
      await showNumbersMessage(ctx, numbers, serviceId, countryCode);
    }
    await ctx.answerCbQuery("✅ Numbers updated!");
  } catch (error) {
    console.error("Refresh numbers error:", error);
    ctx.answerCbQuery("❌ Error refreshing numbers", { show_alert: true });
  }
});

/******************** 2FA HANDLERS ********************/
bot.action("2fa_facebook", async (ctx) => {
  try {
    await ctx.answerCbQuery("⏳ Setting up Facebook 2FA...");
    const userId = ctx.from.id;
    if (twoFactorData[userId] && twoFactorData[userId].verified && twoFactorData[userId].service === 'facebook') {
      await showTOTPCode(ctx, 'facebook', userId);
    } else {
      await showSecretKeySetup(ctx, 'facebook', userId);
    }
  } catch (error) {
    console.error("Facebook 2FA error:", error);
    ctx.answerCbQuery("❌ Error", { show_alert: true });
  }
});

bot.action("2fa_instagram", async (ctx) => {
  try {
    await ctx.answerCbQuery("⏳ Setting up Instagram 2FA...");
    const userId = ctx.from.id;
    if (twoFactorData[userId] && twoFactorData[userId].verified && twoFactorData[userId].service === 'instagram') {
      await showTOTPCode(ctx, 'instagram', userId);
    } else {
      await showSecretKeySetup(ctx, 'instagram', userId);
    }
  } catch (error) {
    console.error("Instagram 2FA error:", error);
    ctx.answerCbQuery("❌ Error", { show_alert: true });
  }
});

bot.action("2fa_google", async (ctx) => {
  try {
    await ctx.answerCbQuery("⏳ Setting up Google 2FA...");
    const userId = ctx.from.id;
    if (twoFactorData[userId] && twoFactorData[userId].verified && twoFactorData[userId].service === 'google') {
      await showTOTPCode(ctx, 'google', userId);
    } else {
      await showSecretKeySetup(ctx, 'google', userId);
    }
  } catch (error) {
    console.error("Google 2FA error:", error);
    ctx.answerCbQuery("❌ Error", { show_alert: true });
  }
});

bot.action(/^2fa_refresh_code:(.+)$/, async (ctx) => {
  try {
    const service = ctx.match[1];
    const userId = ctx.from.id;
    await ctx.answerCbQuery("🔄 Refreshing code...");
    await showTOTPCode(ctx, service, userId, true);
  } catch (error) {
    console.error("Refresh code error:", error);
    ctx.answerCbQuery("❌ Error", { show_alert: true });
  }
});

bot.action(/^2fa_change_secret:(.+)$/, async (ctx) => {
  try {
    const service = ctx.match[1];
    const userId = ctx.from.id;
    await ctx.answerCbQuery("🔑 Enter new secret key...");
    if (twoFactorData[userId] && twoFactorData[userId].interval) {
      clearInterval(twoFactorData[userId].interval);
    }
    delete twoFactorData[userId];
    await showSecretKeySetup(ctx, service, userId);
  } catch (error) {
    console.error("Change secret error:", error);
    ctx.answerCbQuery("❌ Error", { show_alert: true });
  }
});

bot.action("2fa_cancel", async (ctx) => {
  try {
    const userId = ctx.from.id;
    if (twoFactorData[userId] && twoFactorData[userId].interval) {
      clearInterval(twoFactorData[userId].interval);
    }
    delete twoFactorData[userId];
    ctx.session.adminState = null;
    ctx.session.adminData = null;
    const message = 
      `*UPDATE OTP BOT 2.0*\n\n` +
      `Type /cancel to cancel\n\n` +
      `✖ Cancel\n\n` +
      `/cancel\n\n` +
      `✔ Cancelled.`;
    await safeEditMessage(ctx, message, { parse_mode: "Markdown" });
    setTimeout(async () => {
      try { await showMainMenu(ctx); } catch(e) {}
    }, 2000);
  } catch (error) {
    console.error("Cancel 2FA error:", error);
    await ctx.answerCbQuery("Cancelled", { show_alert: true });
  }
});

/******************** ADMIN COMMANDS ********************/
bot.command("adminlogin", async (ctx) => {
  try {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
      // Do nothing – no message sent
      return;
    }
    const password = parts[1];
    if (password === ADMIN_PASSWORD) {
      ctx.session.isAdmin = true;
      ctx.session.verified = true;
      await ctx.reply(
        `*UPDATE OTP BOT 2.0*\n\n` +
        `✅ *Admin Login Successful!*\n\n` +
        `You now have administrator privileges.\n` +
        `Use /admin to access admin panel.`,
        { parse_mode: "Markdown" }
      );
      await showMainMenu(ctx);
    } else {
      await ctx.reply(
        `*UPDATE OTP BOT 2.0*\n\n` +
        `❌ Wrong password. Access denied.`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (error) {
    console.error("Admin login error:", error);
    await ctx.reply("❌ Error during admin login.");
  }
});

bot.command("admin", async (ctx) => {
  try {
    if (!ctx.session.isAdmin) {
      // Do nothing – no message sent
      return;
    }
    const adminMessage = 
      `*UPDATE OTP BOT 2.0*\n\n` +
      `*🛠 ADMIN DASHBOARD*\n\n` +
      `Select an option below:`;
    await ctx.reply(adminMessage, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Stock Report", callback_data: "admin_stock" }],
          [{ text: "👥 User Statistics", callback_data: "admin_users" }],
          [{ text: "📂 Upload Numbers", callback_data: "admin_upload" }],
          [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }],
          [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }],
          [{ text: "🌍 Add Country", callback_data: "admin_add_country" }],
          [{ text: "🔧 Add Service", callback_data: "admin_add_service" }],
          [{ text: "🗑️ Delete Service", callback_data: "admin_delete_service" }],
          [{ text: "📋 List Services", callback_data: "admin_list_services" }],
          [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }],
          [{ text: "📥 Restore CSV", callback_data: "admin_restore_csv" }],
          [{ text: "🚪 Logout", callback_data: "admin_logout" }]
        ]
      }
    });
  } catch (error) {
    console.error("Admin command error:", error);
    await ctx.reply("❌ Error loading admin panel.");
  }
});

/******************** ADMIN ACTION HANDLERS ********************/

// Stock Report
bot.action("admin_stock", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("⏳ Loading stock report...");
  let report = "📊 *STOCK REPORT*\n\n";
  let totalNumbers = 0;
  for (const countryCode in numbersByCountryService) {
    const country = countries[countryCode];
    const countryName = country ? `${country.flag} ${country.name}` : `Country ${countryCode}`;
    report += `\n${countryName} (+${countryCode}):\n`;
    let countryTotal = 0;
    for (const serviceId in numbersByCountryService[countryCode]) {
      const service = services[serviceId];
      const serviceName = service ? `${service.icon} ${service.name}` : serviceId;
      const count = numbersByCountryService[countryCode][serviceId].length;
      if (count > 0) {
        report += `  • ${serviceName}: ${count}\n`;
        countryTotal += count;
      }
    }
    if (countryTotal > 0) {
      report += `  *Total:* ${countryTotal}\n`;
      totalNumbers += countryTotal;
    }
  }
  report += `\n📈 *Grand Total:* ${totalNumbers} numbers\n`;
  report += `👥 *Active Numbers:* ${Object.keys(activeNumbers).length}\n`;
  report += `📨 *OTPs Forwarded:* ${otpLog.filter(log => log.delivered).length}\n`;
  report += `💰 *Total Earnings:* ${Object.values(userBalances).reduce((sum, u) => sum + (u.totalEarned || 0), 0).toFixed(2)} TK`;
  await safeEditMessage(ctx, report, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Admin", callback_data: "admin_back" }]] }
  });
});

// User Statistics
bot.action("admin_users", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  await ctx.answerCbQuery("⏳ Loading user statistics...");
  let message = "👥 *USER STATISTICS*\n\n";
  const totalUsers = Object.keys(users).length;
  const activeNumbersCount = Object.keys(activeNumbers).length;
  const uniqueActiveUsers = new Set(Object.values(activeNumbers).map(a => a.userId)).size;
  const totalOTPs = otpLog.filter(log => log.delivered).length;
  const totalEarnings = Object.values(userBalances).reduce((sum, u) => sum + (u.totalEarned || 0), 0);
  message += `📊 *Statistics:*\n`;
  message += `• Total Users: ${totalUsers}\n`;
  message += `• Active Users: ${uniqueActiveUsers}\n`;
  message += `• Active Numbers: ${activeNumbersCount}\n`;
  message += `• Total OTPs: ${totalOTPs}\n`;
  message += `• Total Earnings: ${totalEarnings.toFixed(2)} TK\n\n`;
  if (totalUsers > 0) {
    message += `📋 *Recent Users (last 5):*\n`;
    const sortedUsers = Object.values(users).sort((a, b) => new Date(b.last_active) - new Date(a.last_active)).slice(0, 5);
    for (const user of sortedUsers) {
      const timeAgo = getTimeAgo(new Date(user.last_active));
      const balance = userBalances[user.id]?.balance || 0;
      message += `\n👤 ${user.first_name}\n🆔 ID: ${user.id}\n💰 Balance: ${balance.toFixed(2)} TK\n🕐 Active: ${timeAgo}\n`;
    }
  }
  await safeEditMessage(ctx, message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Admin", callback_data: "admin_back" }]] }
  });
});

// Upload Numbers
bot.action("admin_upload", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_upload";
  ctx.session.adminData = null;
  const serviceButtons = [];
  for (const serviceId in services) {
    const service = services[serviceId];
    serviceButtons.push([{ text: `${service.icon} ${service.name}`, callback_data: `admin_select_service:${serviceId}` }]);
  }
  serviceButtons.push([{ text: "❌ Cancel", callback_data: "admin_cancel" }]);
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n📂 *Upload Numbers*\n\nSelect service for the numbers:\n\n*Format (one per line):*\n1. Just number: \`8801712345678\`\n2. With country: \`8801712345678|880\`\n3. With country and service: \`8801712345678|880|whatsapp\`\n\n*Note:* Country code will be auto-detected if not provided.\n*Supported:* .txt files only`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: serviceButtons }
  });
});

bot.action(/^admin_select_service:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const serviceId = ctx.match[1];
  const service = services[serviceId];
  ctx.session.adminState = "waiting_upload_file";
  ctx.session.adminData = { serviceId: serviceId };
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n📂 *Upload Numbers for ${service.name}*\n\nSend a .txt file with phone numbers.\n\n*Format (one per line):*\n1. Just number: \`8801712345678\`\n2. With country: \`8801712345678|880\`\n3. With country and service: \`8801712345678|880|${serviceId}\`\n\n*Note:* Country code will be auto-detected if not provided.\n*Supported:* .txt files only`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Add Numbers (manual)
bot.action("admin_add_numbers", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_add_numbers";
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n➕ *Add Numbers Manually*\n\nSend numbers in format:\n\`[number]|[country code]|[service]\`\n\n*Examples:*\n\`8801712345678|880|whatsapp\`\n\`919876543210|91|telegram\`\n\`11234567890|1|facebook\`\n\nYou can send multiple numbers in one message.`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Add Country
bot.action("admin_add_country", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_add_country";
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n🌍 *Add New Country*\n\nSend in format:\n\`[countryCode] [name] [flag]\`\n\n*Examples:*\n\`880 Bangladesh 🇧🇩\`\n\`91 India 🇮🇳\`\n\`1 USA 🇺🇸\`\n\nNote: Country code is dialing code (without +).`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Add Service
bot.action("admin_add_service", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_add_service";
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n🔧 *Add New Service*\n\nSend in format:\n\`[service_id] [name] [icon]\`\n\n*Examples:*\n\`facebook Facebook 📘\`\n\`gmail Gmail 📧\`\n\`instagram Instagram 📸\`\n\nService ID should be lowercase without spaces.`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Delete Numbers
bot.action("admin_delete", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  let report = "❌ *Delete Numbers*\n\nSelect which numbers to delete:\n\n";
  const buttons = [];
  for (const countryCode in numbersByCountryService) {
    const country = countries[countryCode];
    const countryName = country ? `${country.flag} ${country.name}` : `Country ${countryCode}`;
    for (const serviceId in numbersByCountryService[countryCode]) {
      const service = services[serviceId];
      const count = numbersByCountryService[countryCode][serviceId].length;
      if (count > 0) {
        buttons.push([{ text: `🗑️ ${countryName}/${service?.icon || '📞'} ${service?.name || serviceId} (${count})`, callback_data: `admin_delete_confirm:${countryCode}:${serviceId}` }]);
      }
    }
  }
  if (buttons.length === 0) {
    return safeEditMessage(ctx, "📭 *No numbers available to delete.*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
  }
  buttons.push([{ text: "❌ Cancel", callback_data: "admin_cancel" }]);
  await safeEditMessage(ctx, report, { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^admin_delete_confirm:(.+):(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const countryCode = ctx.match[1];
  const serviceId = ctx.match[2];
  const country = countries[countryCode];
  const service = services[serviceId];
  const count = numbersByCountryService[countryCode]?.[serviceId]?.length || 0;
  await safeEditMessage(ctx,
    `⚠️ *Confirm Deletion*\n\nAre you sure you want to delete ${count} numbers?\n${country?.flag || '🏳️'} Country: ${country?.name || countryCode}\nService: ${service?.icon || '📞'} ${service?.name || serviceId}\n\nThis action cannot be undone!`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Yes, Delete", callback_data: `admin_delete_execute:${countryCode}:${serviceId}` }, { text: "❌ Cancel", callback_data: "admin_delete" }]] } }
  );
});

bot.action(/^admin_delete_execute:(.+):(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const countryCode = ctx.match[1];
  const serviceId = ctx.match[2];
  const country = countries[countryCode];
  const service = services[serviceId];
  const count = numbersByCountryService[countryCode]?.[serviceId]?.length || 0;
  delete numbersByCountryService[countryCode][serviceId];
  if (Object.keys(numbersByCountryService[countryCode]).length === 0) delete numbersByCountryService[countryCode];
  saveNumbers();
  await safeEditMessage(ctx,
    `✅ *Deleted Successfully*\n\n🗑️ Deleted ${count} numbers\n${country?.flag || '🏳️'} Country: ${country?.name || countryCode}\n🔧 Service: ${service?.icon || '📞'} ${service?.name || serviceId}`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Admin", callback_data: "admin_back" }]] } }
  );
});

// Delete Service
bot.action("admin_delete_service", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const serviceList = Object.keys(services);
  if (serviceList.length === 0) return safeEditMessage(ctx, "📭 *No services available to delete.*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
  const buttons = serviceList.map(serviceId => {
    const service = services[serviceId];
    return [{ text: `${service.icon} Delete ${service.name}`, callback_data: `admin_delete_service_confirm:${serviceId}` }];
  });
  buttons.push([{ text: "❌ Cancel", callback_data: "admin_back" }]);
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n🗑️ *Delete Service*\n\nSelect a service to delete. This will also delete all numbers under this service!\n\n⚠️ *WARNING:* This action cannot be undone!`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.action(/^admin_delete_service_confirm:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const serviceId = ctx.match[1];
  const service = services[serviceId];
  if (!service) return ctx.answerCbQuery("❌ Service not found", { show_alert: true });
  await safeEditMessage(ctx,
    `⚠️ *Confirm Service Deletion*\n\nAre you sure you want to delete *${service.icon} ${service.name}*?\n\nThis will also delete ALL numbers associated with this service!\n\nThis action cannot be undone!`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Yes, Delete Service", callback_data: `admin_delete_service_execute:${serviceId}` }, { text: "❌ Cancel", callback_data: "admin_delete_service" }]] } }
  );
});

bot.action(/^admin_delete_service_execute:(.+)$/, async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const serviceId = ctx.match[1];
  const service = services[serviceId];
  if (!service) return safeEditMessage(ctx, "❌ Service not found.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
  let totalDeleted = 0;
  for (const countryCode in numbersByCountryService) {
    if (numbersByCountryService[countryCode][serviceId]) {
      totalDeleted += numbersByCountryService[countryCode][serviceId].length;
      delete numbersByCountryService[countryCode][serviceId];
    }
    if (Object.keys(numbersByCountryService[countryCode]).length === 0) delete numbersByCountryService[countryCode];
  }
  for (const number in activeNumbers) {
    if (activeNumbers[number].service === serviceId) delete activeNumbers[number];
  }
  delete services[serviceId];
  saveNumbers();
  saveServices();
  saveActiveNumbers();
  await safeEditMessage(ctx,
    `✅ *Service Deleted Successfully!*\n\n🗑️ Service: ${service.icon} ${service.name}\n📊 Deleted ${totalDeleted} numbers associated with this service.`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back to Admin", callback_data: "admin_back" }]] } }
  );
});

// List Services
bot.action("admin_list_services", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  let report = "📋 *Services List*\n\n";
  for (const serviceId in services) {
    const service = services[serviceId];
    let totalCount = 0;
    for (const countryCode in numbersByCountryService) {
      if (numbersByCountryService[countryCode][serviceId]) totalCount += numbersByCountryService[countryCode][serviceId].length;
    }
    report += `• ${service.icon} *${service.name}* (ID: \`${serviceId}\`)\n  📊 Numbers: ${totalCount}\n  💰 Earnings: ${service.earnings || DEFAULT_EARNINGS} TK/OTP\n\n`;
  }
  await safeEditMessage(ctx, report, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] } });
});

// Broadcast
bot.action("admin_broadcast", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n📢 *Broadcast Options*\n\nChoose how you want to broadcast:\n\n📝 *Text Broadcast* - Send text messages to all users\n🖼️ *Media Broadcast* - Send photos, videos, documents with caption`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [
      [{ text: "📝 Text Broadcast", callback_data: "admin_broadcast_text" }],
      [{ text: "🖼️ Media Broadcast", callback_data: "admin_broadcast_media" }],
      [{ text: "❌ Cancel", callback_data: "admin_cancel" }]
    ] }
  });
});

bot.action("admin_broadcast_text", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_broadcast_text";
  ctx.session.adminData = { type: "text" };
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n📝 *Text Broadcast*\n\nSend the text message you want to broadcast to all users.\n\n*Format:* You can use Markdown formatting.\n*Examples:*\n• \`Hello *users*!\`\n• \`Check [this link](https://example.com)\`\n\n⚠️ *Note:* This will be sent to all registered users.\n\nSend your message now:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

bot.action("admin_broadcast_media", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_broadcast_media";
  ctx.session.adminData = { type: "media" };
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n🖼️ *Media Broadcast*\n\nSend any media file with optional caption:\n\n*Supported Media:*\n• 📸 Photos (jpg, png)\n• 🎥 Videos (mp4)\n• 📄 Documents (pdf, txt)\n• 🎵 Audio (mp3)\n\n*How to send:*\n1. Send a photo/video/document\n2. Add caption if needed\n3. Will be broadcasted to all users\n\n⚠️ *Note:* This will be sent to all registered users.\n\nSend your media now:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Restore CSV
bot.action("admin_restore_csv", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = "waiting_restore_csv";
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n📥 *Restore Users from CSV*\n\nSend a CSV file (users_*.csv) to restore users.\n\n*Note:* This will replace all existing users!`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] }
  });
});

// Cancel & Back
bot.action("admin_cancel", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await safeEditMessage(ctx, `*UPDATE OTP BOT 2.0*\n\n❌ *Action Cancelled*\n\nReturning to admin panel...`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "🛠 Back to Admin", callback_data: "admin_back" }]] }
  });
});

bot.action("admin_back", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  const adminMessage = `*UPDATE OTP BOT 2.0*\n\n*🛠 ADMIN DASHBOARD*\n\nSelect an option below:`;
  await safeEditMessage(ctx, adminMessage, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Stock Report", callback_data: "admin_stock" }],
        [{ text: "👥 User Statistics", callback_data: "admin_users" }],
        [{ text: "📂 Upload Numbers", callback_data: "admin_upload" }],
        [{ text: "➕ Add Numbers", callback_data: "admin_add_numbers" }],
        [{ text: "🗑️ Delete Numbers", callback_data: "admin_delete" }],
        [{ text: "🌍 Add Country", callback_data: "admin_add_country" }],
        [{ text: "🔧 Add Service", callback_data: "admin_add_service" }],
        [{ text: "🗑️ Delete Service", callback_data: "admin_delete_service" }],
        [{ text: "📋 List Services", callback_data: "admin_list_services" }],
        [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }],
        [{ text: "📥 Restore CSV", callback_data: "admin_restore_csv" }],
        [{ text: "🚪 Logout", callback_data: "admin_logout" }]
      ]
    }
  });
});

bot.action("admin_logout", async (ctx) => {
  if (!ctx.session.isAdmin) return ctx.answerCbQuery("❌ Admin only");
  ctx.session.isAdmin = false;
  ctx.session.adminState = null;
  ctx.session.adminData = null;
  await safeEditMessage(ctx, "🚪 *Logged Out Successfully*", { parse_mode: "Markdown" });
  await showMainMenu(ctx);
});

/******************** FILE UPLOAD HANDLER ********************/
bot.on("document", async (ctx) => {
  try {
    const document = ctx.message.document;
    const fileName = document.file_name.toLowerCase();

    // CSV Restore
    if (ctx.session.isAdmin && ctx.session.adminState === "waiting_restore_csv") {
      if (!fileName.endsWith('.csv')) return ctx.reply("❌ Please send a .csv file.");
      await ctx.reply("📥 Processing CSV...");
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      const https = require('https');
      const csvContent = await new Promise((resolve, reject) => {
        https.get(fileLink.href, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        }).on('error', reject);
      });
      try {
        const restored = await restoreUsersFromCSV(csvContent);
        if (fs.existsSync(USERS_FILE)) fs.copyFileSync(USERS_FILE, USERS_FILE + '.backup');
        users = restored;
        saveUsers();
        await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✅ Restored ${Object.keys(users).length} users from CSV.`, { parse_mode: "Markdown" });
        ctx.session.adminState = null;
      } catch (err) {
        await ctx.reply(`❌ Failed to restore: ${err.message}`);
      }
      return;
    }

    // Numbers upload (admin only)
    if (!ctx.session.isAdmin || ctx.session.adminState !== "waiting_upload_file") return;
    if (!fileName.endsWith('.txt')) {
      await ctx.reply("❌ Please send only .txt files.");
      return;
    }
    await ctx.reply("📥 Downloading and processing file...");
    const fileLink = await ctx.telegram.getFileLink(document.file_id);
    const https = require('https');
    const fileContent = await new Promise((resolve, reject) => {
      https.get(fileLink.href, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const serviceId = ctx.session.adminData?.serviceId;
    if (!serviceId) {
      await ctx.reply("❌ Service not selected. Please try again.");
      return;
    }
    const service = services[serviceId];
    if (!service) {
      await ctx.reply("❌ Service not found.");
      return;
    }
    const lines = fileContent.split(/\r?\n/);
    let added = 0, skipped = 0, invalid = 0;
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      let number, countryCode, serviceFromFile;
      if (trimmedLine.includes("|")) {
        const parts = trimmedLine.split("|");
        if (parts.length >= 3) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          serviceFromFile = parts[2].trim();
        } else if (parts.length === 2) {
          number = parts[0].trim();
          countryCode = parts[1].trim();
          serviceFromFile = serviceId;
        } else { invalid++; continue; }
      } else {
        number = trimmedLine;
        countryCode = getCountryCodeFromNumber(number);
        serviceFromFile = serviceId;
      }
      if (!/^\d{10,15}$/.test(number)) { invalid++; continue; }
      if (!countryCode) { invalid++; continue; }
      if (!countries[countryCode]) countries[countryCode] = { name: `Country ${countryCode}`, flag: "🏳️", earnings: DEFAULT_EARNINGS };
      numbersByCountryService[countryCode] = numbersByCountryService[countryCode] || {};
      numbersByCountryService[countryCode][serviceFromFile] = numbersByCountryService[countryCode][serviceFromFile] || [];
      if (!numbersByCountryService[countryCode][serviceFromFile].includes(number)) {
        numbersByCountryService[countryCode][serviceFromFile].push(number);
        added++;
      } else skipped++;
    }
    saveCountries();
    saveNumbers();
    ctx.session.adminState = null;
    ctx.session.adminData = null;
    const totalNumbers = Object.values(numbersByCountryService).flatMap(c => Object.values(c).flat()).length;
    await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✅ *File Upload Complete!*\n\n📁 File: ${document.file_name}\n🔧 Service: ${service.name}\n\n📊 Results:\n✅ Added: *${added}* numbers\n↪️ Skipped (duplicates): *${skipped}*\n❌ Invalid: *${invalid}*\n\n📈 Total numbers now: ${totalNumbers}`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("File handler error:", error);
    await ctx.reply("❌ Error processing file.");
    ctx.session.adminState = null;
    ctx.session.adminData = null;
  }
});

/******************** TEXT HANDLER ********************/
bot.on("text", async (ctx) => {
  try {
    if (!ctx.message || !ctx.message.text) return;
    const text = ctx.message.text;

    // 2FA secret input
    if (ctx.session.adminState === "waiting_2fa_secret") {
      const secretKey = text.trim();
      const service = ctx.session.adminData.service;
      const userId = ctx.session.adminData.userId;
      await verifyAndShowCode(ctx, secretKey, service, userId);
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      return;
    }

    // Withdrawal details
    if (ctx.session.adminState === "waiting_withdraw") {
      const userId = ctx.session.adminData.userId;
      const amount = ctx.session.adminData.amount;
      const methodMatch = text.match(/Method:\s*(\w+)/i);
      const accountMatch = text.match(/Account:\s*(.+)/i);
      if (!methodMatch || !accountMatch) {
        return ctx.reply("❌ Invalid format. Please use:\n`Method: [bKash/Nagad/USDT]\nAccount: [your account]\nAmount: [amount]`", { parse_mode: "Markdown" });
      }
      userBalances[userId].pendingWithdrawal = {
        amount: amount,
        method: methodMatch[1],
        account: accountMatch[1].trim(),
        timestamp: new Date().toISOString()
      };
      saveUserBalances();
      await ctx.reply(`✅ *Withdrawal Request Submitted!*\n\n💰 Amount: ${amount} TK\n📱 Method: ${methodMatch[1]}\n🏦 Account: ${accountMatch[1].trim()}\n\n⏰ Processing time: 24-48 hours`, { parse_mode: "Markdown" });
      await bot.telegram.sendMessage(USER_CSV_CHAT_ID, `💰 *New Withdrawal Request*\n\nUser: ${ctx.from.id}\nAmount: ${amount} TK\nMethod: ${methodMatch[1]}\nAccount: ${accountMatch[1].trim()}`);
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      return;
    }

    // Add numbers (manual)
    if (ctx.session.adminState === "waiting_add_numbers") {
      const lines = text.split('\n');
      let added = 0, failed = 0;
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        let number, countryCode, service;
        if (trimmedLine.includes("|")) {
          const parts = trimmedLine.split("|");
          if (parts.length >= 3) {
            number = parts[0].trim();
            countryCode = parts[1].trim();
            service = parts[2].trim();
          } else if (parts.length === 2) {
            number = parts[0].trim();
            countryCode = parts[1].trim();
            service = "other";
          } else { failed++; continue; }
        } else {
          number = trimmedLine;
          countryCode = getCountryCodeFromNumber(number);
          service = "other";
        }
        if (!/^\d{10,15}$/.test(number)) { failed++; continue; }
        if (!countryCode) { failed++; continue; }
        numbersByCountryService[countryCode] = numbersByCountryService[countryCode] || {};
        numbersByCountryService[countryCode][service] = numbersByCountryService[countryCode][service] || [];
        if (!numbersByCountryService[countryCode][service].includes(number)) {
          numbersByCountryService[countryCode][service].push(number);
          added++;
        } else { failed++; }
      }
      saveNumbers();
      await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✅ *Numbers Added!*\n\n✅ Added: *${added}*\n❌ Failed: *${failed}*\n\n📊 Total numbers now: ${Object.values(numbersByCountryService).flatMap(c => Object.values(c).flat()).length}`, { parse_mode: "Markdown" });
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      return;
    }

    // Add country
    if (ctx.session.adminState === "waiting_add_country") {
      const countryParts = text.trim().split(/\s+/);
      if (countryParts.length >= 3) {
        const countryCode = countryParts[0];
        const countryName = countryParts.slice(1, -1).join(" ");
        const flag = countryParts[countryParts.length - 1];
        countries[countryCode] = { name: countryName, flag: flag, earnings: DEFAULT_EARNINGS };
        saveCountries();
        await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✅ *Country Added Successfully!*\n\n📌 *Code:* +${countryCode}\n🏳️ *Name:* ${countryName}\n${flag} *Flag:* ${flag}\n💰 *Earnings:* ${DEFAULT_EARNINGS} TK/OTP`, { parse_mode: "Markdown" });
        ctx.session.adminState = null;
        ctx.session.adminData = null;
      } else {
        await ctx.reply("❌ Invalid format. Use: `[code] [name] [flag]`", { parse_mode: "Markdown" });
      }
      return;
    }

    // Add service
    if (ctx.session.adminState === "waiting_add_service") {
      const serviceParts = text.trim().split(/\s+/);
      if (serviceParts.length >= 3) {
        const serviceId = serviceParts[0].toLowerCase();
        const serviceName = serviceParts.slice(1, -1).join(" ");
        const icon = serviceParts[serviceParts.length - 1];
        services[serviceId] = { name: serviceName, icon: icon, earnings: DEFAULT_EARNINGS };
        saveServices();
        await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✅ *Service Added Successfully!*\n\n📌 *ID:* \`${serviceId}\`\n🔧 *Name:* ${serviceName}\n${icon} *Icon:* ${icon}\n💰 *Earnings:* ${DEFAULT_EARNINGS} TK/OTP`, { parse_mode: "Markdown" });
        ctx.session.adminState = null;
        ctx.session.adminData = null;
      } else {
        await ctx.reply("❌ Invalid format. Use: `[id] [name] [icon]`", { parse_mode: "Markdown" });
      }
      return;
    }

    // Text broadcast
    if (ctx.session.adminState === "waiting_broadcast_text") {
      let sent = 0, failedBroadcast = 0;
      const totalUsers = Object.keys(users).length;
      await ctx.reply(`📢 *Starting Text Broadcast*\n\nSending to ${totalUsers} users...`, { parse_mode: "Markdown" });
      for (const userId in users) {
        try {
          await ctx.telegram.sendMessage(userId, text, { parse_mode: "Markdown", disable_web_page_preview: false });
          sent++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Broadcast failed for user ${userId}:`, error.message);
          failedBroadcast++;
        }
      }
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n📢 *Text Broadcast Complete!*\n\n✅ Sent: *${sent}* users\n❌ Failed: *${failedBroadcast}* users\n📝 Total users: ${totalUsers}`, { parse_mode: "Markdown" });
      return;
    }

    // OTP Forwarding from text messages
    if (ctx.chat.id === OTP_GROUP_ID) {
      const messageText = text;
      const messageId = ctx.message.message_id;
      if (!messageText) return;
      let extractedNumber = extractPhoneNumberFromMessage(messageText);
      if (!extractedNumber) {
        const allActiveNumbers = Object.keys(activeNumbers);
        for (const activeNumber of allActiveNumbers) {
          const last4 = activeNumber.slice(-4), last5 = activeNumber.slice(-5), last6 = activeNumber.slice(-6);
          if (messageText.includes(last4) || messageText.includes(last5) || messageText.includes(last6)) {
            extractedNumber = activeNumber; break;
          }
        }
      }
      if (!extractedNumber) {
        const allActiveNumbers = Object.keys(activeNumbers);
        for (const activeNumber of allActiveNumbers) {
          const countryCode = activeNumbers[activeNumber].countryCode;
          const numberWithoutCountry = activeNumber.slice(countryCode.length);
          const fullNumber = `+${countryCode}${numberWithoutCountry}`;
          if (messageText.includes(activeNumber) || messageText.includes(fullNumber) || messageText.includes(numberWithoutCountry)) {
            extractedNumber = activeNumber; break;
          }
        }
      }
      if (extractedNumber && activeNumbers[extractedNumber]) {
        await forwardOTPMessageToUser(extractedNumber, messageId, messageText);
      }
      return;
    }

    // Cancel command
    if (text === "/cancel") {
      const userId = ctx.from.id;
      if (twoFactorData[userId] && twoFactorData[userId].interval) clearInterval(twoFactorData[userId].interval);
      delete twoFactorData[userId];
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n✔ Cancelled.`, { parse_mode: "Markdown" });
      await showMainMenu(ctx);
      return;
    }
  } catch (error) {
    console.error("Text handler error:", error);
  }
});

/******************** MEDIA/OTP HANDLER ********************/
bot.on(["photo", "video", "document", "audio"], async (ctx) => {
  try {
    // Media broadcast
    if (ctx.session.isAdmin && ctx.session.adminState === "waiting_broadcast_media") {
      let mediaType = "", fileId = "";
      let caption = ctx.message.caption || "";
      if (ctx.message.photo) {
        mediaType = "photo";
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.message.video) {
        mediaType = "video";
        fileId = ctx.message.video.file_id;
      } else if (ctx.message.document) {
        mediaType = "document";
        fileId = ctx.message.document.file_id;
      } else if (ctx.message.audio) {
        mediaType = "audio";
        fileId = ctx.message.audio.file_id;
      }
      await ctx.reply(`📢 *Starting Media Broadcast*\n\nType: ${mediaType}\nCaption: ${caption || "No caption"}\n\nSending to all users...`, { parse_mode: "Markdown" });
      let sent = 0, failed = 0;
      const totalUsers = Object.keys(users).length;
      for (const userId in users) {
        try {
          switch (mediaType) {
            case "photo": await ctx.telegram.sendPhoto(userId, fileId, { caption: caption, parse_mode: "Markdown" }); break;
            case "video": await ctx.telegram.sendVideo(userId, fileId, { caption: caption, parse_mode: "Markdown" }); break;
            case "document": await ctx.telegram.sendDocument(userId, fileId, { caption: caption, parse_mode: "Markdown" }); break;
            case "audio": await ctx.telegram.sendAudio(userId, fileId, { caption: caption, parse_mode: "Markdown" }); break;
          }
          sent++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Media broadcast failed for user ${userId}:`, error.message);
          failed++;
        }
      }
      ctx.session.adminState = null;
      ctx.session.adminData = null;
      await ctx.reply(`*UPDATE OTP BOT 2.0*\n\n🖼️ *Media Broadcast Complete!*\n\n📁 Type: ${mediaType}\n✅ Sent: *${sent}* users\n❌ Failed: *${failed}* users\n📝 Total users: ${totalUsers}`, { parse_mode: "Markdown" });
      return;
    }

    // OTP Forwarding
    if (ctx.chat.id === OTP_GROUP_ID) {
      const messageText = ctx.message.caption || '';
      const messageId = ctx.message.message_id;
      if (!messageText) return;
      let extractedNumber = extractPhoneNumberFromMessage(messageText);
      if (!extractedNumber) {
        const allActiveNumbers = Object.keys(activeNumbers);
        for (const activeNumber of allActiveNumbers) {
          const last4 = activeNumber.slice(-4);
          if (messageText.includes(last4)) {
            extractedNumber = activeNumber; break;
          }
        }
      }
      if (extractedNumber && activeNumbers[extractedNumber]) {
        await forwardOTPMessageToUser(extractedNumber, messageId, messageText);
      }
    }
  } catch (error) {
    console.error("Media/OTP handler error:", error);
  }
});

/******************** RESTORE USERS FROM CSV ********************/
async function restoreUsersFromCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV is empty");
  const restoredUsers = {};
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 6) continue;
    const userId = parseInt(values[0]);
    if (isNaN(userId)) continue;
    restoredUsers[userId] = {
      id: userId,
      username: values[3],
      first_name: values[1],
      last_name: values[2],
      joined: values[4],
      last_active: values[5]
    };
  }
  if (Object.keys(restoredUsers).length === 0) throw new Error("No valid users found");
  return restoredUsers;
}

/******************** START BOT ********************/
async function startBot() {
  try {
    console.log("=====================================");
    console.log("🚀 Starting UPDATE OTP BOT 2.0...");
    console.log(`🤖 Bot Token: ${BOT_TOKEN}`);
    console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
    console.log(`📨 OTP Group: ${OTP_GROUP}`);
    console.log(`🔢 Numbers per user: ${NUMBERS_PER_USER}`);
    console.log(`💰 Default Earnings: ${DEFAULT_EARNINGS} TK/OTP`);
    console.log("=====================================");
    await bot.launch();
    console.log("✅ Bot started successfully!");
    console.log("📝 User Command: /start");
    console.log(`🛠 Admin Login: /adminlogin ${ADMIN_PASSWORD}`);
    console.log("=====================================");
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    setTimeout(startBot, 10000);
  }
}

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));