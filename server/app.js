import 'express-async-errors'
import express from "express"
import dotenv from "dotenv"
import {createServer} from "http"
import swaggerUI from "swagger-ui-express"
import YAML from 'yamljs'
import notFoundMiddleware from './middleware/not-found.js'
import errorHandlerMiddleware from './middleware/error-handler.js'
import cors from "cors"
import connectDB from './config/connect.js'
import authRouter from './routes/auth.js'
import stockRouter from './routes/stock.js'
import { dirname, join } from "path"
import { fileURLToPath } from 'url'
import authenticateSocketUser from "./middleware/socketAuth.js"
import { 
  scheduleDayReset,
  update10minCandle,
  generateRandomDataEvery5Second,
} from "./services/cronJob.js"
import socketHandshake from "./middleware/socketHandshake.js";
import { Server } from "socket.io";
import Stock from "./models/stock.js";





const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

scheduleDayReset();
generateRandomDataEvery5Second();
update10minCandle();

const holidays = ["2026-08-17", "2025-06-28"];

const isTradingHour = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();    //0 (Sunday) to 6 (Saturday)
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;    //Monday to Friday
  const isTradingTime = 
    (now.getHours() === 9 && now.getMinutes() >= 30)  ||
    (now.getHours() > 9 && now.getHours() < 15)  ||
    (now.getHours() === 15 && now.getMinutes() <= 30);

    const today = new Date().toISOString().slice(0, 10);

    const isTradingHour = isWeekday && isTradingTime && !holidays.includes(today);

    return true;
    // return isTradingHour;
}


const app = express();
app.use(express.json());

const httpServer = createServer();

const io = new Server (httpServer, {
  cors: {
    origin: process.env.WEBSERVER_URI || "http://localhost:3001",
    methods: ["GET", "POST"],
    allowedHeaders: ["access_token"],
    credentials: true,
  },
});

io.use(socketHandshake);

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("subscribeToStocks", async(stockSymbol) => {
    console.log(`Client ${socket.id} subscribed to stock: ${stockSymbol}`);
    
    const sendUpdates =async () => {
      try {
        const stock = await Stock.findOne({ symbol: stockSymbol });
        if (!stock) {
          console.error(`Stock with symbol ${stockSymbol} not found`);
          return;
        } else {
          socket.emit(`${stockSymbol}`, stock);
        }
      } catch (error) {
        console.error("Error sending stock update:", error);
      }
    }

    sendUpdates();

    const intervalId = setInterval(sendUpdates, 5000);
    if (!isTradingHour()) {
      clearInterval(intervalId);
    }
  });

  socket.on("subscribeToMultipleStocks", async(stockSymbol) => {
    console.log(
      `Client ${socket.id} subscribe to mulitple stocks: ${stockSymbol}`
    );

    const sendUpdates = async () => {
      try {
        for (const symbol of stockSymbol) {
          const stock = await Stock.findOne({ symbol: symbol });
          if (!stock) {
            console.error(`Stock with symbol ${symbol} not found.`);
            continue;
          } else {
            socket.emit(`${symbol}`, stock);
          }
        }
      } catch (error) {
        console.error("Error sending stock update:", error);
      }
    };

    sendUpdates();

    const intervalId = setInterval(sendUpdates, 5000);

    if (!isTradingHour()) {
      clearInterval(intervalId);
    }
  })


  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});




// Log WebSocket server status
httpServer.listen(process.env.SOCKET_PORT || 4000, () => {
  console.log(
    "WebSocket server is running and listening on port ",
    httpServer.address().port
  );
});



app.get('/', (req, res) => {
    res.send('<h1>Trading API</h1><a href="/api-docs">Documentation</a>')
});

// SWAGGER API DOCS

const swaggerDocument = YAML.load(join(__dirname, './docs/swagger.yaml'));
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument))

// ROUTES
app.use('/auth', authRouter);
app.use('/stocks', authenticateSocketUser, stockRouter);

// MIDDLEWARES
app.use(cors());
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// START SERVER

const start = async () => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
      console.log(`Server is listening on port ${PORT}... `)
    );

    try {
        await connectDB(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Database connected successfully.');
    } catch (error) {
      console.error('Database connection failed:', error.message);
    }
}

start();





// 4:08:43
