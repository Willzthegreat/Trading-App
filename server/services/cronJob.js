import cron from "node-cron";
import Stock from "../models/stock.js";
import { store10Min, generateStockData } from "./stockUtils.js";


// Schedule a task to run every 10 minutes

const holidays = ["2026-08-16", "2026-09-16"];

const isTradingHour = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); //0 (Sunday) to 6 (Saturday)
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;
  const isTradingTime = 
  (now.getHours() === 9 && now.getMinutes() >= 30) ||
  (now.getHours() > 9 && now.getHours() < 15) ||
  (now.getHours() === 15 && now.getMinutes() <= 30);

  // 9:30 AM to 3:30PM
  const today = new Date().toISOString().slice(0, 10);
  return isWeekday && isTradingTime && !holidays.includes(today);
};

const isNewTradeDay = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;    // Monday to Friday
  const today = new Date().toISOString().slice(0, 10);
  return isWeekday && !holidays.includes(today);
};

const scheduleDayReset = () => {
  cron.schedule("15 9 * * 1-5", async() => {
    if (!isNewTradeDay()) {
      await Stock.updateMany({}, [
        {
          $set: {
            dayTimeSeries: [],
            tenMinTimeSeries: [],
            lastDayTradedPrice: "$currentPrice",
          },
        },
        {
          $set: { _v: 0 },
        }
      ]);

      console.log("Day reset completed at 9:15 AM");
    }
  });
};


const update10minCandle = () => {
  cron.schedule("*/10 * * * *", async () => {
    if (!isTradingHour()) {
      const stock = await Stock.find();
      stock.forEach(async (stock) => {
        await store10Min(stock.symbol);
      });
    }
  });
};

const generateRandomDataEvery5Second = () => {
  cron.schedule("*/5 * * * * *", async () => {
    if (!isTradingHour()) {
      const stock = await Stock.find();
      stock.forEach(async (s) => {
        await generateStockData(s.symbol);
      });
    }
  });
};

export { generateRandomDataEvery5Second, update10minCandle, scheduleDayReset };
