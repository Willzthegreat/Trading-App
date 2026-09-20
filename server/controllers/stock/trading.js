import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import Holding from "../../models/holding.js";
import Order from "../../models/order.js";
import Stock from "../../models/stock.js";
import User from "../../models/user.js";
import { BadRequestError, NotFoundError } from "../../errors/index.js";

const getStock = async (stockId, symbol, session) => {
  if (!stockId && !symbol) {
    throw new BadRequestError("Provide stockId or symbol");
  }

  if (stockId && !mongoose.isValidObjectId(stockId)) {
    throw new BadRequestError("Invalid stockId");
  }

  const stock = await Stock.findOne(
    stockId ? { _id: stockId } : { symbol: symbol.toUpperCase() },
  ).session(session);

  if (!stock) {
    throw new NotFoundError("Stock not found");
  }

  return stock;
};

const validateQuantity = (quantity) => {
  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new BadRequestError("Quantity must be greater than zero");
  }
  return parsedQuantity;
};

const buyStock = async (req, res) => {
  const { stockId, symbol, quantity } = req.body;
  const parsedQuantity = validateQuantity(quantity);
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const [user, stock] = await Promise.all([
        User.findById(req.user.userId).session(session),
        getStock(stockId, symbol, session),
      ]);

      if (!user) throw new NotFoundError("User not found");

      const total = stock.currentPrice * parsedQuantity;
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, balance: { $gte: total } },
        { $inc: { balance: -total } },
        { new: true, session },
      );

      if (!updatedUser) {
        throw new BadRequestError("Insufficient balance");
      }

      const holding = await Holding.findOne({
        user: user._id,
        stock: stock._id,
      }).session(session);

      if (holding) {
        const newQuantity = holding.quantity + parsedQuantity;
        const newBuyPrice =
          (holding.quantity * holding.buyPrice + total) / newQuantity;
        holding.quantity = newQuantity;
        holding.buyPrice = newBuyPrice;
        await holding.save({ session });
      } else {
        await Holding.create(
          [{ user: user._id, stock: stock._id, quantity: parsedQuantity, buyPrice: stock.currentPrice }],
          { session },
        );
      }

      const [order] = await Order.create(
        [{
          user: user._id,
          stock: stock._id,
          quantity: parsedQuantity,
          price: stock.currentPrice,
          type: "buy",
          remainingBalance: updatedUser.balance,
        }],
        { session },
      );

      result = { order, balance: updatedUser.balance };
    });

    res.status(StatusCodes.CREATED).json({ msg: "Stock bought successfully", data: result });
  } finally {
    await session.endSession();
  }
};

const sellStock = async (req, res) => {
  const { stockId, symbol, quantity } = req.body;
  const parsedQuantity = validateQuantity(quantity);
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const [user, stock] = await Promise.all([
        User.findById(req.user.userId).session(session),
        getStock(stockId, symbol, session),
      ]);

      if (!user) throw new NotFoundError("User not found");

      const holding = await Holding.findOne({
        user: user._id,
        stock: stock._id,
      }).session(session);

      if (!holding || holding.quantity < parsedQuantity) {
        throw new BadRequestError("Insufficient stock holding");
      }

      const total = stock.currentPrice * parsedQuantity;
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { balance: total } },
        { new: true, session },
      );

      if (holding.quantity === parsedQuantity) {
        await Holding.deleteOne({ _id: holding._id }, { session });
      } else {
        holding.quantity -= parsedQuantity;
        await holding.save({ session });
      }

      const [order] = await Order.create(
        [{
          user: user._id,
          stock: stock._id,
          quantity: parsedQuantity,
          price: stock.currentPrice,
          type: "sell",
          remainingBalance: updatedUser.balance,
        }],
        { session },
      );

      result = { order, balance: updatedUser.balance };
    });

    res.status(StatusCodes.CREATED).json({ msg: "Stock sold successfully", data: result });
  } finally {
    await session.endSession();
  }
};

export { buyStock, sellStock };
