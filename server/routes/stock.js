import express from "express";
import authenticateUser from "../middleware/authentication.js";
import { buyStock, sellStock, getAllHoldings } from "../controllers/stock/holding.js";
import { registerStock, getAllStock, getStockBySymbol } from "../controllers/stock/stock.js";
import { getOrder } from "../controllers/stock/order.js";

const router = express.Router();

router.post("/buy", authenticateUser, buyStock);
router.post("/sell", authenticateUser, sellStock);
router.get("/stock", getStockBySymbol);
router.get("/holding", getAllHoldings);
router.get("/order", getOrder);
router.post("/register", registerStock);
router.get("", getAllStock);



export default router;
